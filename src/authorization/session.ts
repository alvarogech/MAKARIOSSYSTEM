import "server-only";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import type { AuthContext, RoleSlug } from "./types";

export const ACTIVE_ROLE_COOKIE = "makarios_active_role";

/**
 * Constrói o `AuthContext` da requisição atual inteiramente a partir de
 * dados lidos no servidor: sessão do Supabase Auth, `profiles.status` e os
 * perfis que o usuário de fato possui em `user_roles` (nunca a partir de
 * algo que o cliente possa declarar sem checagem). O cookie de perfil
 * ativo é apenas uma preferência de navegação — `can()`/`canAccessArea()`
 * sempre revalidam que o perfil ativo está entre os perfis reais do
 * usuário antes de conceder qualquer permissão (ver
 * `src/authorization/policies.ts`).
 *
 * Retorna `null` quando não há usuário autenticado.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: userRoleRows } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id);

  const roleIds = (userRoleRows ?? []).map((row) => row.role_id);

  let roles: RoleSlug[] = [];
  if (roleIds.length > 0) {
    const { data: roleRows } = await supabase
      .from("roles")
      .select("slug")
      .in("id", roleIds);
    roles = (roleRows ?? []).map((row) => row.slug);
  }

  const cookieStore = await cookies();
  const cookieRole = cookieStore.get(ACTIVE_ROLE_COOKIE)?.value as
    | RoleSlug
    | undefined;

  const activeRole = resolveActiveRole(roles, cookieRole);

  return {
    userId: user.id,
    fullName: profile?.full_name ?? user.email ?? "Usuário",
    // Sem profile encontrado é tratado como suspenso (fail closed) — não
    // deveria acontecer em uso normal, já que `handle_new_user` sempre cria
    // o profile junto com auth.users.
    profileStatus: profile?.status ?? "suspended",
    roles,
    activeRole,
  };
}

/**
 * Regra de resolução do perfil ativo:
 *  - se existe um cookie e ele corresponde a um perfil que o usuário
 *    realmente possui, usa esse;
 *  - senão, se o usuário só tem um perfil possível, usa esse (não faz
 *    sentido pedir seleção quando não há escolha);
 *  - senão (0 ou 2+ perfis sem cookie válido), retorna `null` — a UI deve
 *    redirecionar para a seleção de perfil.
 */
export function resolveActiveRole(
  roles: RoleSlug[],
  cookieRole: RoleSlug | undefined,
): RoleSlug | null {
  if (cookieRole && roles.includes(cookieRole)) {
    return cookieRole;
  }

  if (roles.length === 1) {
    return roles[0] ?? null;
  }

  return null;
}
