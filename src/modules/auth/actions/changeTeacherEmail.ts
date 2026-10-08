"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, getAuthContext } from "@/authorization";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export interface ChangeTeacherEmailState {
  error?: string;
  success?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Troca o e-mail de login de um professor ATIVO (só o administrador). A senha continua a mesma; a pessoa passa a entrar
 * com o novo e-mail. Se vier `invitationId` (convite repetido com o e-mail novo), esse convite é revogado junto.
 * Não vale para conta de aluno e nunca aceita um e-mail que já pertença a outra conta.
 */
export async function changeTeacherLoginEmail(_prev: ChangeTeacherEmailState, formData: FormData): Promise<ChangeTeacherEmailState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "teacher_profile", action: "edit" })) {
    return { error: "Somente o administrador troca o e-mail de login." };
  }

  const userId = String(formData.get("userId") ?? "");
  if (!UUID.test(userId)) return { error: "Professor inválido." };

  const parsed = z.string().trim().toLowerCase().email().max(200).safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) return { error: "Informe um e-mail válido." };
  const email = parsed.data;

  const invitationIdRaw = String(formData.get("invitationId") ?? "");
  const invitationId = UUID.test(invitationIdRaw) ? invitationIdRaw : null;

  const supabase = await createSupabaseServerClient();

  const { data: teacherRole } = await supabase.from("roles").select("id").eq("slug", "teacher").single();
  const { data: isTeacher } = teacherRole
    ? await supabase.from("user_roles").select("user_id").eq("user_id", userId).eq("role_id", teacherRole.id).maybeSingle()
    : { data: null };
  if (!isTeacher) return { error: "Este usuário não é professor." };

  const { data: current } = await supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
  if (!current) return { error: "Professor não encontrado." };
  if ((current.email ?? "").toLowerCase() === email) return { error: "Este já é o e-mail de login dessa pessoa." };

  const { data: clash } = await supabase.from("profiles").select("id").ilike("email", email).neq("id", userId).limit(1);
  if (clash?.length) return { error: "Já existe outra conta com este e-mail." };

  // Outro convite pendente com este e-mail (que não seja o que estamos resolvendo) pode confundir: peça para revogar antes.
  const { data: pending } = await supabase
    .from("invitations")
    .select("id")
    .ilike("email", email)
    .is("consumed_at", null)
    .is("revoked_at", null)
    .limit(5);
  if ((pending ?? []).some((row) => row.id !== invitationId)) {
    return { error: "Há outro convite pendente com este e-mail. Revogue-o antes." };
  }

  const admin = createSupabaseAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (authError) return { error: "Não foi possível trocar o e-mail de login. Tente de novo." };

  const { data: updated, error: profileError } = await supabase.from("profiles").update({ email }).eq("id", userId).select("id").maybeSingle();
  if (profileError || !updated) {
    // Mantém login e cadastro iguais: desfaz a troca no acesso.
    if (current.email) await admin.auth.admin.updateUserById(userId, { email: current.email, email_confirm: true });
    return { error: "Não foi possível salvar o cadastro; o e-mail de login não foi alterado." };
  }

  if (invitationId) {
    await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString(), revoked_by: auth.userId })
      .eq("id", invitationId)
      .eq("channel", "manual_link")
      .is("consumed_at", null)
      .is("revoked_at", null);
  }

  await supabase.rpc("audit_admin_action", {
    p_action: "CHANGE_LOGIN_EMAIL",
    p_entity: "profiles",
    p_entity_id: userId,
    p_detail: { name: current.full_name, from: current.email, to: email },
  });

  revalidatePath("/coordenacao/qualidade-dados");
  revalidatePath("/coordenacao/professores");
  return { success: `E-mail de login trocado para ${email}. A senha é a mesma de antes.` };
}
