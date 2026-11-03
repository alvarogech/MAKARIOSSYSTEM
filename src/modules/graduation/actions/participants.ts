"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { MIN_ATTENDANCE_RATIO } from "@/modules/attendance/progress";
import { evaluateStudent } from "../eligibility";
import { loadStudentFacts } from "../facts";
import { requireGraduation, UUID, type GraduationState } from "../guard";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function refresh() {
  revalidatePath("/coordenacao/formatura", "layout");
}

/**
 * Convida alunos aptos. A aptidão é RECALCULADA aqui, no servidor, no momento do
 * convite: quem não estiver apto não é convidado, mesmo que a tela mostrasse outra
 * coisa. Convites condicionais não existem.
 */
export async function inviteApt(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("configure");
  if ("error" in guard) return { error: guard.error };
  const editionId = text(formData, "editionId");
  if (!UUID.test(editionId)) return { error: "Edição inválida." };
  const requested = formData.getAll("studentIds").map(String).filter((id) => UUID.test(id));
  const everyone = formData.get("todosAptos") === "1";

  const supabase = await createSupabaseServerClient();
  const { data: participants } = await supabase.from("graduation_participants").select("student_id, invited_at").eq("edition_id", editionId);
  const pool = (participants ?? []).filter((p) => !p.invited_at).map((p) => p.student_id);
  const targets = everyone ? pool : pool.filter((id) => requested.includes(id));
  if (targets.length === 0) return { error: "Nenhum aluno elegível para convite foi selecionado (quem já foi convidado fica de fora)." };

  const facts = await loadStudentFacts(supabase, targets);
  const now = new Date();
  const apt: string[] = [];
  const skipped: string[] = [];
  for (const id of targets) {
    const f = facts.get(id);
    const e = f ? evaluateStudent(f, { now, minAttendanceRatio: MIN_ATTENDANCE_RATIO }) : null;
    if (e?.overall === "apto") apt.push(id);
    else skipped.push(f?.fullName ?? id);
  }
  if (apt.length === 0) return { error: `Nenhum dos selecionados está apto agora: ${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? "…" : ""}.` };

  const { error } = await supabase
    .from("graduation_participants")
    .update({ invited_at: now.toISOString(), invited_by: guard.auth.userId, invited_status: "apto" })
    .eq("edition_id", editionId)
    .in("student_id", apt)
    .is("invited_at", null);
  if (error) return { error: "Não foi possível registrar os convites." };

  refresh();
  const skip = skipped.length > 0 ? ` ${skipped.length} não estavam aptos e ficaram de fora.` : "";
  return { success: `${apt.length} aluno(s) convidado(s). Eles só verão o convite depois que a cerimônia for publicada.${skip}` };
}

export async function withdrawInvite(formData: FormData): Promise<void> {
  const guard = await requireGraduation("configure");
  if ("error" in guard) return;
  const editionId = text(formData, "editionId");
  const studentId = text(formData, "studentId");
  if (!UUID.test(editionId) || !UUID.test(studentId)) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("graduation_participants")
    .update({ invited_at: null, invited_by: null, invited_status: null, response: "sem_resposta", responded_at: null, response_source: null, response_channel: null, response_recorded_by: null })
    .eq("edition_id", editionId)
    .eq("student_id", studentId);
  refresh();
}

const CHANNELS = ["whatsapp", "presencial", "telefone", "outro"] as const;

/** Resposta recebida fora da plataforma (WhatsApp, pessoalmente). Fica marcada com quem registrou e por qual canal. */
export async function recordRsvp(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("record_rsvp");
  if ("error" in guard) return { error: guard.error };
  const editionId = text(formData, "editionId");
  const studentId = text(formData, "studentId");
  const response = text(formData, "response");
  const channel = text(formData, "channel");
  if (!UUID.test(editionId) || !UUID.test(studentId)) return { error: "Dados inválidos." };
  if (response !== "confirmado" && response !== "nao_comparece") return { error: "Escolha a resposta do aluno." };
  if (!(CHANNELS as readonly string[]).includes(channel)) return { error: "Informe por qual canal a resposta chegou." };

  const supabase = await createSupabaseServerClient();
  const { data: p } = await supabase.from("graduation_participants").select("invited_at, response").eq("edition_id", editionId).eq("student_id", studentId).maybeSingle();
  if (!p?.invited_at) return { error: "Este aluno ainda não foi convidado." };
  const { data: edition } = await supabase.from("graduation_editions").select("status").eq("id", editionId).maybeSingle();
  if (edition?.status === "arquivada") return { error: "A edição está arquivada." };
  if (p.response === response) return { success: "Essa resposta já estava registrada." };

  const { error } = await supabase
    .from("graduation_participants")
    .update({ response, responded_at: new Date().toISOString(), response_source: "coordenacao", response_channel: channel, response_recorded_by: guard.auth.userId })
    .eq("edition_id", editionId)
    .eq("student_id", studentId);
  if (error) return { error: "Não foi possível registrar a resposta." };
  refresh();
  return { success: "Resposta registrada." };
}

/** Comparecimento REAL no dia. Separado da confirmação antecipada. */
export async function recordCeremonyAttendance(formData: FormData): Promise<void> {
  const guard = await requireGraduation("record_rsvp");
  if ("error" in guard) return;
  const editionId = text(formData, "editionId");
  const studentId = text(formData, "studentId");
  const value = text(formData, "value");
  if (!UUID.test(editionId) || !UUID.test(studentId)) return;
  if (!["compareceu", "nao_compareceu", "nao_registrado"].includes(value)) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("graduation_participants")
    .update({
      ceremony_attendance: value,
      attendance_recorded_at: value === "nao_registrado" ? null : new Date().toISOString(),
      attendance_recorded_by: value === "nao_registrado" ? null : guard.auth.userId,
    })
    .eq("edition_id", editionId)
    .eq("student_id", studentId)
    .not("invited_at", "is", null);
  refresh();
}

/** Conferência do nome que será impresso no certificado. */
export async function confirmCertificateName(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("configure");
  if ("error" in guard) return { error: guard.error };
  const editionId = text(formData, "editionId");
  const studentId = text(formData, "studentId");
  const name = text(formData, "certificateName").replace(/\s+/g, " ");
  if (!UUID.test(editionId) || !UUID.test(studentId)) return { error: "Dados inválidos." };
  if (name.length < 3 || name.length > 160) return { error: "O nome para o certificado deve ter de 3 a 160 caracteres." };
  if (name.split(" ").length < 2) return { error: "Informe o nome completo (nome e sobrenome)." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("graduation_participants")
    .update({ certificate_name: name, certificate_name_checked_at: new Date().toISOString(), certificate_name_checked_by: guard.auth.userId })
    .eq("edition_id", editionId)
    .eq("student_id", studentId);
  if (error) return { error: "Não foi possível salvar o nome." };
  refresh();
  return { success: "Nome conferido." };
}
