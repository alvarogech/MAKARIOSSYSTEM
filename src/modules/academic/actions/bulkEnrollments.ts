"use server";

import { revalidatePath } from "next/cache";
import { can, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { enrollmentStatusValues } from "../schemas";

export interface BulkEnrollmentState {
  error?: string;
  success?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ação em lote nas matrículas selecionadas: mudar o status (cancelar, trancar, reativar...) ou
 * mover de turma. Nada é apagado. A confirmação é pedida na tela, antes de chamar esta ação.
 * Mover de turma só vale dentro da mesma oferta de volume (o banco barra o resto).
 */
export async function bulkUpdateEnrollments(_prev: BulkEnrollmentState, formData: FormData): Promise<BulkEnrollmentState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "enrollments", action: "manage" })) {
    return { error: "Você não tem permissão para alterar matrículas." };
  }

  const ids = formData.getAll("ids").map(String).filter((id) => UUID.test(id));
  if (ids.length === 0) return { error: "Selecione pelo menos uma matrícula." };
  if (ids.length > 200) return { error: "Selecione no máximo 200 matrículas por vez." };

  const action = String(formData.get("action") ?? "");
  const supabase = await createSupabaseServerClient();

  if (action === "status") {
    const status = String(formData.get("status") ?? "");
    if (!(enrollmentStatusValues as readonly string[]).includes(status)) return { error: "Escolha o novo status." };
    const { data, error } = await supabase.from("enrollments").update({ status }).in("id", ids).select("id");
    if (error) return { error: "Não foi possível atualizar o status." };
    revalidatePath("/coordenacao/matriculas");
    return { success: `${data?.length ?? 0} matrícula(s) atualizada(s).` };
  }

  if (action === "class") {
    const classId = String(formData.get("classId") ?? "");
    if (!UUID.test(classId)) return { error: "Escolha a turma de destino." };
    let moved = 0;
    let blocked = 0;
    for (const id of ids) {
      const { error } = await supabase.from("enrollments").update({ class_id: classId }).eq("id", id);
      if (error) blocked += 1;
      else moved += 1;
    }
    revalidatePath("/coordenacao/matriculas");
    return blocked > 0
      ? { error: `${moved} movida(s); ${blocked} não puderam ir para essa turma (ela precisa ser da mesma oferta de volume).` }
      : { success: `${moved} matrícula(s) movida(s).` };
  }

  return { error: "Ação inválida." };
}
