"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createTeacherInvitationSchema } from "../schemas";
import { escapeIlike, findExistingAccountByEmail, normalizeEmail } from "../lookupTeacherCandidate";
import { createManualTeacherInvitationRow } from "../manualInvite";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface CreateTeacherInvitationState {
  error?: string;
  result?:
    | { kind: "link_created"; link: string; whatsappMessage: string; fullName: string }
    | { kind: "role_granted_existing"; fullName: string }
    | { kind: "already_teacher"; fullName: string };
}

async function linkClassesToTeacher(
  supabase: SupabaseClient<Database>,
  teacherId: string,
  classIds: string[],
) {
  // teacher_assignments_class_wide_unique é um índice único PARCIAL (só
  // quando meeting_id é nulo), então não dá pra usar upsert com onConflict
  // simples — insere um por um e ignora 23505 (vínculo já existente), igual
  // ao padrão já usado em assignTeacher.ts.
  for (const classId of classIds) {
    const { error } = await supabase.from("teacher_assignments").insert({
      teacher_id: teacherId,
      class_id: classId,
      function: "regente",
    });
    if (error && error.code !== "23505") {
      throw new Error(`Não foi possível vincular a turma ${classId}.`);
    }
  }
}

export async function createTeacherInvitation(
  _prevState: CreateTeacherInvitationState,
  formData: FormData,
): Promise<CreateTeacherInvitationState> {
  const authContext = await getAuthContext();
  if (
    !authContext ||
    !can(authContext, { resource: "teacher_provisioning", action: "manage" })
  ) {
    return { error: "Você não tem permissão para cadastrar professores." };
  }

  const classIds = formData.getAll("classIds").map(String).filter(Boolean);
  const parsed = createTeacherInvitationSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    classIds,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const email = normalizeEmail(parsed.data.email);

  const existing = await findExistingAccountByEmail(supabase, email);

  if (existing) {
    if (existing.isTeacher) {
      return { result: { kind: "already_teacher", fullName: existing.fullName } };
    }

    // Conta existe (ex.: aluno) mas ainda não é professor — concede o papel
    // diretamente. NUNCA mexe em senha/sessão de uma conta que já tem
    // credenciais próprias (seção 4) — só a autorização acadêmica.
    const { data: teacherRole } = await supabase
      .from("roles")
      .select("id")
      .eq("slug", "teacher")
      .single();

    if (!teacherRole) {
      return { error: "Papel 'Professor' não encontrado no sistema." };
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: existing.userId, role_id: teacherRole.id });

    // 23505 = já tinha o papel (corrida/clique duplo) — trata como sucesso.
    if (roleError && roleError.code !== "23505") {
      return { error: "Não foi possível conceder o papel de professor." };
    }

    try {
      await linkClassesToTeacher(supabase, existing.userId, parsed.data.classIds);
    } catch {
      revalidatePath("/coordenacao/professores");
      return {
        error:
          `O papel de professor foi concedido a ${existing.fullName}, mas não foi ` +
          "possível vincular todas as turmas selecionadas. Vincule pela tela de Turmas.",
      };
    }

    revalidatePath("/coordenacao/professores");
    return { result: { kind: "role_granted_existing", fullName: existing.fullName } };
  }

  // Nenhuma conta existe ainda: só registra a intenção (invitations +
  // nosso token). A conta no Supabase Auth só é criada quando o professor
  // efetivamente aceitar (ver acceptTeacherInvitation) — nada de conta
  // "fantasma" para convite nunca concluído.
  const { data: existingPending } = await supabase
    .from("invitations")
    .select("id")
    .eq("channel", "manual_link")
    .eq("purpose", "teacher_onboarding")
    .ilike("email", escapeIlike(email))
    .is("consumed_at", null)
    .is("revoked_at", null)
    .gt("token_expires_at", new Date().toISOString())
    .maybeSingle();

  if (existingPending) {
    return {
      error:
        "Já existe um convite pendente para este e-mail. Revogue-o ou use " +
        "\"Gerar novo convite\" na lista — o anterior é invalidado automaticamente.",
    };
  }

  const { data: teacherRole } = await supabase
    .from("roles")
    .select("id")
    .eq("slug", "teacher")
    .single();

  if (!teacherRole) {
    return { error: "Papel 'Professor' não encontrado no sistema." };
  }

  const created = await createManualTeacherInvitationRow(supabase, {
    email,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
    classIds: parsed.data.classIds,
    invitedBy: authContext.userId,
    teacherRoleId: teacherRole.id,
  });

  if ("dbError" in created) {
    return { error: "Não foi possível gerar o convite." };
  }

  revalidatePath("/coordenacao/professores");

  return {
    result: {
      kind: "link_created",
      link: created.link,
      whatsappMessage: created.whatsappMessage,
      fullName: parsed.data.fullName,
    },
  };
}
