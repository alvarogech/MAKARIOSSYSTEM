"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export interface ChallengeState {
  error?: string;
  practiced?: boolean;
  saved?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Marca o desafio prático como feito ("Pratiquei") e, se a pessoa quiser, guarda uma
 * nota PRIVADA. Só a própria pessoa lê essa linha (RLS sem política para equipe) e o
 * texto não passa por log nem auditoria. Marcar não exige escrever nada.
 */
export async function practiceChallenge(_prev: ChallengeState, formData: FormData): Promise<ChallengeState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Sessão expirada. Entre de novo." };

  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const challengeId = String(formData.get("challengeId") ?? "");
  const intent = String(formData.get("intent") ?? "practice");
  if (!UUID.test(enrollmentId) || !UUID.test(challengeId)) return { error: "Pedido inválido." };

  const supabase = await createSupabaseServerClient();

  if (intent === "undo") {
    const { error } = await supabase
      .from("challenge_completions")
      .delete()
      .eq("enrollment_id", enrollmentId)
      .eq("challenge_id", challengeId);
    if (error) return { error: "Não foi possível desmarcar agora." };
    revalidatePath("/meu-aprendizado");
    return { practiced: false };
  }

  const rawNote = String(formData.get("note") ?? "").trim();
  if (rawNote.length > 2000) return { error: "A nota pode ter até 2000 caracteres." };

  const { error } = await supabase.from("challenge_completions").upsert(
    {
      enrollment_id: enrollmentId,
      challenge_id: challengeId,
      // `undefined` mantém a nota que já existia quando só se está marcando "Pratiquei".
      ...(intent === "note" || rawNote ? { private_note: rawNote || null } : {}),
    },
    { onConflict: "enrollment_id,challenge_id" },
  );
  if (error) return { error: "Não foi possível salvar agora. Tente de novo." };

  revalidatePath("/meu-aprendizado");
  return { practiced: true, saved: intent === "note" };
}
