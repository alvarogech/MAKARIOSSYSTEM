import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getPublicEnv } from "@/lib/env";
import { formatSaoPauloLongDate, formatSaoPauloTimeRange } from "@/lib/saoPauloDate";
import { generateInviteToken, hashInviteToken } from "@/modules/auth/inviteTokens";
import { sendMail } from "@/modules/notifications/mailer";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";

const STUDENT_INVITE_TTL_DAYS = 14;

export interface ResolvedCourse {
  classId: string;
  seasonVolumeOfferingId: string;
  volumeName: string;
  className: string;
  locationLabel: string | null;
  firstMeetingDate: string | null;
  timeRange: string;
}

/**
 * Resolve volume_slug + schedule_slug (capturados na inscrição pública,
 * antes de existir qualquer turma específica no formulário) para a turma
 * real da temporada atual. Sem isso não dá pra saber em qual `classes.id`
 * matricular o aluno nem o que mostrar no e-mail.
 */
export async function resolveCourseForSlugs(
  supabase: SupabaseClient<Database>,
  seasonId: string,
  volumeSlug: string,
  scheduleSlug: string,
): Promise<ResolvedCourse | null> {
  // Em três consultas simples (em vez de um select aninhado de 3 níveis
  // com filtro em coluna embutida) — o gerador de tipos do supabase-js não
  // infere bem esse tipo de join profundo, e isto fica mais fácil de ler.
  const { data: volume } = await supabase.from("volumes").select("id, name").eq("slug", volumeSlug).maybeSingle();
  if (!volume) return null;

  const { data: offering } = await supabase
    .from("season_volume_offerings")
    .select("id")
    .eq("season_id", seasonId)
    .eq("volume_id", volume.id)
    .maybeSingle();
  if (!offering) return null;

  const { data: template } = await supabase
    .from("class_templates")
    .select("id, start_time, end_time")
    .eq("slug", scheduleSlug)
    .maybeSingle();
  if (!template) return null;

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, season_volume_offering_id, location_id")
    .eq("season_volume_offering_id", offering.id)
    .eq("class_template_id", template.id)
    .maybeSingle();
  if (!klass) return null;

  const { data: location } = klass.location_id
    ? await supabase.from("locations").select("name, address").eq("id", klass.location_id).maybeSingle()
    : { data: null };

  const { data: firstMeeting } = await supabase
    .from("class_meetings")
    .select("meeting_date")
    .eq("class_id", klass.id)
    .order("meeting_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return {
    classId: klass.id,
    seasonVolumeOfferingId: klass.season_volume_offering_id,
    volumeName: volume.name,
    className: klass.name,
    locationLabel: location ? (location.address ? `${location.name} — ${location.address}` : location.name) : null,
    firstMeetingDate: firstMeeting?.meeting_date ?? null,
    timeRange: formatSaoPauloTimeRange(template.start_time, template.end_time),
  };
}

function courseBlockHtml(course: ResolvedCourse): string {
  const dateLabel = course.firstMeetingDate
    ? formatSaoPauloLongDate(course.firstMeetingDate, { capitalize: true })
    : "a definir";
  return `
    <div style="margin:12px 0;padding:12px 16px;background:#eaf3fb;border-radius:8px;">
      <p style="margin:0 0 4px;font-weight:600;color:#205f92;">${course.volumeName}</p>
      <p style="margin:0;font-size:14px;color:#333;">${course.className}</p>
      <p style="margin:0;font-size:14px;color:#333;">Início: ${dateLabel}${course.timeRange ? ` · ${course.timeRange}` : ""}</p>
      ${course.locationLabel ? `<p style="margin:0;font-size:14px;color:#333;">Local: ${course.locationLabel}</p>` : ""}
    </div>`;
}

function courseBlockText(course: ResolvedCourse): string {
  const dateLabel = course.firstMeetingDate
    ? formatSaoPauloLongDate(course.firstMeetingDate, { capitalize: true })
    : "a definir";
  const lines = [
    `- ${course.volumeName} (${course.className})`,
    `  Início: ${dateLabel}${course.timeRange ? ` · ${course.timeRange}` : ""}`,
  ];
  if (course.locationLabel) lines.push(`  Local: ${course.locationLabel}`);
  return lines.join("\n");
}

function buildEmail(params: {
  fullName: string;
  courses: ResolvedCourse[];
  link: string;
}): { subject: string; html: string; text: string } {
  const subject = "Sua matrícula na Escola Makários foi aprovada!";
  const coursesHtml = params.courses.map(courseBlockHtml).join("");
  const coursesText = params.courses.map(courseBlockText).join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
      <p>Olá, ${params.fullName}!</p>
      <p>Sua inscrição na Escola Makários foi aprovada. Você está matriculado(a) em:</p>
      ${coursesHtml}
      <p>Para acessar a plataforma — onde ficam o calendário, os materiais de aula e suas atividades —
      abra o link abaixo e crie sua senha. Ele é pessoal, vale por ${STUDENT_INVITE_TTL_DAYS} dias e só
      funciona uma vez:</p>
      <p style="margin:20px 0;">
        <a href="${params.link}" style="background:#2e7fbf;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
          Acessar a plataforma
        </a>
      </p>
      <p style="font-size:13px;color:#666;">Ou copie e cole este endereço no navegador: ${params.link}</p>
      <p>Qualquer dúvida, é só nos procurar.</p>
      <p>Escola Makários — Igreja Emaús</p>
    </div>`;

  const text =
    `Olá, ${params.fullName}!\n\n` +
    `Sua inscrição na Escola Makários foi aprovada. Você está matriculado(a) em:\n\n` +
    `${coursesText}\n\n` +
    `Para acessar a plataforma, abra o link abaixo e crie sua senha (pessoal, vale por ` +
    `${STUDENT_INVITE_TTL_DAYS} dias, uso único):\n${params.link}\n\n` +
    `Qualquer dúvida, é só nos procurar.\nEscola Makários — Igreja Emaús`;

  return { subject, html, text };
}

/**
 * Cria o convite de primeiro acesso do aluno (token + e-mail rico com o(s)
 * curso(s) dele) a partir de uma enrollment_request recém-aprovada. Não
 * cria a matrícula ainda — isso só acontece quando o aluno de fato aceitar
 * o convite (ver acceptStudentInvitation), porque `enrollments.student_id`
 * exige uma conta que ainda não existe neste momento.
 */
export async function createStudentOnboardingInvitation(
  supabase: SupabaseClient<Database>,
  request: {
    id: string;
    full_name: string;
    email: string;
    season_id: string;
    primary_volume_slug: string;
    primary_schedule_slug: string;
    wants_second_volume: boolean;
    secondary_volume_slug: string | null;
    secondary_schedule_slug: string | null;
  },
  invitedBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: studentRole } = await supabase.from("roles").select("id").eq("slug", "student").single();
  if (!studentRole) {
    return { ok: false, error: "Papel 'Aluno' não encontrado no sistema." };
  }

  const primary = await resolveCourseForSlugs(
    supabase,
    request.season_id,
    request.primary_volume_slug,
    request.primary_schedule_slug,
  );
  if (!primary) {
    return { ok: false, error: "Não foi possível localizar a turma principal desta inscrição." };
  }

  const courses = [primary];
  const classIds = [primary.classId];

  if (request.wants_second_volume && request.secondary_volume_slug && request.secondary_schedule_slug) {
    const secondary = await resolveCourseForSlugs(
      supabase,
      request.season_id,
      request.secondary_volume_slug,
      request.secondary_schedule_slug,
    );
    if (secondary) {
      courses.push(secondary);
      classIds.push(secondary.classId);
    }
  }

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + STUDENT_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  // A maioria dos alunos loga com e-mail+senha normalmente. O código de
  // acesso só é necessário quando o e-mail já está — ou vai ficar — em uso
  // por outra conta de verdade (ex.: irmãos cadastrados com o e-mail de um
  // responsável); fora desse caso, criar a conta por e-mail colidiria no
  // Supabase Auth (e-mail é único lá). Precisa do client administrativo só
  // pra essa checagem (auth.users não é lido pelo client comum).
  const normalizedEmail = request.email.trim().toLowerCase();
  const admin = createSupabaseAdminClient();

  let emailAlreadyRegistered = false;
  for (let page = 1; page <= 20; page++) {
    const { data: usersPage } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = usersPage?.users ?? [];
    if (users.some((u) => u.email?.toLowerCase() === normalizedEmail)) {
      emailAlreadyRegistered = true;
      break;
    }
    if (users.length < 200) break;
  }

  const { data: otherPendingInvites } = await admin
    .from("invitations")
    .select("id, use_access_code")
    .eq("purpose", "student_onboarding")
    .eq("channel", "email")
    .ilike("email", normalizedEmail)
    .is("consumed_at", null)
    .is("revoked_at", null);

  const useAccessCode = emailAlreadyRegistered || (otherPendingInvites?.length ?? 0) > 0;

  // Se um irmão ainda não cadastrado também está nessa lista e por acaso
  // ainda não foi marcado como exceção, atualiza ele também agora — melhor
  // descobrir isso na hora de gerar o segundo convite do que deixar os dois
  // competindo pelo mesmo e-mail no Supabase Auth mais tarde.
  const toFlip = (otherPendingInvites ?? []).filter((inv) => !inv.use_access_code).map((inv) => inv.id);
  if (toFlip.length > 0) {
    await admin.from("invitations").update({ use_access_code: true }).in("id", toFlip);
  }

  const { error: insertError } = await supabase.from("invitations").insert({
    email: request.email,
    intended_role_id: studentRole.id,
    invited_by: invitedBy,
    channel: "email",
    purpose: "student_onboarding",
    intended_full_name: request.full_name,
    class_ids: classIds,
    enrollment_request_id: request.id,
    token_hash: tokenHash,
    token_expires_at: expiresAt.toISOString(),
    use_access_code: useAccessCode,
  });

  if (insertError) {
    return { ok: false, error: "Não foi possível gerar o convite de acesso." };
  }

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const link = `${appUrl}/convite-aluno/${rawToken}`;
  const { subject, html, text } = buildEmail({ fullName: request.full_name, courses, link });

  try {
    await sendMail({ to: request.email, subject, html, text });
  } catch (error) {
    console.error("Falha ao enviar e-mail de primeiro acesso do aluno:", error);
    return { ok: false, error: "Convite gerado, mas o e-mail não pôde ser enviado." };
  }

  return { ok: true };
}
