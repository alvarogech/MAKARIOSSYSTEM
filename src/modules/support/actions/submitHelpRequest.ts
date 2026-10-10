"use server";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { checkRateLimit, getClientIp } from "@/modules/auth/rateLimit";
import { hashCpf } from "@/modules/enrollment/dataProtection";
import { parseHelpRequest } from "../helpRequest";

export interface HelpFormState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** O que a pessoa digitou, para não perder tudo quando um campo volta com erro. */
  values?: { fullName: string; cpf: string; phone: string; problems: string[]; message: string };
}

/**
 * Pedido de ajuda da página pública /ajuda (sem login). Grava com a chave do
 * servidor, depois de validar; o CPF vira só o hash (para ligar à inscrição)
 * e os 4 últimos dígitos. A resposta é a mesma achando ou não a inscrição,
 * para a página não servir de consulta de "este CPF está inscrito?".
 */
export async function submitHelpRequest(_prev: HelpFormState, formData: FormData): Promise<HelpFormState> {
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    cpf: String(formData.get("cpf") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    problems: formData.getAll("problems").map(String),
    message: String(formData.get("message") ?? ""),
  };
  const parsed = parseHelpRequest(values);
  if (!parsed.ok) return { fieldErrors: parsed.errors, values };

  const admin = createSupabaseAdminClient();
  const ip = await getClientIp();
  // Folgado de propósito: na escola, muita gente manda do mesmo Wi-Fi.
  if (!(await checkRateLimit(admin, `ajuda:${ip}`, 30, 600))) {
    return { error: "Muitos pedidos enviados daqui em pouco tempo. Espere alguns minutos e tente de novo.", values };
  }

  const cpfHash = hashCpf(parsed.data.cpf);
  const { data: requests } = await admin
    .from("enrollment_requests")
    .select("id, status")
    .eq("cpf_hash", cpfHash)
    .in("status", ["approved", "pending"])
    .order("created_at", { ascending: false })
    .limit(10);
  const linked = (requests ?? []).find((r) => r.status === "approved") ?? requests?.[0] ?? null;

  const { error } = await admin.from("help_requests").insert({
    full_name: parsed.data.fullName,
    cpf_hash: cpfHash,
    cpf_last4: parsed.data.cpf.slice(-4),
    phone: parsed.data.phone,
    problems: parsed.data.problems,
    message: parsed.data.message,
    enrollment_request_id: linked?.id ?? null,
  });
  if (error) return { error: "Não conseguimos enviar agora. Tente de novo em instantes.", values };

  return { success: true };
}
