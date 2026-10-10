"use server";

import { revalidatePath } from "next/cache";
import { canAccessArea, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

/** Marca um pedido de ajuda como resolvido, ou o reabre. */
export async function setHelpRequestStatus(formData: FormData): Promise<void> {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "coordination")) return;

  const id = String(formData.get("id") ?? "");
  const resolved = formData.get("status") === "resolvido";
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("help_requests")
    .update(
      resolved
        ? { status: "resolvido", resolved_at: new Date().toISOString(), resolved_by: auth.userId }
        : { status: "aberto", resolved_at: null, resolved_by: null },
    )
    .eq("id", id);
  revalidatePath("/coordenacao/ajuda");
}
