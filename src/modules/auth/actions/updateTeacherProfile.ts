"use server";

import { revalidatePath } from "next/cache";
import { can, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { isValidBrazilianPhone } from "@/services/phone";

export interface UpdateTeacherProfileState {
  error?: string;
  success?: string;
}

/** Só dígitos, sem +55; vazio vira null. Devolve undefined quando o número não faz sentido. */
function cleanPhone(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!isValidBrazilianPhone(trimmed)) return undefined;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  return digits;
}

function cleanName(raw: string): string | undefined {
  const name = raw.replace(/\s+/g, " ").trim();
  return name.length >= 2 && name.length <= 120 ? name : undefined;
}

/**
 * Edição do cadastro de um professor ATIVO (nome e WhatsApp). Só o administrador — a política do banco
 * (profiles_update_any_admin) também recusa outro perfil. O e-mail de login não muda aqui.
 */
export async function updateTeacherProfile(_prev: UpdateTeacherProfileState, formData: FormData): Promise<UpdateTeacherProfileState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "teacher_profile", action: "edit" })) {
    return { error: "Somente o administrador edita o cadastro de professores." };
  }

  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) return { error: "Professor inválido." };

  const fullName = cleanName(String(formData.get("fullName") ?? ""));
  if (!fullName) return { error: "Informe o nome (de 2 a 120 caracteres)." };

  const phone = cleanPhone(String(formData.get("phone") ?? ""));
  if (phone === undefined) return { error: "WhatsApp inválido. Use DDD + número, por exemplo (62) 99999-9999." };

  const supabase = await createSupabaseServerClient();

  // Garante que a pessoa é mesmo professor: esta tela não serve para editar qualquer perfil.
  const { data: teacherRole } = await supabase.from("roles").select("id").eq("slug", "teacher").single();
  const { data: isTeacher } = teacherRole
    ? await supabase.from("user_roles").select("user_id").eq("user_id", userId).eq("role_id", teacherRole.id).maybeSingle()
    : { data: null };
  if (!isTeacher) return { error: "Este usuário não é professor." };

  const { data, error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", userId).select("id").maybeSingle();
  if (error || !data) return { error: "Não foi possível salvar. Tente de novo." };

  revalidatePath("/coordenacao/professores");
  revalidatePath("/coordenacao/professores/escala");
  return { success: "Cadastro atualizado." };
}

/** Edição de nome e WhatsApp de um convite de professor ainda pendente (a pessoa ainda não tem conta). */
export async function updatePendingTeacherContact(_prev: UpdateTeacherProfileState, formData: FormData): Promise<UpdateTeacherProfileState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "teacher_profile", action: "edit" })) {
    return { error: "Somente o administrador edita o cadastro de professores." };
  }

  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string" || !invitationId) return { error: "Convite inválido." };

  const fullName = cleanName(String(formData.get("fullName") ?? ""));
  if (!fullName) return { error: "Informe o nome (de 2 a 120 caracteres)." };
  const phone = cleanPhone(String(formData.get("phone") ?? ""));
  if (phone === undefined) return { error: "WhatsApp inválido. Use DDD + número, por exemplo (62) 99999-9999." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invitations")
    .update({ intended_full_name: fullName, phone })
    .eq("id", invitationId)
    .eq("channel", "manual_link")
    .eq("purpose", "teacher_onboarding")
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Não foi possível salvar: o convite pode já ter sido usado." };

  revalidatePath("/coordenacao/professores");
  return { success: "Cadastro atualizado." };
}
