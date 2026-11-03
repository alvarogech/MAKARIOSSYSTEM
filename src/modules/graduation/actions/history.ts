"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { MODULES } from "../types";
import { requireGraduation, UUID, type GraduationState } from "../guard";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function refresh() {
  revalidatePath("/coordenacao/formatura", "layout");
}

/**
 * Reconhece a conclusão de um módulo anterior à plataforma. Só o administrador;
 * exige origem e evidência; o registro original nunca é editado ou apagado
 * (para corrigir, revoga-se e registra-se de novo).
 */
export async function validateHistory(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("validate_history");
  if ("error" in guard) return { error: guard.error };
  const studentId = text(formData, "studentId");
  const volume = text(formData, "volume");
  const season = text(formData, "seasonLabel");
  const origin = text(formData, "origin");
  const evidence = text(formData, "evidence");
  if (!UUID.test(studentId)) return { error: "Aluno inválido." };
  if (!(MODULES as readonly string[]).includes(volume)) return { error: "Escolha o módulo." };
  if (origin.length < 3 || origin.length > 300) return { error: "Informe a origem da informação (ex.: lista de presença de 2025, livro de atas)." };
  if (evidence.length < 5 || evidence.length > 2000) return { error: "Descreva a evidência que comprova a conclusão (mínimo de 5 caracteres)." };
  if (season.length > 60) return { error: "A temporada aceita até 60 caracteres." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("graduation_history_records").insert({
    student_id: studentId,
    volume_slug: volume,
    season_label: season || null,
    origin,
    evidence,
    validated_by: guard.auth.userId,
  });
  if (error) {
    return { error: error.code === "23505" ? "Já existe um reconhecimento vigente deste módulo para o aluno. Revogue-o antes de registrar outro." : "Não foi possível registrar o histórico." };
  }
  refresh();
  return { success: "Histórico validado. A elegibilidade já foi recalculada." };
}

export async function revokeHistory(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("validate_history");
  if ("error" in guard) return { error: guard.error };
  const id = text(formData, "id");
  const reason = text(formData, "reason");
  if (!UUID.test(id)) return { error: "Registro inválido." };
  if (reason.length < 5 || reason.length > 500) return { error: "Explique o motivo da revogação (de 5 a 500 caracteres)." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("graduation_history_records")
    .update({ revoked_at: new Date().toISOString(), revoked_by: guard.auth.userId, revoke_reason: reason })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id");
  if (error || !data || data.length === 0) return { error: "Não foi possível revogar (o registro pode já ter sido revogado)." };
  refresh();
  return { success: "Reconhecimento revogado. O registro original foi mantido." };
}

/**
 * Reconhece o mesmo histórico para vários alunos de uma vez (por exemplo, quando a
 * coordenação conferiu a lista de presença de uma turma antiga). A origem e a evidência
 * são obrigatórias e ficam gravadas em UM registro por aluno e módulo, cada um auditável
 * e revogável sozinho. Quem já tem reconhecimento vigente do módulo é pulado, nunca
 * sobrescrito.
 */
export async function validateHistoryBulk(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const guard = await requireGraduation("validate_history");
  if ("error" in guard) return { error: guard.error };

  const studentIds = [...new Set(formData.getAll("studentIds").map(String).filter((id) => UUID.test(id)))].slice(0, 200);
  const modules = [...new Set(formData.getAll("modules").map(String).filter((m) => (MODULES as readonly string[]).includes(m)))];
  const season = text(formData, "seasonLabel");
  const origin = text(formData, "origin");
  const evidence = text(formData, "evidence");
  if (studentIds.length === 0) return { error: "Selecione pelo menos um aluno." };
  if (modules.length === 0) return { error: "Marque pelo menos um módulo." };
  if (origin.length < 3 || origin.length > 300) return { error: "Informe a origem da informação (ex.: lista de presença de 2025)." };
  if (evidence.length < 5 || evidence.length > 2000) return { error: "Descreva a evidência que comprova a conclusão (mínimo de 5 caracteres)." };
  if (season.length > 60) return { error: "A temporada aceita até 60 caracteres." };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("graduation_history_records")
    .select("student_id, volume_slug")
    .in("student_id", studentIds)
    .in("volume_slug", modules)
    .is("revoked_at", null);
  const already = new Set((existing ?? []).map((r) => `${r.student_id}:${r.volume_slug}`));

  const rows = studentIds.flatMap((studentId) =>
    modules
      .filter((volume) => !already.has(`${studentId}:${volume}`))
      .map((volume) => ({
        student_id: studentId,
        volume_slug: volume,
        season_label: season || null,
        origin,
        evidence,
        validated_by: guard.auth.userId,
      })),
  );
  if (rows.length === 0) return { error: "Todos os selecionados já têm reconhecimento vigente para esses módulos." };

  const { error } = await supabase.from("graduation_history_records").insert(rows);
  if (error) return { error: "Não foi possível registrar o histórico. Nada foi gravado." };
  refresh();
  const skipped = studentIds.length * modules.length - rows.length;
  return { success: `${rows.length} reconhecimento(s) registrado(s)${skipped > 0 ? `; ${skipped} já existiam e foram mantidos` : ""}. A elegibilidade foi recalculada.` };
}
