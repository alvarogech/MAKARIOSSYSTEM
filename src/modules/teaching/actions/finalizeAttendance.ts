"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { finalizeAttendanceSchema } from "../schemas";

export interface FinalizeAttendanceState {
  error?: string;
  success?: boolean;
}

export async function finalizeAttendance(
  _prevState: FinalizeAttendanceState,
  formData: FormData,
): Promise<FinalizeAttendanceState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "attendance", action: "record" })) {
    return { error: "Você não tem permissão para finalizar frequência." };
  }

  const parsed = finalizeAttendanceSchema.safeParse({
    meetingId: formData.get("meetingId"),
  });

  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("finalize_attendance", {
    p_meeting_id: parsed.data.meetingId,
  });

  if (error) {
    return { error: error.message || "Não foi possível finalizar a frequência." };
  }

  revalidatePath("/professor/turmas");
  return { success: true };
}
