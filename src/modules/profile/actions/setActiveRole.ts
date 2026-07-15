"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_ROLE_COOKIE, getAuthContext } from "@/authorization";
import type { RoleSlug } from "@/authorization";

export interface SetActiveRoleState {
  error?: string;
}

const VALID_ROLES: RoleSlug[] = [
  "student",
  "teacher",
  "coordinator",
  "admin",
  "content_editor",
];

/**
 * Define o perfil ativo da sessão. Nunca aceita um perfil que a conta não
 * possua de fato — `roles` vem de uma leitura fresca do banco
 * (getAuthContext), não do formulário, então mesmo um POST manipulado só
 * consegue ativar um perfil que o usuário realmente tem em user_roles.
 */
export async function setActiveRole(
  _prevState: SetActiveRoleState,
  formData: FormData,
): Promise<SetActiveRoleState> {
  const requested = formData.get("roleSlug");

  if (typeof requested !== "string" || !VALID_ROLES.includes(requested as RoleSlug)) {
    return { error: "Perfil inválido." };
  }

  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  if (!authContext.roles.includes(requested as RoleSlug)) {
    return { error: "Esta conta não possui o perfil selecionado." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ROLE_COOKIE, requested, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/dashboard");
}
