"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";

/**
 * Marca uma inscrição como visualizada, na primeira vez que alguém da
 * coordenação abre os detalhes. Visualização é global (não por usuário) e
 * nunca sobrescreve um `viewed_at` já existente — sempre reflete a
 * primeira abertura, não a mais recente. Falha silenciosa de propósito:
 * visualização é um detalhe operacional, nunca deve travar quem só quer
 * ver a inscrição.
 */
export async function markEnrollmentRequestViewed(id: string): Promise<void> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollment_requests", action: "manage" })) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("enrollment_requests")
    .update({ viewed_at: new Date().toISOString(), viewed_by: authContext.userId })
    .eq("id", id)
    .is("viewed_at", null);

  if (!error) {
    revalidatePath("/coordenacao/inscricoes");
  }
}
