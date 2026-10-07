"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { can, getAuthContext } from "@/authorization";
import { sendGroupEmail } from "../groupEmail";

export interface SendGroupEmailsState {
  error?: string;
  success?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE_STATUSES = ["active", "regularization", "approved"];
// Teto por clique: respeita a cota diária do provedor de e-mail e o tempo da requisição.
const MAX_PER_CLICK = 60;

/**
 * Envia o link do grupo de WhatsApp do volume, por e-mail, para os alunos com
 * matrícula ativa que AINDA NÃO receberam (registro em volume_whatsapp_group_emails).
 * Se a cota diária do provedor estourar, para e avisa — dá para clicar de novo
 * amanhã e continuar de onde parou, sem duplicar.
 */
export async function sendVolumeGroupEmails(
  _prevState: SendGroupEmailsState,
  formData: FormData,
): Promise<SendGroupEmailsState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollments", action: "manage" })) {
    return { error: "Você não tem permissão para enviar e-mails aos alunos." };
  }

  const volumeId = String(formData.get("volumeId") ?? "");
  if (!UUID.test(volumeId)) return { error: "Volume inválido." };

  const admin = createSupabaseAdminClient();

  const [{ data: volume }, { data: group }] = await Promise.all([
    admin.from("volumes").select("id, name").eq("id", volumeId).maybeSingle(),
    admin.from("volume_whatsapp_groups").select("invite_url").eq("volume_id", volumeId).maybeSingle(),
  ]);
  if (!volume || !group) return { error: "Este volume não tem link de grupo cadastrado." };

  const { data: offerings } = await admin.from("season_volume_offerings").select("id").eq("volume_id", volumeId);
  const offeringIds = (offerings ?? []).map((o) => o.id);
  if (offeringIds.length === 0) return { error: "Nenhuma oferta deste volume." };

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("student_id")
    .in("season_volume_offering_id", offeringIds)
    .in("status", ACTIVE_STATUSES);
  const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id))];
  if (studentIds.length === 0) return { error: "Nenhum aluno com matrícula ativa neste volume." };

  const [{ data: profiles }, { data: alreadySent }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, status").in("id", studentIds),
    admin.from("volume_whatsapp_group_emails").select("student_id").eq("volume_id", volumeId).in("student_id", studentIds),
  ]);
  const sentSet = new Set((alreadySent ?? []).map((r) => r.student_id));
  const pending = (profiles ?? []).filter((p) => p.status === "active" && p.email && !sentSet.has(p.id));

  if (pending.length === 0) {
    return { success: "Todos os alunos deste volume já receberam o link." };
  }

  let sent = 0;
  let failed = 0;
  let quotaHit = false;

  for (const profile of pending.slice(0, MAX_PER_CLICK)) {
    try {
      await sendGroupEmail(admin, {
        studentId: profile.id,
        volumeId,
        volumeName: volume.name,
        inviteUrl: group.invite_url,
        fullName: profile.full_name,
        email: profile.email!,
      });
      sent += 1;
    } catch (error) {
      console.error("Falha ao enviar link do grupo de WhatsApp:", error);
      failed += 1;
      if (/quota|limit/i.test(error instanceof Error ? error.message : String(error))) {
        quotaHit = true;
        break;
      }
    }
  }

  revalidatePath("/coordenacao/grupos-whatsapp");

  const remaining = pending.length - sent;
  const parts = [`${sent} e-mail(s) enviado(s)`];
  if (failed > 0) parts.push(`${failed} falharam`);
  if (remaining > 0) {
    parts.push(
      quotaHit
        ? `${remaining} ficaram para depois (limite diário de envio atingido — clique de novo amanhã)`
        : `${remaining} ainda faltam — clique de novo para continuar`,
    );
  }
  return sent > 0 || remaining === 0 ? { success: `${parts.join("; ")}.` } : { error: `${parts.join("; ")}.` };
}
