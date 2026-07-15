"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { setPasswordSchema } from "../schemas";

export interface UpdatePasswordState {
  error?: string;
}

/**
 * Usado tanto no primeiro acesso (após aceitar o convite) quanto na
 * redefinição de senha (após clicar no link de recuperação) — em ambos os
 * casos, o clique no link do Supabase Auth já estabeleceu uma sessão
 * válida (trocada em /api/auth/callback); esta action só define a nova
 * senha nessa sessão.
 */
export async function updatePassword(
  _prevState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptedTerms: formData.get("acceptedTerms") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Sessão expirada ou link inválido. Solicite um novo link e tente novamente.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Não foi possível definir a senha. Tente novamente." };
  }

  redirect("/dashboard");
}
