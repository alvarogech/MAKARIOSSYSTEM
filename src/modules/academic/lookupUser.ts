import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { RoleSlug } from "@/authorization";

/**
 * Localiza um usuário por e-mail que já possua um perfil (role) específico
 * — usado para designar professor a uma turma ou matricular aluno a
 * partir do e-mail, sem precisar do client administrativo (a leitura
 * passa pelas mesmas policies de RLS de `profiles`/`roles`/`user_roles`
 * de quem está chamando).
 */
export async function findUserIdByEmailAndRole(
  supabase: SupabaseClient<Database>,
  email: string,
  roleSlug: RoleSlug,
): Promise<{ userId: string; fullName: string } | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("slug", roleSlug)
    .single();

  if (!role) {
    return null;
  }

  const { data: userRole } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", profile.id)
    .eq("role_id", role.id)
    .maybeSingle();

  if (!userRole) {
    return null;
  }

  return { userId: profile.id, fullName: profile.full_name };
}
