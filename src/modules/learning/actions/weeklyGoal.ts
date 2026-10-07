"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { clampTarget } from "../weeklyGoal";

export interface WeeklyGoalState {
  error?: string;
  success?: string;
}

/** Liga, desliga ou ajusta a meta semanal. Só o próprio aluno (a política do banco também garante). */
export async function saveWeeklyGoal(_prev: WeeklyGoalState, formData: FormData): Promise<WeeklyGoalState> {
  const auth = await getAuthContext();
  if (!auth || auth.activeRole !== "student") return { error: "Só o aluno define a própria meta." };

  const enabled = formData.get("enabled") === "on";
  const target = clampTarget(Number(formData.get("target")));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_weekly_goals")
    .upsert({ student_id: auth.userId, enabled, target, updated_at: new Date().toISOString() }, { onConflict: "student_id" });
  if (error) return { error: "Não foi possível salvar a meta agora. Tente de novo." };

  revalidatePath("/dashboard");
  revalidatePath("/meu-aprendizado");
  return { success: enabled ? "Meta salva." : "Meta desligada." };
}
