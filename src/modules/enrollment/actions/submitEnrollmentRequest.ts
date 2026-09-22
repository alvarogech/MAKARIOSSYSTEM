"use server";

import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { ENROLLMENT_PRIVACY_TERMS_VERSION } from "@/config/enrollment";
import { protectCpf } from "../dataProtection";
import { enrollmentRequestSchema } from "../schemas";

export interface EnrollmentRequestState {
  success?: boolean;
  protocol?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function createProtocol(): string {
  return `MK-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function submitEnrollmentRequest(
  _previousState: EnrollmentRequestState,
  formData: FormData,
): Promise<EnrollmentRequestState> {
  const parsed = enrollmentRequestSchema.safeParse({
    fullName: formData.get("fullName"),
    cpf: formData.get("cpf"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    primaryVolume: formData.get("primaryVolume"),
    primarySchedule: formData.get("primarySchedule"),
    wantsSecondVolume: checked(formData, "wantsSecondVolume"),
    secondaryVolume: formData.get("secondaryVolume") ?? "",
    secondarySchedule: formData.get("secondarySchedule") ?? "",
    prerequisiteDeclaration: formData.get("prerequisiteDeclaration") ?? "",
    notes: formData.get("notes") ?? "",
    privacyConsent: checked(formData, "privacyConsent"),
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return {
      error: "Revise os campos indicados e tente novamente.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Honeypot: responde como sucesso sem persistir, evitando ensinar bots.
  if (parsed.data.website) {
    return { success: true, protocol: createProtocol() };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: season } = await admin
      .from("seasons")
      .select("id")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!season) {
      return { error: "As inscrições não estão abertas neste momento." };
    }

    const protectedCpf = protectCpf(parsed.data.cpf);
    const protocol = createProtocol();
    const { error } = await admin.from("enrollment_requests").insert({
      protocol,
      season_id: season.id,
      full_name: parsed.data.fullName,
      cpf_encrypted: protectedCpf.encrypted,
      cpf_hash: protectedCpf.hash,
      cpf_last4: protectedCpf.last4,
      email: parsed.data.email,
      phone: parsed.data.phone,
      primary_volume_slug: parsed.data.primaryVolume,
      primary_schedule_slug: parsed.data.primarySchedule,
      wants_second_volume: parsed.data.wantsSecondVolume,
      secondary_volume_slug: parsed.data.wantsSecondVolume
        ? parsed.data.secondaryVolume || null
        : null,
      secondary_schedule_slug: parsed.data.wantsSecondVolume
        ? parsed.data.secondarySchedule || null
        : null,
      prerequisite_declaration: parsed.data.prerequisiteDeclaration || null,
      notes: parsed.data.notes || null,
      status: "pending",
      privacy_terms_version: ENROLLMENT_PRIVACY_TERMS_VERSION,
      consent_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        return {
          error:
            "Já existe uma solicitação ativa para este CPF. Se precisar corrigir alguma informação, fale com a equipe da Escola Makários.",
        };
      }
      return { error: "Não foi possível enviar sua solicitação. Tente novamente em alguns instantes." };
    }

    return { success: true, protocol };
  } catch {
    return { error: "Não foi possível enviar sua solicitação. Tente novamente em alguns instantes." };
  }
}
