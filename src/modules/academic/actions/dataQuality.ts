"use server";

import { revalidatePath } from "next/cache";
import { can, canAccessArea, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export interface DataQualityState {
  error?: string;
  success?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Marca (ou desmarca) uma conta como de demonstração: some das listas e contagens, nada é apagado. Só o administrador. */
export async function setDemoFlag(_prev: DataQualityState, formData: FormData): Promise<DataQualityState> {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "admin")) return { error: "Apenas o administrador pode marcar contas de demonstração." };

  const profileId = String(formData.get("profileId") ?? "");
  if (!UUID.test(profileId)) return { error: "Conta inválida." };
  const value = formData.get("value") === "1";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("profiles").update({ is_demo: value }).eq("id", profileId).select("id");
  if (error || !data?.length) return { error: "Não foi possível alterar." };

  revalidatePath("/coordenacao/qualidade-dados");
  return { success: value ? "Marcada como demonstração." : "Voltou a contar como conta real." };
}

/**
 * Cancela (sem apagar — o histórico fica) as matrículas ativas de UMA conta duplicada.
 * A coordenação escolhe qual conta manter; nunca juntamos contas automaticamente.
 */
export async function cancelDuplicateAccountEnrollments(_prev: DataQualityState, formData: FormData): Promise<DataQualityState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "enrollments", action: "manage" })) return { error: "Você não tem permissão para alterar matrículas." };

  const profileId = String(formData.get("profileId") ?? "");
  if (!UUID.test(profileId)) return { error: "Conta inválida." };

  const supabase = await createSupabaseServerClient();

  // Trava de segurança: só cancela se a mesma pessoa ainda tiver matrícula ativa em outra conta com o mesmo e-mail.
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", profileId).maybeSingle();
  if (!profile?.email) return { error: "Conta não encontrada." };
  const { data: twins } = await supabase.from("profiles").select("id").ilike("email", profile.email).neq("id", profileId);
  const twinIds = (twins ?? []).map((t) => t.id);
  const { count } = twinIds.length
    ? await supabase.from("enrollments").select("id", { count: "exact", head: true }).in("student_id", twinIds).eq("status", "active")
    : { count: 0 };
  if (!count) return { error: "A outra conta não tem matrícula ativa — não é seguro cancelar esta." };

  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: "canceled" })
    .eq("student_id", profileId)
    .eq("status", "active")
    .select("id");
  if (error) return { error: "Não foi possível cancelar." };

  revalidatePath("/coordenacao/qualidade-dados");
  revalidatePath("/coordenacao/matriculas");
  return { success: `${data?.length ?? 0} matrícula(s) desta conta cancelada(s). O histórico foi mantido.` };
}
