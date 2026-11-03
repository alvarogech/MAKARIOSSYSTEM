"use server";

import { revalidatePath } from "next/cache";
import { canAccessArea, getAuthContext } from "@/authorization";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { parseStudentAdjustment } from "../helpRequest";

export interface AdjustmentFormState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** O que o aluno digitou, para não perder tudo quando um campo volta com erro. */
  values?: { problems: string[]; wantedVolume: string; wantedSchedule: string; message: string };
}

/** Pedidos em aberto ao mesmo tempo: o suficiente para corrigir tudo, sem encher a fila da coordenação. */
const MAX_OPEN_REQUESTS = 3;

/**
 * Pedido de ajuste do aluno logado (volume/turma errada, dados errados...).
 * Cai na mesma fila de /coordenacao/ajuda. A identidade vem da sessão: CPF,
 * nome e WhatsApp são os da inscrição ligada à conta dele, nunca digitados.
 */
export async function submitStudentAdjustment(
  _prev: AdjustmentFormState,
  formData: FormData,
): Promise<AdjustmentFormState> {
  const values = {
    problems: formData.getAll("problems").map(String),
    wantedVolume: String(formData.get("wantedVolume") ?? ""),
    wantedSchedule: String(formData.get("wantedSchedule") ?? ""),
    message: String(formData.get("message") ?? ""),
  };

  const auth = await getAuthContext();
  if (!auth) return { error: "Sessão expirada. Entre de novo.", values };
  if (!canAccessArea(auth, "student")) return { error: "Esta área é exclusiva do perfil Aluno.", values };

  const parsed = parseStudentAdjustment(values);
  if (!parsed.ok) return { fieldErrors: parsed.errors, values };

  const admin = createSupabaseAdminClient();

  const { data: registration } = await admin
    .from("enrollment_requests")
    .select("id, full_name, phone, cpf_hash, cpf_last4")
    .eq("student_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!registration) {
    return {
      error:
        "Não encontramos a inscrição ligada à sua conta. Use a página de ajuda (/ajuda) para falar com a coordenação.",
      values,
    };
  }

  const { count: openCount } = await admin
    .from("help_requests")
    .select("id", { count: "exact", head: true })
    .eq("student_id", auth.userId)
    .eq("status", "aberto");
  if ((openCount ?? 0) >= MAX_OPEN_REQUESTS) {
    return {
      error: "Você já tem pedidos aguardando a coordenação. Espere a resposta antes de mandar outro.",
      values,
    };
  }

  const { error } = await admin.from("help_requests").insert({
    full_name: registration.full_name,
    cpf_hash: registration.cpf_hash,
    cpf_last4: registration.cpf_last4,
    phone: registration.phone,
    problems: parsed.data.problems,
    message: parsed.data.message,
    enrollment_request_id: registration.id,
    student_id: auth.userId,
    wanted_volume_slug: parsed.data.wantedVolume,
    wanted_schedule_slug: parsed.data.wantedSchedule,
  });
  if (error) return { error: "Não conseguimos enviar agora. Tente de novo em instantes.", values };

  revalidatePath("/meu-cadastro");
  revalidatePath("/coordenacao/ajuda");
  return { success: true };
}
