"use server";

import { revalidatePath } from "next/cache";
import { can, canAccessArea, getAuthContext } from "@/authorization";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import type { Json } from "@/integrations/supabase/types";

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

/** O banco recusa com uma frase em português (trava); mostramos essa frase em vez de um erro genérico. */
function friendly(message: string | undefined, fallback: string) {
  const text = (message ?? "").trim();
  return text && text.length < 200 ? text : fallback;
}

/**
 * Exclui uma inscrição (só o administrador). O banco só libera quando é seguro: sem presença registrada,
 * sem conta criada por ela e sem ser a única inscrição de quem tem matrícula ativa. Fica na trilha de auditoria.
 */
export async function deleteEnrollmentRequest(_prev: DataQualityState, formData: FormData): Promise<DataQualityState> {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "admin")) return { error: "Apenas o administrador pode excluir inscrições." };

  const requestId = String(formData.get("requestId") ?? "");
  if (!UUID.test(requestId)) return { error: "Inscrição inválida." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_enrollment_request", { p_id: requestId });
  if (error) return { error: friendly(error.message, "Não foi possível excluir a inscrição.") };

  revalidatePath("/coordenacao/qualidade-dados");
  revalidatePath("/coordenacao/inscricoes");
  return { success: "Inscrição excluída." };
}

/**
 * Exclui uma conta duplicada que nunca foi usada (só o administrador). A trava do banco exige que exista outra conta
 * com o mesmo e-mail que tenha matrícula ou inscrição, e que esta não tenha acesso, presença, inscrição nem matrícula ativa.
 */
export async function deleteDuplicateAccount(_prev: DataQualityState, formData: FormData): Promise<DataQualityState> {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "admin")) return { error: "Apenas o administrador pode excluir contas." };

  const profileId = String(formData.get("profileId") ?? "");
  if (!UUID.test(profileId)) return { error: "Conta inválida." };

  const supabase = await createSupabaseServerClient();
  const { data: blocker, error: guardError } = await supabase.rpc("duplicate_account_blocker", { p_profile_id: profileId });
  if (guardError) return { error: "Não foi possível verificar se a conta pode ser excluída." };
  if (blocker) return { error: blocker };

  // Guarda o que existia antes de apagar (quem era, quais matrículas canceladas vão junto).
  const [{ data: profile }, { data: enrollments }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, created_at").eq("id", profileId).maybeSingle(),
    supabase.from("enrollments").select("id, class_id, status, created_at").eq("student_id", profileId),
  ]);
  const { error: auditError } = await supabase.rpc("audit_admin_action", {
    p_action: "DELETE_DUPLICATE_ACCOUNT",
    p_entity: "profiles",
    p_entity_id: profileId,
    p_detail: JSON.parse(JSON.stringify({ profile, enrollments })) as Json,
  });
  if (auditError) return { error: "Não foi possível registrar a auditoria; nada foi excluído." };

  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(profileId);
  if (error) return { error: "Não foi possível excluir a conta." };

  revalidatePath("/coordenacao/qualidade-dados");
  revalidatePath("/coordenacao/matriculas");
  return { success: "Conta duplicada excluída." };
}
