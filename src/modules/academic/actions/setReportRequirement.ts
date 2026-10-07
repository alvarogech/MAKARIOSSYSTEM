"use server";

import { revalidatePath } from "next/cache";
import { can, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export interface ReportRequirementState {
  error?: string;
  success?: string;
}

/** Liga ou desliga a exigência do relatório pós-aula de um semestre. Só o administrador (o banco também confere). */
export async function setReportRequirement(_prev: ReportRequirementState, formData: FormData): Promise<ReportRequirementState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "seasons", action: "set_report_requirement" })) {
    return { error: "Somente o administrador pode alterar esta configuração." };
  }

  const seasonId = formData.get("seasonId");
  if (typeof seasonId !== "string" || !seasonId) return { error: "Semestre inválido." };
  const enabled = formData.get("enabled") === "true";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("seasons").update({ require_class_report: enabled }).eq("id", seasonId);
  if (error) return { error: "Não foi possível salvar. Tente de novo." };

  revalidatePath("/coordenacao/configuracoes");
  revalidatePath("/dashboard");
  revalidatePath("/professor");
  revalidatePath("/coordenacao/relatorios");
  return { success: enabled ? "Relatório pós-aula ligado para este semestre." : "Relatório pós-aula desligado para este semestre." };
}
