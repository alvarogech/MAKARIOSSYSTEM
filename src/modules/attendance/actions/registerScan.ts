"use server";

import { cookies } from "next/headers";
import { getAuthContext } from "@/authorization";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { checkRateLimit, getClientIp } from "@/modules/auth/rateLimit";
import { hashCpf, signAttendanceDevice, verifyAttendanceDevice } from "@/modules/enrollment/dataProtection";
import {
  evaluateScan,
  locationVerdict,
  makeupTargetSequence,
  weekStartOf,
  type ScheduleSlug,
} from "../rules";

const DEVICE_COOKIE = "makarios_presenca";

export interface ScanInput {
  token: string;
  cpf?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
}

export type ScanResult =
  | {
      ok: true;
      alreadyRegistered: boolean;
      firstName: string;
      volumeName: string;
      sequence: number;
      block: 1 | 2;
      time: string;
      lessonsCredited: number;
      lessonsTotal: number;
      makeupForSequence: number | null;
      locationStatus: string;
    }
  | {
      ok: false;
      code: "precisa_cpf" | "precisa_localizacao" | "erro";
      message: string;
    };

function fail(message: string, code: "precisa_cpf" | "precisa_localizacao" | "erro" = "erro"): ScanResult {
  return { ok: false, code, message };
}

function saoPauloMinuteNow(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Registra a presença de quem escaneou o QR Code da porta da sala.
 * Público (o aluno pode não ter conta): toda a validação é feita aqui, no
 * servidor, com o client administrativo, e só então grava.
 */
export async function registerScan(input: ScanInput): Promise<ScanResult> {
  const supabase = createSupabaseAdminClient();

  const ip = await getClientIp();
  if (!(await checkRateLimit(supabase, `presenca:${ip}`, 30, 600))) {
    return fail("Muitas tentativas seguidas. Espere alguns minutos e tente de novo.");
  }

  // 1. O QR Code e a semana dele.
  const { data: qr } = await supabase
    .from("attendance_qr_codes")
    .select("id, volume_id, week_start, volumes(name, slug)")
    .eq("token", input.token)
    .maybeSingle();
  if (!qr || !qr.volumes) return fail("Este QR Code não é válido.");

  const now = new Date();
  const today = getSaoPauloDateKey(now);
  if (weekStartOf(today) !== qr.week_start) {
    return fail("Este QR Code é de outra semana. Use o que está na porta da sala hoje.");
  }

  // 2. Qual encontro deste volume está acontecendo agora.
  const { data: meetings } = await supabase
    .from("class_meetings")
    .select(
      "id, sequence, start_time, end_time, break_minutes, class_id, classes!inner(id, season_volume_offering_id, class_templates!inner(slug), season_volume_offerings!inner(volume_id))",
    )
    .eq("meeting_date", today)
    .neq("status", "canceled")
    .eq("classes.season_volume_offerings.volume_id", qr.volume_id);

  const minute = saoPauloMinuteNow(now);
  let current: { meeting: NonNullable<typeof meetings>[number]; evaluation: NonNullable<ReturnType<typeof evaluateScan>> } | null = null;
  for (const meeting of meetings ?? []) {
    if (!meeting.start_time || !meeting.end_time) continue;
    const evaluation = evaluateScan(
      { startTime: meeting.start_time, endTime: meeting.end_time, breakMinutes: meeting.break_minutes },
      minute,
    );
    if (evaluation) {
      current = { meeting, evaluation };
      break;
    }
  }
  if (!current) return fail(`Não há aula do ${qr.volumes.name} agora.`);

  // 3. Localização: perto de algum local cadastrado com coordenadas.
  const { data: places } = await supabase
    .from("locations")
    .select("latitude, longitude, attendance_radius_meters")
    .not("latitude", "is", null);
  let locationStatus: "dentro" | "impreciso" | "sem_local_cadastrado" = "sem_local_cadastrado";
  if (places && places.length > 0) {
    if (input.lat == null || input.lng == null || input.accuracy == null) {
      return fail("Para marcar presença, permita que a página veja a sua localização.", "precisa_localizacao");
    }
    const verdict = locationVerdict(
      { lat: input.lat, lng: input.lng, accuracy: input.accuracy },
      places.map((p) => ({ lat: p.latitude!, lng: p.longitude!, radius: p.attendance_radius_meters })),
    );
    if (verdict === "longe") {
      return fail("Você precisa estar no local da aula para marcar presença.");
    }
    locationStatus = verdict;
  }

  // 4. Quem está escaneando: login, celular já lembrado ou CPF.
  const requestColumns =
    "id, full_name, student_id, primary_volume_slug, primary_schedule_slug, secondary_volume_slug, secondary_schedule_slug";
  type RequestRow = {
    id: string;
    full_name: string;
    student_id: string | null;
    primary_volume_slug: string;
    primary_schedule_slug: string;
    secondary_volume_slug: string | null;
    secondary_schedule_slug: string | null;
  };
  let request: RequestRow | null = null;
  let studentId: string | null = null;
  let fullName = "";
  let identifiedBy: "login" | "cpf" | "aparelho";

  const auth = await getAuthContext();
  const cookieStore = await cookies();
  const deviceRequestId = verifyAttendanceDevice(cookieStore.get(DEVICE_COOKIE)?.value);

  // Login só identifica se a conta estiver ligada a uma inscrição ou
  // matrícula; senão (ex.: coordenação logada no celular), cai no CPF.
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
      .select(requestColumns)
      .eq("student_id", auth.userId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1);
    request = (data?.[0] as RequestRow | undefined) ?? null;
  } else if (deviceRequestId) {
    identifiedBy = "aparelho";
    const { data } = await supabase
      .from("enrollment_requests")
      .select(requestColumns)
      .eq("id", deviceRequestId)
      .eq("status", "approved")
      .maybeSingle();
    request = (data as RequestRow | null) ?? null;
    if (!request) return fail("Não encontramos a sua inscrição. Digite o seu CPF.", "precisa_cpf");
  } else {
    identifiedBy = "cpf";
    const cpf = (input.cpf ?? "").replace(/\D/g, "");
    if (cpf.length !== 11) return fail("Digite o seu CPF para marcar presença.", "precisa_cpf");
    const { data } = await supabase
      .from("enrollment_requests")
      .select(requestColumns)
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

  // 5. Em qual turma deste volume a pessoa está: a matrícula manda (pode
  //    ter mudado de turma); sem matrícula, vale o horário da inscrição.
  const volumeSlug = qr.volumes.slug;
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

  // 6. Reposição: encontro de outra turma do mesmo volume.
  const { meeting, evaluation } = current;
  const attendedSchedule = meeting.classes.class_templates.slug;
  let makeupForMeetingId: string | null = null;
  let makeupForSequence: number | null = null;
  if (attendedSchedule !== ownSchedule) {
    makeupForSequence = makeupTargetSequence(
      { schedule: attendedSchedule as ScheduleSlug, sequence: meeting.sequence, block: evaluation.block },
      ownSchedule as ScheduleSlug,
    );
    if (makeupForSequence !== null) {
      let classId = ownClassId;
      if (!classId) {
        const { data: ownClass } = await supabase
          .from("classes")
          .select("id, class_templates!inner(slug)")
          .eq("season_volume_offering_id", meeting.classes.season_volume_offering_id)
          .eq("class_templates.slug", ownSchedule)
          .limit(1);
        classId = ownClass?.[0]?.id ?? null;
      }
      if (classId) {
        const { data: target } = await supabase
          .from("class_meetings")
          .select("id")
          .eq("class_id", classId)
          .eq("sequence", makeupForSequence)
          .maybeSingle();
        makeupForMeetingId = target?.id ?? null;
      }
    }
  }

  // 7. Grava. O primeiro escaneamento do bloco vale; repetir não muda nada.
  const scannedAt = now.toISOString();
  const { error } = await supabase.from("attendance_scans").insert({
    meeting_id: meeting.id,
    qr_code_id: qr.id,
    enrollment_request_id: request?.id ?? null,
    student_id: request ? null : studentId,
    block: evaluation.block,
    scanned_at: scannedAt,
    lessons_total: evaluation.lessonsTotal,
    lessons_credited: evaluation.lessonsCredited,
    recognized_minutes: evaluation.recognizedMinutes,
    identified_by: identifiedBy,
    location_status: locationStatus,
    makeup_for_meeting_id: makeupForMeetingId,
  });

  let alreadyRegistered = false;
  let registeredAt = scannedAt;
  let credited = evaluation.lessonsCredited;
  if (error) {
    if (error.code !== "23505") return fail("Não foi possível registrar agora. Tente de novo.");
    alreadyRegistered = true;
    const existing = request
      ? supabase.from("attendance_scans").select("scanned_at, lessons_credited").eq("enrollment_request_id", request.id)
      : supabase.from("attendance_scans").select("scanned_at, lessons_credited").eq("student_id", studentId!).is("enrollment_request_id", null);
    const { data: previous } = await existing.eq("meeting_id", meeting.id).eq("block", evaluation.block).maybeSingle();
    if (previous) {
      registeredAt = previous.scanned_at;
      credited = previous.lessons_credited;
    }
  }

  if (identifiedBy === "cpf" && request) {
    cookieStore.set(DEVICE_COOKIE, signAttendanceDevice(request.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 180,
      path: "/presenca",
    });
  }

  return {
    ok: true,
    alreadyRegistered,
    firstName: fullName.split(" ")[0] ?? "",
    volumeName: qr.volumes.name,
    sequence: meeting.sequence,
    block: evaluation.block,
    time: formatTime(registeredAt),
    lessonsCredited: credited,
    lessonsTotal: evaluation.lessonsTotal,
    makeupForSequence: makeupForMeetingId ? makeupForSequence : null,
    locationStatus,
  };
}

