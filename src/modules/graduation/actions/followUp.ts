"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { CONTACT_STATUSES, type ContactStatus } from "../boardView";
import { requireGraduation, UUID, type GraduationState } from "../guard";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const orNull = (value: string) => (value === "" ? null : value);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^(geral|(essencia|caminho|voz):[a-z]+|cadastro:[a-z]+)$/;
const CHANNELS = ["whatsapp", "telefone", "presencial", "email", "outro"] as const;

function refresh() {
  revalidatePath("/coordenacao/formatura", "layout");
}

interface FollowUpInput {
  editionId: string;
  studentId: string;
  requirementKey: string;
  status: ContactStatus;
  responsibleId: string | null;
  nextStep: string | null;
  dueDate: string | null;
  notes: string | null;
}

function readFollowUp(formData: FormData): FollowUpInput | { error: string } {
  const editionId = text(formData, "editionId");
  const studentId = text(formData, "studentId");
  const requirementKey = text(formData, "requirementKey") || "geral";
  const status = text(formData, "contactStatus") as ContactStatus;
  const responsibleId = orNull(text(formData, "responsibleId"));
  const dueDate = orNull(text(formData, "dueDate"));
  if (!UUID.test(editionId) || !UUID.test(studentId)) return { error: "Dados inválidos." };
  if (!KEY.test(requirementKey)) return { error: "Pendência inválida." };
  if (!(CONTACT_STATUSES as readonly string[]).includes(status)) return { error: "Escolha a situação do contato." };
  if (responsibleId && !UUID.test(responsibleId)) return { error: "Responsável inválido." };
  if (dueDate && !DATE.test(dueDate)) return { error: "Prazo inválido." };
  const nextStep = orNull(text(formData, "nextStep"));
  const notes = orNull(text(formData, "notes"));
  if (nextStep && nextStep.length > 500) return { error: "A próxima providência passou de 500 caracteres." };
  if (notes && notes.length > 2000) return { error: "As observações passaram de 2.000 caracteres." };
  return { editionId, studentId, requirementKey, status, responsibleId, nextStep, dueDate, notes };
}

/** Atualiza o acompanhamento (operacional) do aluno ou de uma pendência. Não muda a situação acadêmica. */
export async function saveFollowUp(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("contact");
  if ("error" in guard) return { error: guard.error };
  const input = readFollowUp(formData);
  if ("error" in input) return { error: input.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("graduation_follow_ups").upsert(
    [
      {
        edition_id: input.editionId,
        student_id: input.studentId,
        requirement_key: input.requirementKey,
        contact_status: input.status,
        responsible_id: input.responsibleId,
        next_step: input.nextStep,
        due_date: input.dueDate,
        notes: input.notes,
        updated_by: guard.auth.userId,
      },
    ],
    { onConflict: "edition_id,student_id,requirement_key" },
  );
  if (error) return { error: "Não foi possível salvar o acompanhamento." };
  refresh();
  return { success: "Acompanhamento salvo." };
}

/**
 * Registra um contato JÁ FEITO. Só é chamado quando a coordenação confirma que
 * enviou a mensagem: abrir o link do WhatsApp, por si só, não prova envio.
 */
export async function recordContact(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("contact");
  if ("error" in guard) return { error: guard.error };
  const editionId = text(formData, "editionId");
  const studentId = text(formData, "studentId");
  const channel = text(formData, "channel");
  const dueDate = orNull(text(formData, "dueDate"));
  if (!UUID.test(editionId) || !UUID.test(studentId)) return { error: "Dados inválidos." };
  if (!(CHANNELS as readonly string[]).includes(channel)) return { error: "Informe por qual canal o contato foi feito." };
  if (dueDate && !DATE.test(dueDate)) return { error: "Prazo inválido." };
  const summary = orNull(text(formData, "summary"));
  const response = orNull(text(formData, "response"));
  const nextStep = orNull(text(formData, "nextStep"));
  const message = orNull(text(formData, "messageText"));
  if ((summary?.length ?? 0) > 1000 || (response?.length ?? 0) > 1000) return { error: "Resumo e resposta aceitam até 1.000 caracteres." };
  if ((nextStep?.length ?? 0) > 500) return { error: "A próxima providência passou de 500 caracteres." };
  const status = (text(formData, "contactStatus") || "contato_realizado") as ContactStatus;
  if (!(CONTACT_STATUSES as readonly string[]).includes(status)) return { error: "Situação inválida." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("graduation_contacts").insert({
    edition_id: editionId,
    student_id: studentId,
    requirement_key: orNull(text(formData, "requirementKey")),
    channel,
    contacted_by: guard.auth.userId,
    summary,
    response,
    next_step: nextStep,
    due_date: dueDate,
    message_text: message?.slice(0, 2000) ?? null,
  });
  if (error) return { error: "Não foi possível registrar o contato." };

  const { error: followError } = await supabase.from("graduation_follow_ups").upsert(
    [
      {
        edition_id: editionId,
        student_id: studentId,
        requirement_key: "geral",
        contact_status: status,
        responsible_id: guard.auth.userId,
        next_step: nextStep,
        due_date: dueDate,
        updated_by: guard.auth.userId,
      },
    ],
    { onConflict: "edition_id,student_id,requirement_key" },
  );
  if (followError) return { error: "O contato foi registrado, mas o acompanhamento não foi atualizado." };
  refresh();
  return { success: "Contato registrado." };
}
