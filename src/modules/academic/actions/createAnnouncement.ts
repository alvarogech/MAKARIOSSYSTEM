"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createAnnouncementSchema } from "../schemas";

export interface CreateAnnouncementState {
  error?: string;
  success?: boolean;
}

export async function createAnnouncement(
  _prevState: CreateAnnouncementState,
  formData: FormData,
): Promise<CreateAnnouncementState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "announcements", action: "manage" })) {
    return { error: "Você não tem permissão para publicar avisos." };
  }

  const parsed = createAnnouncementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    classId: formData.get("classId") || "",
    moduleId: formData.get("moduleId") || "",
    audience: formData.get("audience") || "teachers",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("announcements").insert({
    title: parsed.data.title,
    body: parsed.data.body,
    class_id: parsed.data.classId || null,
    module_id: parsed.data.moduleId || null,
    audience: parsed.data.audience,
    created_by: authContext.userId,
  });

  if (error) {
    return { error: "Não foi possível publicar o aviso." };
  }

  revalidatePath("/coordenacao/avisos");
  revalidatePath("/dashboard");
  return { success: true };
}
