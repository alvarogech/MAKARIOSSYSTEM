"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { canAccessArea, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export interface CalendarFeedState {
  error?: string;
  url?: string;
  disabled?: boolean;
}

/** Gera (ou troca) o link de assinatura do calendário. O link anterior deixa de funcionar na hora. */
export async function createCalendarFeedLink(): Promise<CalendarFeedState> {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "teacher")) return { error: "Somente o professor gera o próprio calendário." };

  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token, "utf8").digest("hex");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("teacher_calendar_tokens")
    .upsert({ teacher_id: auth.userId, token_hash: hash, created_at: new Date().toISOString() }, { onConflict: "teacher_id" });
  if (error) return { error: "Não foi possível gerar o link agora. Tente de novo." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "makarios-plataforma.netlify.app";
  const proto = h.get("x-forwarded-proto") ?? "https";

  revalidatePath("/professor/agenda");
  return { url: `${proto}://${host}/api/calendario/${token}` };
}

/** Desativa a assinatura: o link atual para de funcionar. */
export async function disableCalendarFeed(): Promise<CalendarFeedState> {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "teacher")) return { error: "Somente o professor gerencia o próprio calendário." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("teacher_calendar_tokens").delete().eq("teacher_id", auth.userId);
  if (error) return { error: "Não foi possível desativar agora. Tente de novo." };

  revalidatePath("/professor/agenda");
  return { disabled: true };
}
