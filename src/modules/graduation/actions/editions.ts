"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { materialChanges, missingPublishFields, type CeremonyFields, type EditionStatus } from "../ceremony";
import { fromLocalInput } from "../dates";
import { loadVozCandidateIds } from "../facts";
import { requireGraduation, UUID, type GraduationState } from "../guard";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const orNull = (value: string) => (value === "" ? null : value);

function refresh() {
  revalidatePath("/coordenacao/formatura", "layout");
}

/** Cria a edição e já registra, de forma persistente, quem são os candidatos (alunos de Voz da temporada). */
export async function createEdition(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("configure");
  if ("error" in guard) return { error: guard.error };

  const name = text(formData, "name");
  const seasonId = text(formData, "seasonId");
  if (name.length < 3 || name.length > 120) return { error: "Dê um nome à edição (de 3 a 120 caracteres)." };
  if (!UUID.test(seasonId)) return { error: "Escolha a temporada de referência." };

  const supabase = await createSupabaseServerClient();
  const { data: edition, error } = await supabase
    .from("graduation_editions")
    .insert({ name, season_id: seasonId, created_by: guard.auth.userId })
    .select("id")
    .single();
  if (error || !edition) {
    return { error: error?.code === "23505" ? "Já existe uma edição com esse nome nesta temporada." : "Não foi possível criar a edição." };
  }

  const candidates = await loadVozCandidateIds(supabase, seasonId);
  if (candidates.length > 0) {
    await supabase.from("graduation_participants").upsert(
      candidates.map((studentId) => ({ edition_id: edition.id, student_id: studentId, added_by: guard.auth.userId, added_reason: "candidato_voz" })),
      { onConflict: "edition_id,student_id", ignoreDuplicates: true },
    );
  }

  refresh();
  redirect(`/coordenacao/formatura?edicao=${edition.id}`);
}

/** Inclui na edição quem passou a ter matrícula em Voz depois da criação. Não duplica nem remove ninguém. */
export async function syncCandidates(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("configure");
  if ("error" in guard) return { error: guard.error };
  const editionId = text(formData, "editionId");
  if (!UUID.test(editionId)) return { error: "Edição inválida." };

  const supabase = await createSupabaseServerClient();
  const { data: edition } = await supabase.from("graduation_editions").select("season_id").eq("id", editionId).maybeSingle();
  if (!edition) return { error: "Edição não encontrada." };

  const [candidates, { data: existing }] = await Promise.all([
    loadVozCandidateIds(supabase, edition.season_id),
    supabase.from("graduation_participants").select("student_id").eq("edition_id", editionId),
  ]);
  const have = new Set((existing ?? []).map((p) => p.student_id));
  const fresh = candidates.filter((id) => !have.has(id));
  if (fresh.length > 0) {
    const { error } = await supabase.from("graduation_participants").upsert(
      fresh.map((studentId) => ({ edition_id: editionId, student_id: studentId, added_by: guard.auth.userId, added_reason: "candidato_voz" })),
      { onConflict: "edition_id,student_id", ignoreDuplicates: true },
    );
    if (error) return { error: "Não foi possível incluir os novos candidatos." };
  }
  refresh();
  return { success: fresh.length === 0 ? "Nenhum candidato novo: a lista já está completa." : `${fresh.length} candidato(s) incluído(s).` };
}

/** Inclusão manual (por exemplo, quem concluiu a jornada em temporadas anteriores). A aptidão continua sendo calculada. */
export async function addParticipant(formData: FormData): Promise<void> {
  const guard = await requireGraduation("configure");
  if ("error" in guard) return;
  const editionId = text(formData, "editionId");
  const studentId = text(formData, "studentId");
  if (!UUID.test(editionId) || !UUID.test(studentId)) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("graduation_participants")
    .upsert([{ edition_id: editionId, student_id: studentId, added_by: guard.auth.userId, added_reason: "manual" }], {
      onConflict: "edition_id,student_id",
      ignoreDuplicates: true,
    });
  refresh();
}

const TRANSITIONS: Record<EditionStatus, EditionStatus[]> = {
  em_preparacao: ["regularizacao", "arquivada"],
  regularizacao: ["em_preparacao", "arquivada"],
  // Abrir confirmações só pela publicação, que confere os campos obrigatórios.
  confirmacoes_abertas: ["confirmacoes_encerradas"],
  confirmacoes_encerradas: ["confirmacoes_abertas", "realizada"],
  realizada: ["arquivada"],
  arquivada: [],
};

export async function setEditionStatus(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("configure");
  if ("error" in guard) return { error: guard.error };
  const editionId = text(formData, "editionId");
  const next = text(formData, "status") as EditionStatus;
  if (!UUID.test(editionId)) return { error: "Edição inválida." };

  const supabase = await createSupabaseServerClient();
  const { data: edition } = await supabase.from("graduation_editions").select("status, published_at").eq("id", editionId).maybeSingle();
  if (!edition) return { error: "Edição não encontrada." };
  const current = edition.status as EditionStatus;
  if (!TRANSITIONS[current]?.includes(next)) return { error: "Esta mudança de estado não é permitida a partir do estado atual." };
  if (next === "confirmacoes_abertas" && !edition.published_at) return { error: "Publique a cerimônia para abrir as confirmações." };

  const { error } = await supabase.from("graduation_editions").update({ status: next }).eq("id", editionId).eq("status", current);
  if (error) return { error: "Não foi possível mudar o estado." };
  refresh();
  return { success: "Estado atualizado." };
}

function readCeremony(formData: FormData): CeremonyFields & { instructions: string | null; inviteMessage: string | null; error?: string } {
  const deadlineRaw = text(formData, "rsvpDeadline");
  const deadline = deadlineRaw ? fromLocalInput(deadlineRaw) : null;
  return {
    eventName: orNull(text(formData, "eventName")),
    eventDate: orNull(text(formData, "eventDate")),
    eventTime: orNull(text(formData, "eventTime")),
    locationName: orNull(text(formData, "locationName")),
    address: orNull(text(formData, "address")),
    rsvpDeadline: deadline,
    instructions: orNull(text(formData, "instructions")),
    inviteMessage: orNull(text(formData, "inviteMessage")),
    ...(deadlineRaw && !deadline ? { error: "Prazo para confirmação inválido." } : {}),
  };
}

/**
 * Salva os dados da cerimônia. A alteração fica registrada pelo banco (auditoria
 * da edição). Se a cerimônia já foi publicada e algo que o aluno precisa saber
 * mudou (data, horário, local, endereço), avisa a coordenação para comunicar
 * quem já confirmou.
 */
export async function saveCeremony(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("configure");
  if ("error" in guard) return { error: guard.error };
  const editionId = text(formData, "editionId");
  const expectedUpdatedAt = text(formData, "updatedAt");
  if (!UUID.test(editionId)) return { error: "Edição inválida." };

  const next = readCeremony(formData);
  if (next.error) return { error: next.error };
  if (next.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(next.eventDate)) return { error: "Data inválida." };
  if (next.eventTime && !/^\d{2}:\d{2}$/.test(next.eventTime)) return { error: "Horário inválido." };
  if (next.instructions && next.instructions.length > 2000) return { error: "As orientações passaram de 2.000 caracteres." };
  if (next.inviteMessage && next.inviteMessage.length > 1000) return { error: "A mensagem de convite passou de 1.000 caracteres." };

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from("graduation_editions")
    .select("event_name, event_date, event_time, location_name, address, rsvp_deadline, published_at, updated_at")
    .eq("id", editionId)
    .maybeSingle();
  if (!current) return { error: "Edição não encontrada." };

  const before: CeremonyFields = {
    eventName: current.event_name,
    eventDate: current.event_date,
    eventTime: current.event_time?.slice(0, 5) ?? null,
    locationName: current.location_name,
    address: current.address,
    rsvpDeadline: current.rsvp_deadline,
  };
  const changed = materialChanges(before, next);

  let query = supabase
    .from("graduation_editions")
    .update({
      event_name: next.eventName,
      event_date: next.eventDate,
      event_time: next.eventTime,
      location_name: next.locationName,
      address: next.address,
      rsvp_deadline: next.rsvpDeadline,
      instructions: next.instructions,
      invite_message: next.inviteMessage,
    })
    .eq("id", editionId);
  // Concorrência: se outra pessoa salvou antes, não sobrescreve sem avisar.
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data: saved, error } = await query.select("id");
  if (error) return { error: "Não foi possível salvar a cerimônia." };
  if (!saved || saved.length === 0) return { error: "Outra pessoa alterou esta cerimônia enquanto você editava. Recarregue a página e confira antes de salvar." };

  let warning = "";
  if (current.published_at && changed.length > 0) {
    const { count } = await supabase
      .from("graduation_participants")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", editionId)
      .eq("response", "confirmado");
    warning = ` Mudou ${changed.join(", ")} de uma cerimônia já publicada: ${count ?? 0} aluno(s) já confirmaram e precisam ser avisados.`;
  }
  refresh();
  return { success: `Cerimônia salva.${warning}` };
}

/** Publica a cerimônia: só com todos os campos obrigatórios, e só então a confirmação aparece para o aluno. */
export async function publishCeremony(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("configure");
  if ("error" in guard) return { error: guard.error };
  const editionId = text(formData, "editionId");
  if (!UUID.test(editionId)) return { error: "Edição inválida." };

  const supabase = await createSupabaseServerClient();
  const { data: e } = await supabase
    .from("graduation_editions")
    .select("event_name, event_date, event_time, location_name, address, rsvp_deadline, status, published_at")
    .eq("id", editionId)
    .maybeSingle();
  if (!e) return { error: "Edição não encontrada." };
  if (e.status === "arquivada" || e.status === "realizada") return { error: "Esta edição já foi encerrada." };

  const missing = missingPublishFields({
    eventName: e.event_name,
    eventDate: e.event_date,
    eventTime: e.event_time?.slice(0, 5) ?? null,
    locationName: e.location_name,
    address: e.address,
    rsvpDeadline: e.rsvp_deadline,
  });
  if (missing.length > 0) return { error: `Antes de publicar, preencha: ${missing.join(", ")}.` };
  if (e.rsvp_deadline && new Date(e.rsvp_deadline).getTime() <= Date.now()) return { error: "O prazo para confirmação já passou. Defina um prazo futuro." };

  const { error } = await supabase
    .from("graduation_editions")
    .update({ status: "confirmacoes_abertas", published_at: e.published_at ?? new Date().toISOString(), published_by: guard.auth.userId })
    .eq("id", editionId);
  if (error) return { error: "Não foi possível publicar." };
  refresh();
  return { success: "Cerimônia publicada. Os alunos convidados já podem responder." };
}
