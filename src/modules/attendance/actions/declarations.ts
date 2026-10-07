"use server";

import { revalidatePath } from "next/cache";
import { can, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export interface DeclarationState {
  error?: string;
  success?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O aluno responde "estive / não estive" e marca as aulas. Conferência de turma, prazo e resposta única fica no banco. */
export async function submitDeclaration(_prev: DeclarationState, formData: FormData): Promise<DeclarationState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Sessão expirada. Entre de novo." };

  const meetingId = String(formData.get("meetingId") ?? "");
  if (!UUID.test(meetingId)) return { error: "Pedido inválido." };
  const attended = formData.get("attended") === "yes";
  const lessons = attended
    ? [...new Set(formData.getAll("lessons").map((v) => Number(v)))].filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (attended && lessons.length === 0) return { error: "Marque pelo menos uma aula em que você esteve." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("declare_attendance", { p_meeting_id: meetingId, p_lessons: lessons });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/minha-frequencia");
  return { success: true };
}

/** Coordenação: valida, revoga ou reabre (apaga a resposta para o aluno responder de novo) em lote. */
export async function reviewDeclarations(_prev: DeclarationState, formData: FormData): Promise<DeclarationState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "attendance", action: "correct" })) {
    return { error: "Você não tem permissão para revisar autodeclarações." };
  }

  const action = String(formData.get("action") ?? "");
  const ids = formData.getAll("ids").map(String).filter((id) => UUID.test(id));
  if (ids.length === 0) return { error: "Selecione pelo menos uma autodeclaração." };

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (action === "reopen") {
    const { error } = await supabase.from("attendance_declarations").delete().in("id", ids);
    if (error) return { error: "Não foi possível reabrir." };
  } else if (action === "validate" || action === "revoke") {
    const { error } = await supabase
      .from("attendance_declarations")
      .update({ status: action === "validate" ? "validated" : "revoked", reviewed_by: auth.userId, reviewed_at: now })
      .in("id", ids);
    if (error) return { error: "Não foi possível salvar." };
  } else {
    return { error: "Ação inválida." };
  }

  revalidatePath("/coordenacao/presenca");
  return { success: true };
}

/** Abre (ou atualiza o prazo de) a janela de autodeclaração de um encontro; ou a encerra. */
export async function setDeclarationWindow(_prev: DeclarationState, formData: FormData): Promise<DeclarationState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "attendance", action: "correct" })) {
    return { error: "Você não tem permissão para abrir janelas de autodeclaração." };
  }

  const meetingId = String(formData.get("meetingId") ?? "");
  if (!UUID.test(meetingId)) return { error: "Escolha o encontro." };
  const supabase = await createSupabaseServerClient();

  if (formData.get("close") === "1") {
    const { error } = await supabase.from("attendance_declaration_windows").update({ enabled: false }).eq("meeting_id", meetingId);
    if (error) return { error: "Não foi possível encerrar." };
  } else {
    const until = String(formData.get("until") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return { error: "Informe a data-limite." };
    const { error } = await supabase.from("attendance_declaration_windows").upsert(
      { meeting_id: meetingId, closes_at: `${until}T23:59:59-03:00`, enabled: true, created_by: auth.userId },
      { onConflict: "meeting_id" },
    );
    if (error) return { error: "Não foi possível abrir a janela." };
  }

  revalidatePath("/coordenacao/presenca");
  revalidatePath("/dashboard");
  return { success: true };
}
