import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarClock, MapPin } from "lucide-react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { formatSaoPauloLongDate, formatSaoPauloTimeRange, getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { buildMapsSearchUrl } from "@/lib/maps";
import { selectNextMeeting } from "@/modules/learning/nextMeeting";

export const metadata: Metadata = { title: "Agenda" };

interface AgendaGroup {
  classId: string;
  className: string;
  volumeName: string;
  location: string | null;
  meetings: {
    id: string;
    dateLabel: string;
    timeLabel: string;
    isPast: boolean;
    isNext: boolean;
  }[];
  earliestUpcomingKey: string | null; // usado só para ordenar os grupos
}

export default async function AgendaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  const supabase = await createSupabaseServerClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id, season_volume_offering_id")
    .eq("student_id", authContext.userId)
    .in("status", ["active", "regularization", "approved"]);

  const classIds = [...new Set((enrollments ?? []).map((e) => e.class_id))];
  const offeringIds = [...new Set((enrollments ?? []).map((e) => e.season_volume_offering_id))];

  const [{ data: meetings }, { data: classes }, { data: offerings }] = await Promise.all([
    classIds.length
      ? supabase
          .from("class_meetings")
          .select("id, class_id, sequence, meeting_date, start_time, end_time, status")
          .in("class_id", classIds)
          .order("sequence")
      : Promise.resolve({ data: [] }),
    classIds.length
      ? supabase.from("classes").select("id, name, location, season_volume_offering_id").in("id", classIds)
      : Promise.resolve({ data: [] }),
    offeringIds.length
      ? supabase.from("season_volume_offerings").select("id, volume_id").in("id", offeringIds)
      : Promise.resolve({ data: [] }),
  ]);

  const volumeIds = [...new Set((offerings ?? []).map((o) => o.volume_id))];
  const { data: volumes } = volumeIds.length
    ? await supabase.from("volumes").select("id, name").in("id", volumeIds)
    : { data: [] };

  const volumeNameById = new Map((volumes ?? []).map((v) => [v.id, v.name]));
  const offeringById = new Map((offerings ?? []).map((o) => [o.id, o]));
  const classById = new Map((classes ?? []).map((c) => [c.id, c]));

  const todayKey = getSaoPauloDateKey(new Date());

  const withDate = (meetings ?? []).filter(
    (m): m is typeof m & { meeting_date: string } => Boolean(m.meeting_date),
  );
  const withoutDate = (meetings ?? []).filter((m) => !m.meeting_date);

  const nextMeeting = selectNextMeeting(
    withDate.map((m) => ({ id: m.id, meetingDateKey: m.meeting_date, startTime: m.start_time })),
    todayKey,
  );

  const groupsByClass = new Map<string, AgendaGroup>();
  for (const meeting of withDate) {
    const klass = classById.get(meeting.class_id);
    const offering = klass ? offeringById.get(klass.season_volume_offering_id) : undefined;
    const volumeName = offering ? (volumeNameById.get(offering.volume_id) ?? "Volume") : "Volume";

    const group = groupsByClass.get(meeting.class_id) ?? {
      classId: meeting.class_id,
      className: klass?.name ?? "Turma",
      volumeName,
      location: klass?.location ?? null,
      meetings: [],
      earliestUpcomingKey: null,
    };

    const isPast = meeting.meeting_date < todayKey;
    group.meetings.push({
      id: meeting.id,
      dateLabel: formatSaoPauloLongDate(meeting.meeting_date, { capitalize: true }),
      timeLabel: formatSaoPauloTimeRange(meeting.start_time, meeting.end_time),
      isPast,
      isNext: meeting.id === nextMeeting?.id,
    });

    if (!isPast && (group.earliestUpcomingKey === null || meeting.meeting_date < group.earliestUpcomingKey)) {
      group.earliestUpcomingKey = meeting.meeting_date;
    }

    groupsByClass.set(meeting.class_id, group);
  }

  const groups = [...groupsByClass.values()].sort((a, b) => {
    // Turmas com encontro futuro vêm antes das que só têm encontros passados;
    // entre si, ordena pela data do próximo encontro.
    if (a.earliestUpcomingKey && b.earliestUpcomingKey) {
      return a.earliestUpcomingKey < b.earliestUpcomingKey ? -1 : 1;
    }
    if (a.earliestUpcomingKey) return -1;
    if (b.earliestUpcomingKey) return 1;
    return a.className.localeCompare(b.className);
  });

  const withoutDateByClass = new Map<string, { className: string; volumeName: string; count: number }>();
  for (const meeting of withoutDate) {
    const klass = classById.get(meeting.class_id);
    const offering = klass ? offeringById.get(klass.season_volume_offering_id) : undefined;
    const volumeName = offering ? (volumeNameById.get(offering.volume_id) ?? "Volume") : "Volume";
    const entry = withoutDateByClass.get(meeting.class_id) ?? { className: klass?.name ?? "Turma", volumeName, count: 0 };
    entry.count += 1;
    withoutDateByClass.set(meeting.class_id, entry);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Agenda</h1>
        <p className="mt-1 text-sm text-neutral-500">Encontros das suas turmas matriculadas.</p>
      </div>

      {groups.length === 0 && withoutDateByClass.size === 0 ? (
        <Card>
          <p className="text-sm text-neutral-400">Nenhum encontro cadastrado ainda para as suas turmas.</p>
        </Card>
      ) : null}

      {groups.map((group) => (
        <Card key={group.classId}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-neutral-900">
              {group.volumeName} <span className="text-neutral-400">·</span> {group.className}
            </h2>
            {group.location ? (
              <a
                href={buildMapsSearchUrl(group.location)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
              >
                <MapPin className="size-3.5" aria-hidden="true" />
                Abrir rota
              </a>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">{group.location ?? "Local a confirmar"}</p>

          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {group.meetings.map((meeting) => (
              <li key={meeting.id} className="flex items-center gap-3 py-2.5">
                {meeting.isPast ? (
                  <CalendarCheck className="size-4 shrink-0 text-neutral-300" aria-hidden="true" />
                ) : (
                  <CalendarClock
                    className={`size-4 shrink-0 ${meeting.isNext ? "text-brand-blue" : "text-neutral-400"}`}
                    aria-hidden="true"
                  />
                )}
                <span className={meeting.isPast ? "text-neutral-400" : "text-neutral-700"}>
                  {meeting.dateLabel}
                  {meeting.timeLabel ? ` · ${meeting.timeLabel}` : ""}
                </span>
                {meeting.isNext ? (
                  <span className="rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Próximo
                  </span>
                ) : null}
                {meeting.isPast ? (
                  <span className="text-xs text-neutral-400">Realizado</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {withoutDateByClass.size > 0 ? (
        <Card>
          <h2 className="text-sm font-medium text-neutral-700">Encontros previstos (sem data confirmada)</h2>
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {[...withoutDateByClass.entries()].map(([classId, entry]) => (
              <li key={classId} className="py-1.5 text-neutral-500">
                {entry.volumeName} · {entry.className} — {entry.count} encontro(s) ainda sem data
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div>
        <Link href="/meus-volumes" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Ver meus volumes
        </Link>
      </div>
    </div>
  );
}
