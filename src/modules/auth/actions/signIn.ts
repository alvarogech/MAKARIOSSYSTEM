"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loginSchema } from "../schemas";
import { accessCodeLoginEmail, normalizeAccessCode } from "../accessCode";
import { prepareAccessCodeLogin } from "../accessCodeLogin";

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
  const password = parsed.data.password;
  // E-mail (professor/coordenação/admin/maioria dos alunos) tem "@"; código de
  // acesso (aluno que divide o e-mail com um familiar, formato 999-123-456) não tem.
  // O código aceita "-" ou espaços na digitação.
  const isEmail = parsed.data.identifier.includes("@");
  // A conta por código entra pelo e-mail técnico dela: o login por telefone do
  // Supabase depende do provedor Phone, que fica desligado no projeto.
  const code = isEmail ? "" : normalizeAccessCode(parsed.data.identifier);
  const email = isEmail ? parsed.data.identifier.trim().toLowerCase() : accessCodeLoginEmail(code);

  let { error } = await supabase.auth.signInWithPassword({ email, password });

  // Conta por código criada antes desta correção ainda não tem o e-mail técnico:
  // prepara a conta (sem tocar na senha) e tenta de novo, uma vez só.
  if (error && !isEmail) {
    let prepared = false;
    try {
      prepared = await prepareAccessCodeLogin(createSupabaseAdminClient(), code);
    } catch (prepareError) {
      console.error("Falha ao preparar o login por código:", prepareError);
    }
    if (prepared) {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    }
  }

  if (error) {
    // Só código e mensagem do Supabase vão para o log do servidor (nunca e-mail, código de acesso nem senha).
    console.error("Falha no login:", {
      via: isEmail ? "email" : "codigo",
      code: error.code,
      status: error.status,
      message: error.message,
    });
    // Mensagem genérica de propósito — nunca revela se a credencial existe
    // ou não, só se a combinação com a senha está correta.
    return { error: "E-mail/código de acesso ou senha inválidos." };
  }

  redirect("/dashboard");
}
