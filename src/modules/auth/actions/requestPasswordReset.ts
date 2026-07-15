"use server";

import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { requestPasswordResetSchema } from "../schemas";

export interface RequestPasswordResetState {
  error?: string;
  success?: boolean;
}

export async function requestPasswordReset(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const env = getPublicEnv();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback?next=/redefinir-senha`,
  });

  // Sempre responde com sucesso, mesmo se o e-mail não existir na base —
  // evita que a tela seja usada para descobrir quais e-mails têm conta.
  return { success: true };
}
