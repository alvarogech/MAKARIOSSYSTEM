import { getSaoPauloDateKey, getSaoPauloMinuteOfDay } from "@/lib/saoPauloDate";

/**
 * Lógica pura (sem banco) do "Próximo dia de aula" e da lista "Próximos 7 dias" do início da
 * coordenação. Tudo parte da MESMA lista de encontros que `loadToday` já carrega — nada de segunda fonte.
 */

export type MeetingTimeState = "ended" | "ongoing" | "upcoming";

export interface UpcomingMeeting {
  meetingId: string;
  classId: string;
  className: string;
  sequence: number;
  /** "YYYY-MM-DD" (dia de calendário em São Paulo). */
  date: string;
  /** "HH:MM" */
  start: string;
  end: string;
  teachers: string[];
  subjects: string[];
  /** Curso/trilha (Caminho, Essência, Voz). */
  volumeName: string | null;
  /** Ex.: "Turma terça/quinta". */
  scheduleLabel: string | null;
  /** class_meetings.status: scheduled | done | canceled. */
  status: string;
  /** classes.status: planning | open | closed. */
  classStatus: string | null;
  timeState: MeetingTimeState;
}

export interface NextClassDay {
  date: string;
  isToday: boolean;
  /** Todas as aulas válidas da data, por horário e depois por nome da turma. */
  meetings: UpcomingMeeting[];
}

const toMinutes = (time: string) => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
};

const byStartThenClass = (a: UpcomingMeeting, b: UpcomingMeeting) =>
  toMinutes(a.start) - toMinutes(b.start) || a.className.localeCompare(b.className, "pt-BR");

/** Cancelada, já dada ("done") ou de turma encerrada ("closed") não conta como aula a acontecer. */
export function isActiveMeeting(m: Pick<UpcomingMeeting, "status" | "classStatus">): boolean {
  return m.status !== "canceled" && m.status !== "done" && m.classStatus !== "closed";
}

/** Situação do encontro em relação a agora (data e hora de São Paulo já resolvidas pelo chamador). */
export function meetingTimeState(m: Pick<UpcomingMeeting, "date" | "start" | "end">, todayKey: string, nowMinute: number): MeetingTimeState {
  if (m.date < todayKey) return "ended";
  if (m.date > todayKey) return "upcoming";
  if (toMinutes(m.end) <= nowMinute) return "ended";
  if (toMinutes(m.start) <= nowMinute) return "ongoing";
  return "upcoming";
}

/**
 * Próxima data com aula: hoje, se ainda houver aula cujo término não passou; senão a primeira data futura.
 * Devolve TODAS as aulas válidas dessa data. `null` quando não há nenhuma na lista recebida.
 * Compara chaves "YYYY-MM-DD" já no fuso de São Paulo (nunca a data UTC do servidor).
 */
export function pickNextClassDay(meetings: UpcomingMeeting[], now: Date): NextClassDay | null {
  const todayKey = getSaoPauloDateKey(now);
  const nowMinute = getSaoPauloMinuteOfDay(now);

  const candidates = meetings.filter((m) => isActiveMeeting(m) && meetingTimeState(m, todayKey, nowMinute) !== "ended");
  if (candidates.length === 0) return null;

  const date = candidates.reduce((min, m) => (m.date < min ? m.date : min), candidates[0]!.date);
  const sameDay = candidates.filter((m) => m.date === date).sort(byStartThenClass);
  return { date, isToday: date === todayKey, meetings: sameDay };
}

/** Agrupa por data (ordem cronológica), cada grupo por horário e nome da turma. */
export function groupMeetingsByDate(meetings: UpcomingMeeting[]): { date: string; meetings: UpcomingMeeting[] }[] {
  const groups = new Map<string, UpcomingMeeting[]>();
  for (const m of meetings) groups.set(m.date, [...(groups.get(m.date) ?? []), m]);
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, list]) => ({ date, meetings: [...list].sort(byStartThenClass) }));
}

const cleanName = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLocaleLowerCase("pt-BR");
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Matérias e professores de um encontro a partir dos blocos (sem duplicados, sem vazios, sem blocos cancelados). */
export function summarizeBlocks(
  blocks: { teacher_id: string | null; teacher_label: string | null; module_id: string | null; status: string }[],
  teacherNameById: Map<string, string>,
  moduleNameById: Map<string, string>,
): { teachers: string[]; subjects: string[] } {
  const active = blocks.filter((b) => b.status !== "canceled");
  return {
    teachers: unique(active.map((b) => cleanName(b.teacher_id ? teacherNameById.get(b.teacher_id) : b.teacher_label))),
    subjects: unique(active.map((b) => cleanName(b.module_id ? moduleNameById.get(b.module_id) : null))),
  };
}

const SCHEDULE_LABELS: Record<string, string> = { terca_quinta: "Turma terça/quinta", sabado: "Turma sábado" };

/** "Turma terça/quinta" / "Turma sábado" a partir do horário-modelo da turma. */
export function scheduleLabelFromSlug(slug: string | null | undefined): string | null {
  return slug ? (SCHEDULE_LABELS[slug] ?? null) : null;
}

/** Primeiro nome sem o título ("Pr.", "Pra."), para listas compactas. */
export function shortPersonName(name: string): string {
  return cleanName(name).replace(/^(pr|pra|pastor|pastora)\.?\s+/i, "").split(" ")[0] ?? name;
}

/** "Quinta-feira, 15 de outubro" (com o ano só quando não é o ano de hoje). */
export function formatDayHeading(dateKey: string, todayKey: string): string {
  const showYear = dateKey.slice(0, 4) !== todayKey.slice(0, 4);
  const text = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(showYear ? { year: "numeric" as const } : {}),
  }).format(new Date(`${dateKey}T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "3 inscrições pendentes" / "1 inscrição pendente". */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
