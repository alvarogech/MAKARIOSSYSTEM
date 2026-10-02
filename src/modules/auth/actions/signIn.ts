"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loginSchema } from "../schemas";

export interface SignInState {
  error?: string;
}

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  // E-mail (professor/coordenação/admin/aluno antigo) tem "@"; código de
  // acesso (aluno novo, formato MKS-XXXXXX) não tem — nunca os dois ao
  // mesmo tempo, então o formato já diz qual credencial o Supabase espera.
  const credential = parsed.data.identifier.includes("@")
    ? { email: parsed.data.identifier.trim().toLowerCase() }
    : { phone: parsed.data.identifier.trim().toUpperCase() };

  const { error } = await supabase.auth.signInWithPassword({
    ...credential,
    password: parsed.data.password,
  });

  if (error) {
    // Mensagem genérica de propósito — nunca revela se a credencial existe
    // ou não, só se a combinação com a senha está correta.
    return { error: "E-mail/código de acesso ou senha inválidos." };
  }

  redirect("/dashboard");
}
