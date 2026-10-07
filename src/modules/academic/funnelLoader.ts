import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadOverview } from "@/modules/attendance/overviewLoader";
import type { PersonStat } from "@/modules/attendance/overview";
import type { Situation } from "@/modules/attendance/progress";
import { scheduleLabel, volumeLabel } from "@/modules/enrollment/labels";
import { stageOf, worstSituation, type FunnelStage } from "./studentFunnel";

type DB = SupabaseClient<Database>;

export interface FunnelPerson {
  requestId: string;
  studentId: string | null;
  name: string;
  email: string;
  phone: string;
  cpfLast4: string;
  protocol: string;
  /** Ex.: "Caminho · Sábado" (e o segundo volume, se houver). */
  courses: string[];
  volumeNames: string[];
  stage: FunnelStage;
  situation: Situation | null;
  attendedMinutes: number;
  totalMinutes: number;
  pctSoFar: number | null;
  lastSignInAt: string | null;
  materialsOpened: number;
  createdAt: string;
  requestStatus: string;
}

export async function loadFunnel(supabase: DB, seasonId: string): Promise<FunnelPerson[]> {
  const [{ data: requests }, { data: access }, loaded] = await Promise.all([
    supabase
      .from("enrollment_requests")
      .select(
        "id, protocol, full_name, email, phone, cpf_last4, status, student_id, created_at, primary_volume_slug, primary_schedule_slug, secondary_volume_slug, secondary_schedule_slug",
      )
      .eq("season_id", seasonId)
      .order("full_name"),
    supabase.rpc("coordination_student_access"),
    loadOverview(supabase, seasonId),
  ]);

  const studentIds = [...new Set((requests ?? []).map((r) => r.student_id).filter((x): x is string => Boolean(x)))];
  const { data: enrollments } = studentIds.length
    ? await supabase.from("enrollments").select("student_id, status").in("student_id", studentIds)
    : { data: [] as { student_id: string; status: string }[] };

  const accessByRequest = new Map((access ?? []).map((a) => [a.request_id, a]));
  const statusesByStudent = new Map<string, string[]>();
  for (const e of enrollments ?? []) statusesByStudent.set(e.student_id, [...(statusesByStudent.get(e.student_id) ?? []), e.status]);

  const peopleByKey = new Map<string, PersonStat[]>();
  for (const klass of loaded.overview.classes) {
    for (const person of klass.people) peopleByKey.set(person.key, [...(peopleByKey.get(person.key) ?? []), person]);
  }

  return (requests ?? []).map((r) => {
    const stats = peopleByKey.get(`r:${r.id}`) ?? [];
    const acc = accessByRequest.get(r.id);
    const attended = stats.reduce((sum, p) => sum + p.progress.attendedMinutes, 0);
    const total = stats.reduce((sum, p) => sum + p.progress.totalMinutes, 0);
    const held = stats.reduce((sum, p) => sum + p.progress.attendedMinutes + p.progress.missedMinutes, 0);
    const situation = worstSituation(stats);

    const courses = [`${volumeLabel(r.primary_volume_slug)} · ${scheduleLabel(r.primary_schedule_slug)}`];
    if (r.secondary_volume_slug && r.secondary_schedule_slug) {
      courses.push(`${volumeLabel(r.secondary_volume_slug)} · ${scheduleLabel(r.secondary_schedule_slug)}`);
    }

    return {
      requestId: r.id,
      studentId: r.student_id,
      name: r.full_name,
      email: r.email,
      phone: r.phone,
      cpfLast4: r.cpf_last4,
      protocol: r.protocol,
      courses,
      volumeNames: [volumeLabel(r.primary_volume_slug), ...(r.secondary_volume_slug ? [volumeLabel(r.secondary_volume_slug)] : [])],
      stage: stageOf({
        requestStatus: r.status,
        hasAccount: Boolean(r.student_id),
        lastSignInAt: acc?.last_sign_in_at ?? null,
        enrollmentStatuses: r.student_id ? (statusesByStudent.get(r.student_id) ?? []) : [],
        situation,
        attendedMinutes: attended,
      }),
      situation,
      attendedMinutes: attended,
      totalMinutes: total,
      pctSoFar: held > 0 ? Math.round((attended / held) * 100) : null,
      lastSignInAt: acc?.last_sign_in_at ?? null,
      materialsOpened: acc?.materials_opened ?? 0,
      createdAt: r.created_at,
      requestStatus: r.status,
    };
  });
}
