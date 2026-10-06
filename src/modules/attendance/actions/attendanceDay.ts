"use server";

import { cookies } from "next/headers";
import { getAuthContext } from "@/authorization";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { checkRateLimit, getClientIp } from "@/modules/auth/rateLimit";
import { hashCpf, signAttendanceDevice, verifyAttendanceDevice } from "@/modules/enrollment/dataProtection";
import {
  distanceMeters,
  LESSON_MINUTES,
  locationVerdict,
  makeupTargetSequence,
  meetingBlocks,
  toMinutes,
  type ScheduleSlug,
} from "../rules";
import { dayLessons, lessonNumbersOfScan, lessonsFromUnits } from "../dayLessons";

const DEVICE_COOKIE = "makarios_presenca";

export interface DayInput {
  token: string;
  cpf?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
}

export interface DayLesson {
  number: number;
  block: 1 | 2;
  start: string;
  end: string;
  subject: string | null;
  selected: boolean;
}

export type DayResult =
  | {
      ok: true;
      firstName: string;
      volumeName: string;
      sequence: number;
      /** Ex.: "terça-feira, 6 de outubro". */
      dateLabel: string;
      scheduleLabel: string;
      lessons: DayLesson[];
      hasRecord: boolean;
      placeLabel: string | null;
      /** Encontro da turma do aluno que esta presença cobre, quando veio em outra turma. */
      makeupForSequence: number | null;
    }
  | { ok: false; code: "precisa_cpf" | "precisa_localizacao" | "erro"; message: string };

export type SaveResult =
  | { ok: true; lessonNumbers: number[] }
  | { ok: false; code: "precisa_cpf" | "precisa_localizacao" | "erro"; message: string };

function fail(message: string, code: "precisa_cpf" | "precisa_localizacao" | "erro" = "erro") {
  return { ok: false as const, code, message };
}

const SCHEDULE_LABELS: Record<string, string> = { terca_quinta: "Terça e quinta", sabado: "Sábado" };

type Admin = ReturnType<typeof createSupabaseAdminClient>;

interface RequestRow {
  id: string;
  full_name: string;
  student_id: string | null;
  cpf_hash: string | null;
  season_id: string;
  primary_volume_slug: string;
  primary_schedule_slug: string;
  secondary_volume_slug: string | null;
  secondary_schedule_slug: string | null;
}

const REQUEST_COLUMNS =
  "id, full_name, student_id, cpf_hash, season_id, primary_volume_slug, primary_schedule_slug, secondary_volume_slug, secondary_schedule_slug";

/**
 * Tudo que os dois passos (mostrar as aulas do dia / gravar as marcadas)
 * precisam saber: o QR (volume), a localização, quem é a pessoa, a turma
 * dela e o encontro de hoje. Sem janela de horário: o encontro é o do DIA.
 */
async function resolveContext(supabase: Admin, input: DayInput) {
  const { data: qr } = await supabase
    .from("attendance_qr_codes")
    .select("id, volume_id, volumes(name, slug)")
    .eq("token", input.token)
    .maybeSingle();
  if (!qr || !qr.volumes) return fail("Este QR Code não é válido.");

  const now = new Date();
  const today = getSaoPauloDateKey(now);

  // Encontros de hoje deste volume (todas as turmas).
  const { data: meetings } = await supabase
    .from("class_meetings")
    .select(
      "id, sequence, meeting_date, start_time, end_time, break_minutes, class_id, classes!inner(id, season_volume_offering_id, class_templates!inner(slug), season_volume_offerings!inner(volume_id, season_id))",
    )
    .eq("meeting_date", today)
    .neq("status", "canceled")
    .eq("classes.season_volume_offerings.volume_id", qr.volume_id);
  const todays = (meetings ?? []).filter((m) => m.start_time && m.end_time);
  if (todays.length === 0) return fail(`Não há aula do ${qr.volumes.name} hoje.`);

  // Localização.
  const { data: places } = await supabase
    .from("locations")
    .select("name, latitude, longitude, attendance_radius_meters")
    .not("latitude", "is", null);
  const { data: settings } = await supabase.from("attendance_settings").select("require_location").maybeSingle();
  const requireLocation = settings?.require_location ?? true;
  let locationStatus: "dentro" | "impreciso" | "sem_local_cadastrado" | "sem_localizacao" | "longe" =
    "sem_local_cadastrado";
  // Chave só para ambiente de teste (nunca configurar em produção).
  const skipLocation = process.env.PRESENCA_SEM_LOCALIZACAO === "1";
  if (places && places.length > 0 && !skipLocation) {
    if (input.lat == null || input.lng == null || input.accuracy == null) {
      if (requireLocation) {
        return fail("Para marcar presença, permita que a página veja a sua localização.", "precisa_localizacao");
      }
      locationStatus = "sem_localizacao";
    } else {
      const verdict = locationVerdict(
        { lat: input.lat, lng: input.lng, accuracy: input.accuracy },
        places.map((p) => ({ lat: p.latitude!, lng: p.longitude!, radius: p.attendance_radius_meters })),
      );
      if (verdict === "longe" && requireLocation) {
        return fail("Você precisa estar no local da aula para marcar presença.");
      }
      locationStatus = verdict;
    }
  }
  let placeLabel: string | null = null;
  if (places && places.length > 0 && input.lat != null && input.lng != null) {
    const nearest = places
      .map((p) => ({ name: p.name, d: distanceMeters({ lat: input.lat!, lng: input.lng! }, { lat: p.latitude!, lng: p.longitude! }) }))
      .sort((a, b) => a.d - b.d)[0];
    if (nearest) placeLabel = `${nearest.name}, a ${Math.round(nearest.d)} m`;
  }

  // Quem é: login, celular já lembrado ou CPF.
  let request: RequestRow | null = null;
  let studentId: string | null = null;
  let fullName = "";
  let identifiedBy: "login" | "cpf" | "aparelho";

  const auth = await getAuthContext();
  const cookieStore = await cookies();
  const deviceRequestId = verifyAttendanceDevice(cookieStore.get(DEVICE_COOKIE)?.value);

  let loginLinked = false;
  if (auth) {
    const [{ count: requests }, { count: enrollments }] = await Promise.all([
      supabase.from("enrollment_requests").select("id", { count: "exact", head: true }).eq("student_id", auth.userId),
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("student_id", auth.userId),
    ]);
    loginLinked = (requests ?? 0) + (enrollments ?? 0) > 0;
  }

  if (auth && loginLinked) {
    identifiedBy = "login";
    studentId = auth.userId;
    fullName = auth.fullName;
    const { data } = await supabase
      .from("enrollment_requests")
      .select(REQUEST_COLUMNS)
      .eq("student_id", auth.userId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1);
    request = (data?.[0] as RequestRow | undefined) ?? null;
  } else if (deviceRequestId) {
    identifiedBy = "aparelho";
    const { data } = await supabase
      .from("enrollment_requests")
      .select(REQUEST_COLUMNS)
      .eq("id", deviceRequestId)
      .eq("status", "approved")
      .maybeSingle();
    request = (data as RequestRow | null) ?? null;
    if (!request) return fail("Não encontramos a sua inscrição. Digite o seu CPF.", "precisa_cpf");
  } else {
    identifiedBy = "cpf";
    const cpf = (input.cpf ?? "").replace(/\D/g, "");
    if (cpf.length !== 11) return fail("Digite o seu CPF para marcar presença.", "precisa_cpf");
    // No Wi-Fi do local todos os celulares saem pelo mesmo IP e a turma chega junta: limite alto.
    const ip = await getClientIp();
    if (!(await checkRateLimit(supabase, `presenca-cpf:${ip}`, 300, 600))) {
      return fail("Muitas tentativas seguidas. Espere alguns minutos e tente de novo.");
    }
    const { data } = await supabase
      .from("enrollment_requests")
      .select(REQUEST_COLUMNS)
      .eq("cpf_hash", hashCpf(cpf))
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1);
    request = (data?.[0] as RequestRow | undefined) ?? null;
    if (!request) {
      return fail("Não encontramos uma inscrição aprovada com este CPF. Procure a coordenação.", "precisa_cpf");
    }
  }
  if (request) {
    fullName = fullName || request.full_name;
    studentId = studentId ?? request.student_id;
  }

  // Quem tem uma inscrição por volume precisa cair na deste volume e semestre.
  const volumeSlug = qr.volumes.slug;
  const seasonId = todays[0]!.classes.season_volume_offerings.season_id;
  const fits = (r: RequestRow) =>
    (r.primary_volume_slug === volumeSlug || r.secondary_volume_slug === volumeSlug) && r.season_id === seasonId;
  if (request && !fits(request)) {
    const siblings = request.cpf_hash
      ? await supabase
          .from("enrollment_requests")
          .select(REQUEST_COLUMNS)
          .eq("cpf_hash", request.cpf_hash)
          .eq("status", "approved")
          .eq("season_id", seasonId)
      : { data: [] };
    request = ((siblings.data ?? []) as RequestRow[]).find(fits) ?? null;
    if (!request && identifiedBy !== "login") {
      return fail(`Não encontramos a sua inscrição no ${qr.volumes.name} deste semestre. Procure a coordenação.`);
    }
  }

  // Turma da pessoa neste volume: a matrícula manda; sem matrícula, o horário da inscrição.
  let ownSchedule: string | null = null;
  let ownClassId: string | null = null;
  if (studentId) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id, classes!inner(class_templates!inner(slug), season_volume_offerings!inner(volume_id))")
      .eq("student_id", studentId)
      .eq("status", "active")
      .eq("classes.season_volume_offerings.volume_id", qr.volume_id)
      .limit(1);
    const enrollment = enrollments?.[0];
    if (enrollment?.class_id) {
      ownClassId = enrollment.class_id;
      ownSchedule = enrollment.classes.class_templates.slug;
    }
  }
  if (!ownSchedule && request) {
    if (request.primary_volume_slug === volumeSlug) ownSchedule = request.primary_schedule_slug;
    else if (request.secondary_volume_slug === volumeSlug) ownSchedule = request.secondary_schedule_slug;
  }
  if (!ownSchedule) {
    return fail(`Você não está inscrito no ${qr.volumes.name}. Confira se escaneou o QR Code da sala certa.`);
  }

  // O encontro de hoje: o da turma da pessoa; se hoje só tem de outra turma, é reposição.
  const meeting = todays.find((m) => m.classes.class_templates.slug === ownSchedule) ?? todays[0]!;
  const attendedSchedule = meeting.classes.class_templates.slug;

  return {
    ok: true as const,
    supabase,
    qr: { id: qr.id, volumeId: qr.volume_id, volumeName: qr.volumes.name },
    now,
    today,
    meeting,
    attendedSchedule,
    ownSchedule,
    ownClassId,
    request,
    studentId,
    fullName,
    identifiedBy,
    locationStatus,
    placeLabel,
    cookieStore,
  };
}

type Context = Extract<Awaited<ReturnType<typeof resolveContext>>, { ok: true }>;

/** Encontro da turma do aluno que cobre um bloco assistido em outra turma (reposição). */
async function makeupTarget(ctx: Context, block: 1 | 2): Promise<{ meetingId: string | null; sequence: number | null }> {
  if (ctx.attendedSchedule === ctx.ownSchedule) return { meetingId: null, sequence: null };
  const sequence = makeupTargetSequence(
    { schedule: ctx.attendedSchedule as ScheduleSlug, sequence: ctx.meeting.sequence, block },
    ctx.ownSchedule as ScheduleSlug,
  );
  if (sequence === null) return { meetingId: null, sequence: null };
  let classId = ctx.ownClassId;
  if (!classId) {
    const { data: ownClass } = await ctx.supabase
      .from("classes")
      .select("id, class_templates!inner(slug)")
      .eq("season_volume_offering_id", ctx.meeting.classes.season_volume_offering_id)
      .eq("class_templates.slug", ctx.ownSchedule)
      .limit(1);
    classId = ownClass?.[0]?.id ?? null;
  }
  if (!classId) return { meetingId: null, sequence: null };
  const { data: target } = await ctx.supabase
    .from("class_meetings")
    .select("id")
    .eq("class_id", classId)
    .eq("sequence", sequence)
    .maybeSingle();
  return { meetingId: target?.id ?? null, sequence: target?.id ? sequence : null };
}

async function loadLessons(ctx: Context) {
  const { data: subjectRows } = await ctx.supabase
    .from("class_meeting_blocks")
    .select("start_time, end_time, modules(name)")
    .eq("class_meeting_id", ctx.meeting.id)
    .order("start_time");
  const subjects = (subjectRows ?? [])
    .filter((r) => r.start_time && r.end_time)
    .map((r) => ({ start: toMinutes(r.start_time!), end: toMinutes(r.end_time!), name: r.modules?.name ?? "Matéria" }));

  return dayLessons(
    { startTime: ctx.meeting.start_time!, endTime: ctx.meeting.end_time!, breakMinutes: ctx.meeting.break_minutes },
    subjects,
  );
}

async function existingRows(ctx: Context) {
  const base = ctx.supabase
    .from("attendance_scans")
    .select("id, block, lessons_credited, lessons_total, lesson_numbers")
    .eq("meeting_id", ctx.meeting.id);
  const { data } = ctx.request
    ? await base.eq("enrollment_request_id", ctx.request.id)
    : await base.eq("student_id", ctx.studentId!).is("enrollment_request_id", null);
  return data ?? [];
}

function rememberDevice(ctx: Context) {
  if (ctx.identifiedBy === "cpf" && ctx.request) {
    ctx.cookieStore.set(DEVICE_COOKIE, signAttendanceDevice(ctx.request.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 180,
      path: "/presenca",
    });
  }
}

/**
 * Passo 1: identifica a pessoa pelo QR e mostra as aulas de HOJE do volume
 * dela (com horário e matéria), já com o que ela tenha marcado antes.
 */
export async function loadAttendanceDay(input: DayInput): Promise<DayResult> {
  const ctx = await resolveContext(createSupabaseAdminClient(), input);
  if (!ctx.ok) return ctx;

  const lessons = await loadLessons(ctx);
  const rows = await existingRows(ctx);
  const markedLessons = new Set(lessonsFromUnits(lessons, rows.flatMap((r) => lessonNumbersOfScan(r))));

  rememberDevice(ctx);

  const makeups = await Promise.all(([1, 2] as const).map((b) => makeupTarget(ctx, b)));
  const makeupSequences = [...new Set(makeups.map((m) => m.sequence).filter((s): s is number => s !== null))];

  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${ctx.today}T12:00:00-03:00`));

  return {
    ok: true,
    firstName: ctx.fullName.split(" ")[0] ?? "",
    volumeName: ctx.qr.volumeName,
    sequence: ctx.meeting.sequence,
    dateLabel,
    scheduleLabel: SCHEDULE_LABELS[ctx.attendedSchedule] ?? ctx.attendedSchedule,
    lessons: lessons.map((l) => ({
      number: l.number,
      block: l.block,
      start: l.start,
      end: l.end,
      subject: l.subject,
      selected: markedLessons.has(l.number),
    })),
    hasRecord: rows.length > 0,
    placeLabel: ctx.placeLabel,
    makeupForSequence: makeupSequences.length === 1 ? (makeupSequences[0] ?? null) : null,
  };
}

/**
 * Passo 2: grava as aulas que a pessoa marcou (uma vez no dia basta). Pode ser
 * refeito no mesmo dia: a nova marcação substitui a anterior.
 */
export async function saveAttendanceDay(input: DayInput & { lessons: number[] }): Promise<SaveResult> {
  const ctx = await resolveContext(createSupabaseAdminClient(), input);
  if (!ctx.ok) return ctx;

  const lessons = await loadLessons(ctx);
  const byNumber = new Map(lessons.map((l) => [l.number, l]));
  const chosen = [...new Set(input.lessons)].filter((n) => Number.isInteger(n)).sort((a, b) => a - b);

  if (chosen.some((n) => !byNumber.has(n))) return fail("Aula inválida. Atualize a página e marque de novo.");

  const rows = await existingRows(ctx);
  const scannedAt = ctx.now.toISOString();
  const blocks = meetingBlocks({
    startTime: ctx.meeting.start_time!,
    endTime: ctx.meeting.end_time!,
    breakMinutes: ctx.meeting.break_minutes,
  });

  for (const block of [1, 2] as const) {
    // O banco conta em unidades de 30 min: cada aula de 1 hora vale 2 unidades.
    const numbers = chosen.flatMap((n) => (byNumber.get(n)?.block === block ? byNumber.get(n)!.units : []));
    const existing = rows.find((r) => r.block === block);

    if (numbers.length === 0) {
      if (existing) await ctx.supabase.from("attendance_scans").delete().eq("id", existing.id);
      continue;
    }

    const makeup = await makeupTarget(ctx, block);
    const payload = {
      meeting_id: ctx.meeting.id,
      qr_code_id: ctx.qr.id,
      enrollment_request_id: ctx.request?.id ?? null,
      student_id: ctx.request ? null : ctx.studentId,
      block,
      scanned_at: scannedAt,
      lessons_total: blocks[block - 1]!.lessons,
      lessons_credited: numbers.length,
      recognized_minutes: numbers.length * LESSON_MINUTES,
      identified_by: ctx.identifiedBy,
      location_status: ctx.locationStatus,
      makeup_for_meeting_id: makeup.meetingId,
      lesson_numbers: numbers,
      self_declared: true,
    };

    const { error } = existing
      ? await ctx.supabase.from("attendance_scans").update(payload).eq("id", existing.id)
      : await ctx.supabase.from("attendance_scans").insert(payload);
    if (error) return fail("Não foi possível registrar agora. Tente de novo.");
  }

  rememberDevice(ctx);
  return { ok: true, lessonNumbers: chosen };
}
