"use server";

import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { can, getAuthContext } from "@/authorization";
import { createInvitationSchema } from "../schemas";

export interface CreateInvitationState {
  error?: string;
  success?: boolean;
}

/**
 * Convida um novo usuário. Só admin/coordenação podem chamar esta action
 * — a checagem usa a camada de políticas tipada (não confia em nada vindo
 * do formulário) e é reforçada pela RLS de `invitations`
 * (supabase/migrations/..._rls_invitations.sql), que nega o INSERT mesmo
 * que, por algum bug, esta checagem em código fosse contornada.
 */
export async function createInvitation(
  _prevState: CreateInvitationState,
  formData: FormData,
): Promise<CreateInvitationState> {
  const authContext = await getAuthContext();

  if (!authContext || !can(authContext, { resource: "invitations", action: "create" })) {
    return { error: "Você não tem permissão para convidar usuários." };
  }

  const parsed = createInvitationSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    roleSlug: formData.get("roleSlug"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("slug", parsed.data.roleSlug)
    .single();

  if (roleError || !role) {
    return { error: "Perfil selecionado é inválido." };
  }

  // Escrito com o client autenticado como o próprio ator (não o
  // administrativo) — a RLS de invitations exige invited_by = auth.uid(),
  // então este insert só passa se quem está chamando realmente é
  // admin/coordenação, na própria transação.
  const { error: invitationError } = await supabase.from("invitations").insert({
    email: parsed.data.email,
    intended_role_id: role.id,
    invited_by: authContext.userId,
  });

  if (invitationError) {
    return { error: "Não foi possível registrar o convite." };
  }

  // Disparo do e-mail em si exige privilégio administrativo (Supabase
  // Auth), por isso só aqui — depois que o registro acadêmico já existe —
  // usamos o client administrativo, e só para esta chamada específica.
  const admin = createSupabaseAdminClient();
  const { error: inviteEmailError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { data: { full_name: parsed.data.fullName } },
  );

  if (inviteEmailError) {
    return {
      error: `O convite foi registrado, mas o e-mail não pôde ser enviado: ${inviteEmailError.message}`,
    };
  }

  return { success: true };
}
