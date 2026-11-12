// Garante que a conta por código de acesso tenha o e-mail técnico de login (ver accessCodeLoginEmail).
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { accessCodeLoginEmail, isAccessCode } from "./accessCode";

type Admin = SupabaseClient<Database>;

/**
 * Coloca o e-mail técnico na conta do usuário, se ele ainda não tiver e-mail de login.
 * Só mexe em conta cujo "telefone" é o próprio código. Devolve true quando a conta
 * passou a ter o e-mail técnico agora. Não muda senha nem dado de contato.
 */
export async function attachAccessCodeLoginEmail(admin: Admin, userId: string, code: string): Promise<boolean> {
  if (!isAccessCode(code)) return false;

  const { data, error } = await admin.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user) return false;
  if (user.phone !== code) return false;
  if (user.email) return false;

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    email: accessCodeLoginEmail(code),
    email_confirm: true,
  });
  if (updateError) {
    console.error("Falha ao preparar o login da conta por código:", {
      code: updateError.code,
      status: updateError.status,
      message: updateError.message,
    });
    return false;
  }
  return true;
}

/**
 * Para conta criada antes desta correção: acha a conta pelo código e coloca o
 * e-mail técnico. Devolve true só se a conta foi preparada agora (vale tentar o login de novo).
 */
export async function prepareAccessCodeLogin(admin: Admin, code: string): Promise<boolean> {
  if (!isAccessCode(code)) return false;

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .eq("access_code", code)
    .maybeSingle();
  if (error || !profile) return false;

  return attachAccessCodeLoginEmail(admin, profile.id, code);
}
