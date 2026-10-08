"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { acceptStudentInvitationSchema } from "../schemas";
import { hashInviteToken } from "@/modules/auth/inviteTokens";
import { checkRateLimit, getClientIp } from "@/modules/auth/rateLimit";
import { escapeIlike, normalizeEmail } from "@/modules/auth/lookupTeacherCandidate";
import { formatAccessCode, generateUniqueAccessCode } from "@/modules/auth/accessCode";
import { sendMail } from "@/modules/notifications/mailer";
import { ALREADY_HAS_ACCOUNT_MESSAGE, findExistingAccountForPerson } from "../existingAccount";

export interface AcceptStudentInvitationState {
  error?: string;
  result?: { mode: "access_code"; accessCode: string } | { mode: "email" };
}

/**
 * Cria a matrícula (enrollments) para cada turma gravada no convite — só é
 * possível agora, porque é aqui que `student_id` passa a existir. Nunca
 * sobrescreve nada: se por algum motivo já existir matrícula na mesma
 * turma, ignora (23505).
 */
async function createEnrollments(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  studentId: string,
  classIds: string[],
  authorizedBy: string,
  authorizedAt: string,
) {
  for (const classId of classIds) {
    const { data: klass } = await admin
      .from("classes")
      .select("season_volume_offering_id")
      .eq("id", classId)
      .maybeSingle();
    if (!klass) continue;

    const { error } = await admin.from("enrollments").insert({
      student_id: studentId,
      class_id: classId,
      season_volume_offering_id: klass.season_volume_offering_id,
      status: "active",
      authorized_by: authorizedBy,
      authorized_at: authorizedAt,
    });
    if (error && error.code !== "23505") {
      console.error("Falha ao criar matrícula no primeiro acesso do aluno:", error);
    }
  }
}

/**
 * Liga a inscrição à conta e cria as matrículas das turmas do convite. Comum
 * a quem cria a conta nova e a quem já tinha conta (professor, outro volume).
 */
async function finalizeStudentEnrollment(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  studentId: string,
  invitation: { enrollment_request_id: string | null; class_ids: string[] | null },
  nowIso: string,
) {
  let authorizedBy = studentId;
  let authorizedAt = nowIso;
  if (invitation.enrollment_request_id) {
    const { data: request } = await admin
      .from("enrollment_requests")
      .select("reviewed_by, reviewed_at")
      .eq("id", invitation.enrollment_request_id)
      .maybeSingle();
    if (request?.reviewed_by) authorizedBy = request.reviewed_by;
    if (request?.reviewed_at) authorizedAt = request.reviewed_at;

    // Liga a inscrição à conta recém-criada — é isso que permite ao
    // Dashboard de Inscrições mostrar a turma atual e oferecer mover de
    // turma direto por lá, sem precisar abrir Matrículas.
    // Só liga se ainda não houver conta ligada: nunca sobrescreve (era assim que a inscrição "trocava" de conta).
    await admin
      .from("enrollment_requests")
      .update({ student_id: studentId })
      .eq("id", invitation.enrollment_request_id)
      .is("student_id", null);
  }


  await createEnrollments(admin, studentId, invitation.class_ids ?? [], authorizedBy, authorizedAt);
}

/**
 * Consome o convite de primeiro acesso do aluno (enviado por e-mail) — só
 * é chamado por submit explícito, nunca por GET (ver página pública em
 * src/app/(public)/convite-aluno/[token]/page.tsx).
 *
 * Diferente da versão anterior: a leitura do convite NÃO é mais uma
 * reivindicação atômica que já marca `consumed_at`. O convite só vira
 * "usado" DEPOIS que a conta é criada com sucesso — se `admin.createUser`
 * (ou qualquer passo depois) falhar, nada é marcado como consumido e o
 * mesmo link continua válido para uma nova tentativa. O preço disso é uma
 * janela de corrida rara (duplo clique bem cronometrado); o próprio
 * `access_code` sendo UNIQUE em auth.users.phone barra uma conta
 * duplicada de verdade — na pior das hipóteses, a segunda tentativa recebe
 * um erro de "tente de novo" em vez de silenciosamente duplicar algo.
 */
export async function acceptStudentInvitation(
  _prevState: AcceptStudentInvitationState,
  formData: FormData,
): Promise<AcceptStudentInvitationState> {
  const parsed = acceptStudentInvitationSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const contactEmail = normalizeEmail(parsed.data.email);
  const admin = createSupabaseAdminClient();

  const ip = await getClientIp();
  const okToTry = await checkRateLimit(admin, `accept-student-invite:${ip}`, 10, 600);
  if (!okToTry) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }

  const tokenHash = hashInviteToken(parsed.data.token);

  const { data: invitation, error: fetchError } = await admin
    .from("invitations")
    .select("id, class_ids, enrollment_request_id, consumed_at, revoked_at, token_expires_at, use_access_code")
    .eq("token_hash", tokenHash)
    .eq("channel", "email")
    .eq("purpose", "student_onboarding")
    .maybeSingle();

  if (fetchError) {
    return { error: "Não foi possível processar seu cadastro. Tente novamente." };
  }
  if (!invitation) {
    return { error: "Link inválido. Peça um novo acesso à coordenação." };
  }
  if (invitation.revoked_at) {
    return { error: "Este link foi revogado. Peça um novo acesso à coordenação." };
  }
  if (invitation.consumed_at) {
    return { error: "Este link já foi utilizado. Se você já tem senha, faça login." };
  }
  if (!invitation.token_expires_at || new Date(invitation.token_expires_at).getTime() < Date.now()) {
    return { error: "Este link expirou. Peça um novo acesso à coordenação." };
  }

  // A maioria dos alunos tem e-mail exclusivo e loga normalmente com
  // e-mail+senha. O código de acesso só entra quando o convite foi
  // marcado como exceção (use_access_code) — e-mail já em uso por outra
  // conta, tipicamente de um familiar. Ver migração 00000000000054.
  // Uma pessoa = uma conta: se esta inscrição já tem conta (ou já existe conta com o mesmo e-mail e o mesmo nome),
  // não criamos outra. E-mail dividido com um familiar de nome diferente continua permitido.
  const existing = await findExistingAccountForPerson(admin, {
    enrollmentRequestId: invitation.enrollment_request_id,
    contactEmail,
    names: [parsed.data.fullName],
  });
  if (existing) {
    return { error: ALREADY_HAS_ACCOUNT_MESSAGE };
  }

  const useAccessCode = invitation.use_access_code;
  const accessCode = useAccessCode ? await generateUniqueAccessCode(admin) : null;

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser(
    useAccessCode
      ? {
          phone: accessCode!,
          password: parsed.data.password,
          phone_confirm: true,
          user_metadata: { full_name: parsed.data.fullName, contact_email: contactEmail },
        }
      : {
          email: contactEmail,
          password: parsed.data.password,
          email_confirm: true,
          user_metadata: { full_name: parsed.data.fullName },
        },
  );

  if (createError || !createdUser.user) {
    console.error("Falha ao criar conta no primeiro acesso do aluno:", createError);
    const message = !useAccessCode && createError?.code === "email_exists"
      ? "Este e-mail já está em uso por outra conta. Se for compartilhado com um familiar que já tem cadastro, peça à coordenação para gerar um convite com código de acesso."
      : "Não foi possível criar sua conta agora. Tente novamente em instantes.";
    return { error: message };
  }

  const studentId = createdUser.user.id;
  const nowIso = new Date().toISOString();

  // Só a partir daqui o convite é considerado usado — a conta já existe.
  const { error: consumeError } = await admin
    .from("invitations")
    .update({ consumed_at: nowIso, status: "accepted", accepted_at: nowIso })
    .eq("id", invitation.id)
    .is("consumed_at", null);

  if (consumeError) {
    console.error("Falha ao marcar convite como consumido (conta já criada):", consumeError);
    // O banco recusa quando a inscrição já foi aceita por outro convite (23505): desfaz a conta recém-criada
    // (ainda sem matrícula nem papel) em vez de deixar uma duplicada.
    if (consumeError.code === "23505") {
      await admin.auth.admin.deleteUser(studentId);
      return { error: ALREADY_HAS_ACCOUNT_MESSAGE };
    }
  }

  const { data: role } = await admin.from("roles").select("id").eq("slug", "student").single();
  if (role) {
    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: studentId, role_id: role.id });
    if (roleError && roleError.code !== "23505") {
      console.error("Falha ao conceder papel de aluno:", roleError);
    }
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      email: contactEmail,
      access_code: accessCode,
      onboarding_completed_at: nowIso,
    })
    .eq("id", studentId);

  if (profileError) {
    console.error("Falha ao finalizar profile no primeiro acesso do aluno:", profileError);
  }

  await finalizeStudentEnrollment(admin, studentId, invitation, nowIso);

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword(
    useAccessCode
      ? { phone: accessCode!, password: parsed.data.password }
      : { email: contactEmail, password: parsed.data.password },
  );

  if (signInError) {
    console.error("Falha ao autenticar logo após criar a conta do aluno:", signInError);
  }

  try {
    if (useAccessCode) {
      await sendMail({
        to: contactEmail,
        subject: "Sua conta na Escola Makários está pronta — guarde seu código de acesso",
        html:
          `<p>Olá, ${parsed.data.fullName}!</p>` +
          `<p>Sua conta foi criada com sucesso. Para os próximos acessos, use:</p>` +
          `<p style="font-size:20px;font-weight:700;letter-spacing:1px;">${formatAccessCode(accessCode!)}</p>` +
          `<p>Guarde este código — ele é pessoal e substitui o e-mail como login (o e-mail de contato ` +
          `pode ser o mesmo de outras pessoas da família, por isso cada um tem seu próprio código).</p>` +
          `<p>Escola Makários — Igreja Emaús</p>`,
        text:
          `Olá, ${parsed.data.fullName}!\n\nSua conta foi criada com sucesso. Para os próximos acessos, use ` +
          `o código: ${formatAccessCode(accessCode!)}\n\nGuarde este código — ele é pessoal e substitui o e-mail como login.\n\n` +
          `Escola Makários — Igreja Emaús`,
      });
    } else {
      await sendMail({
        to: contactEmail,
        subject: "Sua conta na Escola Makários está pronta",
        html:
          `<p>Olá, ${parsed.data.fullName}!</p>` +
          `<p>Sua conta foi criada com sucesso. Para os próximos acessos, entre com seu e-mail ` +
          `(${contactEmail}) e a senha que você acabou de criar.</p>` +
          `<p>Escola Makários — Igreja Emaús</p>`,
        text:
          `Olá, ${parsed.data.fullName}!\n\nSua conta foi criada com sucesso. Para os próximos acessos, ` +
          `entre com seu e-mail (${contactEmail}) e a senha que você acabou de criar.\n\n` +
          `Escola Makários — Igreja Emaús`,
      });
    }
  } catch (error) {
    console.error("Falha ao enviar e-mail de confirmação do primeiro acesso do aluno:", error);
  }

  return useAccessCode
    ? { result: { mode: "access_code", accessCode: formatAccessCode(accessCode!) } }
    : { result: { mode: "email" } };
}

export interface LinkStudentInvitationState {
  error?: string;
}

/**
 * Quem já tem conta (ex.: é professor, ou já era aluno de outro volume) não
 * cria outra: prova que é o dono da conta com a senha atual e o convite
 * ADICIONA o perfil de aluno e as matrículas a essa mesma conta. O login
 * continua um só; o app oferece a escolha de perfil (aluno / professor).
 */
export async function linkStudentInvitationToAccount(
  _prevState: LinkStudentInvitationState,
  formData: FormData,
): Promise<LinkStudentInvitationState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!token) return { error: "Link inválido." };
  if (!password) return { error: "Digite a senha da sua conta atual." };

  const admin = createSupabaseAdminClient();

  const ip = await getClientIp();
  if (!(await checkRateLimit(admin, `link-student-invite:${ip}`, 10, 600))) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }

  const { data: invitation } = await admin
    .from("invitations")
    .select("id, email, class_ids, enrollment_request_id, consumed_at, revoked_at, token_expires_at")
    .eq("token_hash", hashInviteToken(token))
    .eq("channel", "email")
    .eq("purpose", "student_onboarding")
    .maybeSingle();

  if (!invitation) return { error: "Link inválido. Peça um novo acesso à coordenação." };
  if (invitation.revoked_at) return { error: "Este link foi revogado. Peça um novo acesso à coordenação." };
  if (invitation.consumed_at) return { error: "Este link já foi utilizado. Faça login normalmente." };
  if (!invitation.token_expires_at || new Date(invitation.token_expires_at).getTime() < Date.now()) {
    return { error: "Este link expirou. Peça um novo acesso à coordenação." };
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, status")
    .ilike("email", escapeIlike(invitation.email));
  const profile = profiles?.length === 1 ? profiles[0] : null;
  if (!profile || !profile.email) {
    return { error: "Não encontramos uma conta única com este e-mail. Fale com a coordenação." };
  }
  if (profile.status !== "active") {
    return { error: "Esta conta está suspensa. Fale com a coordenação." };
  }

  // A senha prova que a pessoa é a dona da conta (e já deixa a sessão aberta).
  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email.trim().toLowerCase(),
    password,
  });
  if (signInError) {
    return {
      error:
        "Senha incorreta. Use a senha da conta que você já tem — se não lembra, use “Esqueci minha senha” na tela de login.",
    };
  }

  const nowIso = new Date().toISOString();
  const { data: claimed } = await admin
    .from("invitations")
    .update({ consumed_at: nowIso, status: "accepted", accepted_at: nowIso })
    .eq("id", invitation.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { error: "Este link já foi utilizado. Faça login normalmente." };

  const { data: role } = await admin.from("roles").select("id").eq("slug", "student").single();
  if (role) {
    const { error: roleError } = await admin.from("user_roles").insert({ user_id: profile.id, role_id: role.id });
    if (roleError && roleError.code !== "23505") {
      console.error("Falha ao conceder papel de aluno à conta existente:", roleError);
    }
  }

  await finalizeStudentEnrollment(admin, profile.id, invitation, nowIso);

  redirect("/dashboard");
}
