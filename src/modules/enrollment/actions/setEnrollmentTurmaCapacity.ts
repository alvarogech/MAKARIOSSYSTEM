"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import {
  ENROLLMENT_SCHEDULES,
  ENROLLMENT_VOLUMES,
  type EnrollmentScheduleSlug,
  type EnrollmentVolumeSlug,
} from "@/config/enrollment";

export interface SetCapacityState {
  error?: string;
  success?: boolean;
}

const VALID_VOLUMES = ENROLLMENT_VOLUMES.map((volume) => volume.slug);
const VALID_SCHEDULES = ENROLLMENT_SCHEDULES.map((schedule) => schedule.slug);

/**
 * Configura (ou atualiza) a capacidade de uma turma (curso + dia) da
 * temporada aberta. Não é a mesma coisa que `classes.capacity` — ver
 * comentário da migration `00000000000043_enrollment_requests_ops.sql`.
 */
export async function setEnrollmentTurmaCapacity(
  _prevState: SetCapacityState,
  formData: FormData,
): Promise<SetCapacityState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollment_requests", action: "manage" })) {
    return { error: "Você não tem permissão para configurar a capacidade das turmas." };
  }

  const seasonId = formData.get("seasonId");
  const volumeSlug = formData.get("volumeSlug");
  const scheduleSlug = formData.get("scheduleSlug");
  const capacity = Number(formData.get("capacity"));

  if (
    typeof seasonId !== "string" ||
    !seasonId ||
    !VALID_VOLUMES.includes(volumeSlug as EnrollmentVolumeSlug) ||
    !VALID_SCHEDULES.includes(scheduleSlug as EnrollmentScheduleSlug) ||
    !Number.isFinite(capacity) ||
    capacity <= 0
  ) {
    return { error: "Informe uma capacidade válida (número maior que zero)." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("enrollment_turma_capacity").upsert(
    {
      season_id: seasonId,
      volume_slug: volumeSlug as EnrollmentVolumeSlug,
      schedule_slug: scheduleSlug as EnrollmentScheduleSlug,
      capacity: Math.floor(capacity),
    },
    { onConflict: "season_id,volume_slug,schedule_slug" },
  );

  if (error) {
    return { error: "Não foi possível salvar a capacidade." };
  }

  revalidatePath("/coordenacao/inscricoes");
  return { success: true };
}
