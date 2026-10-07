"use server";

import { revalidatePath } from "next/cache";
import { can, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export interface RequestState {
  error?: string;
  success?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O aluno pede que aulas de um encontro que já aconteceu constem como presença, explicando o motivo. */
export async function submitAttendanceRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Sessão expirada. Entre de novo." };

  const meetingId = String(formData.get("meetingId") ?? "");
  if (!UUID.test(meetingId)) return { error: "Encontro inválido." };
  const lessons = [...new Set(formData.getAll("lessons").map((v) => Number(v)))].filter((n) => Number.isInteger(n) && n > 0);
  if (lessons.length === 0) return { error: "Marque pelo menos uma aula." };
  const justification = String(formData.get("justification") ?? "").trim();
  if (justification.length < 10) return { error: "Explique em pelo menos 10 caracteres por que a presença deve constar." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("request_attendance", {
    p_meeting_id: meetingId,
    p_lessons: lessons,
    p_justification: justification,
  });
  if (error) return { error: error.message };

  revalidatePath("/minha-frequencia");
  revalidatePath("/coordenacao/presenca");
  return { success: "Pedido enviado. A coordenação vai analisar e você vê a resposta aqui." };
}

export async function cancelAttendanceRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Sessão expirada. Entre de novo." };
  const id = String(formData.get("requestId") ?? "");
  if (!UUID.test(id)) return { error: "Pedido inválido." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_attendance_request", { p_request_id: id });
  if (error) return { error: error.message };

  revalidatePath("/minha-frequencia");
  return { success: "Pedido cancelado." };
}

/** Só o administrador decide: aprovar passa a contar na frequência; recusar guarda o motivo para o aluno ver. */
export async function decideAttendanceRequests(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "attendance", action: "backfill" })) {
    return { error: "Apenas o administrador pode aprovar ou recusar pedidos de presença." };
  }

  const ids = formData.getAll("ids").map(String).filter((id) => UUID.test(id));
  if (ids.length === 0) return { error: "Selecione pelo menos um pedido." };
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (decision !== "approved" && decision !== "rejected" && decision !== "reopen") return { error: "Decisão inválida." };
  if (note.length > 500) return { error: "A observação pode ter até 500 caracteres." };

  const supabase = await createSupabaseServerClient();
  const patch =
    decision === "reopen"
      ? { status: "pending", decided_by: null, decided_at: null, decision_note: null }
      : { status: decision, decided_by: auth.userId, decided_at: new Date().toISOString(), decision_note: note || null };
  const { data, error } = await supabase.from("attendance_requests").update(patch).in("id", ids).select("id");
  if (error) return { error: "Não foi possível salvar a decisão." };

  revalidatePath("/coordenacao/presenca");
  revalidatePath("/minha-frequencia");
  revalidatePath("/dashboard");
  const label = decision === "approved" ? "aprovado(s)" : decision === "rejected" ? "recusado(s)" : "reaberto(s)";
  return { success: `${data?.length ?? 0} pedido(s) ${label}.` };
}
