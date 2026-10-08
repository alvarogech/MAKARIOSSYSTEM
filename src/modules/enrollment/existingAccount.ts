import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { escapeIlike } from "@/modules/auth/lookupTeacherCandidate";

/** Nome sem acento, minúsculo e com espaços simples — para comparar "a mesma pessoa" sem se enganar com digitação. */
export function normalizePersonName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isSamePerson(a: string, b: string): boolean {
  const left = normalizePersonName(a);
  return left.length > 0 && left === normalizePersonName(b);
}

export const ALREADY_HAS_ACCOUNT_MESSAGE =
  "Você já tem uma conta na Escola Makários. Entre com o e-mail ou o código de acesso que já recebeu; " +
  "se não lembra, peça à coordenação para gerar um novo acesso.";

export type ExistingAccount = { reason: "request_linked" | "same_person"; profileId: string };

/**
 * Uma pessoa = uma conta. Devolve a conta que já existe para esta pessoa, se houver:
 *  - a inscrição já está ligada a uma conta; ou
 *  - já existe conta com o mesmo e-mail E o mesmo nome (e-mail dividido com um familiar de nome diferente continua permitido).
 * Foi a ausência dessa checagem que deixou a mesma pessoa com duas contas.
 */
export async function findExistingAccountForPerson(
  admin: SupabaseClient<Database>,
  params: { enrollmentRequestId: string | null; contactEmail: string; names: string[] },
): Promise<ExistingAccount | null> {
  const names = [...params.names];

  if (params.enrollmentRequestId) {
    const { data: request } = await admin
      .from("enrollment_requests")
      .select("student_id, full_name")
      .eq("id", params.enrollmentRequestId)
      .maybeSingle();
    if (request?.full_name) names.push(request.full_name);
    if (request?.student_id) {
      const { data: linked } = await admin.from("profiles").select("id").eq("id", request.student_id).maybeSingle();
      if (linked) return { reason: "request_linked", profileId: linked.id };
    }
  }

  const { data: sameEmail } = await admin
    .from("profiles")
    .select("id, full_name")
    .ilike("email", escapeIlike(params.contactEmail.trim().toLowerCase()))
    .eq("is_demo", false);
  const match = (sameEmail ?? []).find((profile) => names.some((name) => isSamePerson(name, profile.full_name ?? "")));
  return match ? { reason: "same_person", profileId: match.id } : null;
}
