import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { classTagLabel } from "@/lib/classLabel";
import { buildAgendaStates } from "@/modules/teaching/agendaView";
import { AgendaView, type AgendaLessonView } from "@/modules/teaching/components/AgendaView";
import { CalendarFeedCard } from "@/modules/teaching/components/CalendarFeedCard";
import { loadReportActiveByClass } from "@/modules/teaching/reportSettingsLoader";
import { loadTeacherAgenda } from "@/modules/teaching/teacherAgenda";

export const metadata: Metadata = { title: "Agenda do professor" };

export default async function ProfessorAgendaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Professor." />;
  }

  const now = new Date();
  const todayKey = getSaoPauloDateKey(now);

  const supabase = await createSupabaseServerClient();
  const agenda = await loadTeacherAgenda(supabase, authContext.userId);

  const classIds = [...new Set(agenda.lessons.map((l) => l.classId))];
  const [reportActiveByClass, { data: reports }, { data: feedRow }] = await Promise.all([
    loadReportActiveByClass(supabase, classIds),
    supabase.from("class_meeting_reports").select("meeting_id").eq("teacher_id", authContext.userId),
    supabase.from("teacher_calendar_tokens").select("teacher_id").eq("teacher_id", authContext.userId).maybeSingle(),
  ]);

  const dated = agenda.lessons.filter((l): l is typeof l & { meetingDateKey: string } => Boolean(l.meetingDateKey));
  const states = buildAgendaStates(
    dated.map((l) => ({
      blockId: l.blockId,
      meetingId: l.meetingId,
      classId: l.classId,
      dateKey: l.meetingDateKey,
      startTime: l.sortStartTime || null,
      endTime: l.sortEndTime || null,
      blockStatus: l.blockStatus,
      meetingStatus: l.meetingStatus,
    })),
    { todayKey, now, reportActiveByClass, reportedMeetingIds: new Set((reports ?? []).map((r) => r.meeting_id)) },
  );

  const lessons: AgendaLessonView[] = dated.map((l) => {
    const state = states.get(l.blockId)!;
    return {
      blockId: l.blockId,
      classId: l.classId,
      dateKey: l.meetingDateKey,
      dayLabel: l.dateLabel ?? l.meetingDateKey,
      timeLabel: l.timeLabel,
      moduleName: l.moduleName,
      volumeName: l.volumeName,
      className: l.className,
      room: l.room,
      phase: state.phase,
      canceled: state.canceled,
      changed: l.blockStatus === "changed",
      isNext: state.isNext,
      action: state.action,
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Agenda</h1>
        <p className="mt-0.5 text-sm text-neutral-500">Suas aulas, no horário de São Paulo.</p>
      </div>

      <AgendaView lessons={lessons} initialMonth={todayKey.slice(0, 7)} />

      {agenda.meetingsAwaitingSchedule.length > 0 ? (
        <section aria-labelledby="sem-escala">
          <h2 id="sem-escala" className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Encontros das suas turmas sem escala definida
          </h2>
          <Card>
            <ul className="divide-y divide-neutral-100 text-sm">
              {agenda.meetingsAwaitingSchedule.map((meeting) => (
                <li key={meeting.meetingId} className="py-2 text-neutral-600">
                  {meeting.dateLabel} · {meeting.timeLabel} — {classTagLabel(meeting.volumeName, meeting.className)}
                  <span className="ml-1 text-xs text-neutral-400">— a coordenação ainda não definiu quem dá a aula</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <CalendarFeedCard hasFeed={Boolean(feedRow)} />
    </div>
  );
}
