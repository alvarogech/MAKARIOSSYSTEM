import { toProgressCredits, type CreditRow } from "./credits";
import { computeProgress, type Progress, type Situation } from "./progress";

/** Dados já carregados (sem banco aqui: tudo puro e testável). */
export interface OverviewClass {
  id: string;
  volume: string;
  schedule: string;
  label: string;
  meetings: {
    id: string;
    sequence: number;
    date: string;
    minutes: number;
    past: boolean;
    /** Aulas de 1 hora do encontro (2 na terça/quinta, 4 no sábado); a metade inicial é antes do intervalo. */
    lessonCount: number;
    hasTeacher: boolean;
    hasReport: boolean;
  }[];
  roster: { key: string; name: string; phone: string | null; stage: string }[];
}

export type OverviewCredit = CreditRow & { person_key: string; location_status: string | null };

export interface MeetingStat {
  id: string;
  sequence: number;
  date: string;
  past: boolean;
  rosterSize: number;
  present: number;
  /** % da turma presente (0–100) ou null se a turma não tem alunos. */
  pct: number | null;
  /** % presente em cada aula do encontro. */
  lessonPct: number[];
  qrCount: number;
  manualCount: number;
  declaredCount: number;
  badLocation: number;
  scanCount: number;
}

export interface PersonStat {
  key: string;
  name: string;
  phone: string | null;
  stage: string;
  progress: Progress;
  /** Horas cumpridas ÷ horas dos encontros já realizados (0–100); null se nada foi realizado ainda. */
  pctSoFar: number | null;
}

export interface ClassStat {
  id: string;
  label: string;
  volume: string;
  schedule: string;
  meetings: MeetingStat[];
  people: PersonStat[];
  /** Frequência média da turma (média das % dos alunos nos encontros já realizados). */
  avgPct: number | null;
}

export type Severity = "alta" | "media";
export interface Anomaly {
  severity: Severity;
  classLabel: string;
  meetingLabel: string;
  text: string;
}

export interface Overview {
  classes: ClassStat[];
  avgPct: number | null;
  /** em dia = em_dia + atenção leve; atenção = no limite; crítico = já abaixo dos 75%. */
  bands: { emDia: number; atencao: number; critico: number; total: number };
  lastMeeting: { label: string; pct: number | null; versusAvg: number | null } | null;
  sources: { qr: number; manual: number; reposicao: number; autodeclaracao: number };
  histogram: { label: string; count: number }[];
  anomalies: Anomaly[];
}

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
const avg = (xs: number[]) => (xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10);

export function bandOf(situation: Situation): "emDia" | "atencao" | "critico" {
  if (situation === "reprovado") return "critico";
  if (situation === "no_limite") return "atencao";
  return "emDia";
}

export function buildOverview(
  classes: OverviewClass[],
  credits: OverviewCredit[],
  options: { from?: string; to?: string } = {},
): Overview {
  const byPerson = new Map<string, OverviewCredit[]>();
  for (const c of credits) byPerson.set(c.person_key, [...(byPerson.get(c.person_key) ?? []), c]);

  const classStats: ClassStat[] = classes.map((klass) => {
    const rosterKeys = new Set(klass.roster.map((p) => p.key));
    const meetingInfos = klass.meetings.map((m) => ({ id: m.id, minutes: m.minutes, past: m.past }));

    const people: PersonStat[] = klass.roster.map((p) => {
      const progress = computeProgress(meetingInfos, toProgressCredits(byPerson.get(p.key) ?? []));
      const held = progress.attendedMinutes + progress.missedMinutes;
      return {
        key: p.key,
        name: p.name,
        phone: p.phone,
        stage: p.stage,
        progress,
        pctSoFar: held > 0 ? pct(progress.attendedMinutes, held) : null,
      };
    });

    const meetings: MeetingStat[] = klass.meetings
      .filter((m) => (!options.from || m.date >= options.from) && (!options.to || m.date <= options.to))
      .map((m) => {
        const own = credits.filter(
          (c) => c.meeting_id === m.id && c.counts_for_meeting_id === m.id && rosterKeys.has(c.person_key),
        );
        const presentKeys = new Set(own.filter((c) => c.minutes > 0).map((c) => c.person_key));
        const lessonPct = Array.from({ length: m.lessonCount }, (_, i) => {
          const n = new Set(own.filter((c) => (c.lessons ?? []).includes(i + 1)).map((c) => c.person_key)).size;
          return pct(n, klass.roster.length) ?? 0;
        });
        const scansHere = credits.filter((c) => c.meeting_id === m.id && rosterKeys.has(c.person_key));
        return {
          id: m.id,
          sequence: m.sequence,
          date: m.date,
          past: m.past,
          rosterSize: klass.roster.length,
          present: presentKeys.size,
          pct: pct(presentKeys.size, klass.roster.length),
          lessonPct,
          qrCount: scansHere.filter((c) => c.source === "qr").length,
          manualCount: scansHere.filter((c) => c.source === "manual").length,
          declaredCount: scansHere.filter((c) => c.source === "autodeclaracao").length,
          badLocation: scansHere.filter((c) => c.location_status === "sem_localizacao" || c.location_status === "longe").length,
          scanCount: scansHere.filter((c) => c.source === "qr" || c.source === "reposicao").length,
        };
      });

    const pcts = people.map((p) => p.pctSoFar).filter((x): x is number => x !== null);
    return { id: klass.id, label: klass.label, volume: klass.volume, schedule: klass.schedule, meetings, people, avgPct: avg(pcts) };
  });

  const allPeople = classStats.flatMap((c) => c.people);
  const bands = { emDia: 0, atencao: 0, critico: 0, total: allPeople.length };
  for (const p of allPeople) bands[bandOf(p.progress.situation)] += 1;

  const overallAvg = avg(allPeople.map((p) => p.pctSoFar).filter((x): x is number => x !== null));

  const heldMeetings = classStats.flatMap((c) => c.meetings.filter((m) => m.past).map((m) => ({ ...m, classLabel: c.label })));
  const lastDate = heldMeetings.map((m) => m.date).sort().at(-1);
  const lastOnes = heldMeetings.filter((m) => m.date === lastDate);
  const lastPct = avg(lastOnes.map((m) => m.pct).filter((x): x is number => x !== null));
  const lastMeeting = lastDate
    ? {
        label: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(`${lastDate}T12:00:00-03:00`)),
        pct: lastPct,
        versusAvg: lastPct !== null && overallAvg !== null ? Math.round((lastPct - overallAvg) * 10) / 10 : null,
      }
    : null;

  const sources = { qr: 0, manual: 0, reposicao: 0, autodeclaracao: 0 };
  const classKeySets = new Set(classes.flatMap((c) => c.roster.map((p) => p.key)));
  for (const c of credits) {
    if (!classKeySets.has(c.person_key)) continue;
    if (c.source in sources) sources[c.source as keyof typeof sources] += 1;
  }

  const bins = [
    { label: "90% ou mais", test: (x: number) => x >= 90 },
    { label: "75 a 89%", test: (x: number) => x >= 75 && x < 90 },
    { label: "50 a 74%", test: (x: number) => x >= 50 && x < 75 },
    { label: "Menos de 50%", test: (x: number) => x < 50 },
  ];
  const histogram = bins.map((b) => ({
    label: b.label,
    count: allPeople.filter((p) => p.pctSoFar !== null && b.test(p.pctSoFar)).length,
  }));

  return {
    classes: classStats,
    avgPct: overallAvg,
    bands,
    lastMeeting,
    sources,
    histogram,
    anomalies: detectAnomalies(classStats, classes),
  };
}

/** Sinais de falha técnica (ou de encontro problemático) nos encontros já realizados. */
export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round((sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
}

export function detectAnomalies(classStats: ClassStat[], classes: OverviewClass[]): Anomaly[] {
  const out: Anomaly[] = [];
  // Padrão geral da temporada: mediana da presença de todos os encontros já realizados, em todas as turmas.
  const everyPct = classStats.flatMap((c) => c.meetings.filter((m) => m.past && m.pct !== null).map((m) => m.pct as number));
  const overallMedian = everyPct.length >= 3 ? median(everyPct) : null;
  for (const klass of classStats) {
    if (klass.people.length === 0) continue;
    const held = klass.meetings.filter((m) => m.past);
    const classAvg = avg(held.map((m) => m.pct).filter((x): x is number => x !== null));
    const meta = classes.find((c) => c.id === klass.id);

    held.forEach((m, i) => {
      const where = `${klass.label}, encontro ${m.sequence}`;
      const base = { classLabel: klass.label, meetingLabel: `Encontro ${m.sequence}` };
      const previous = held[i - 1];

      if (m.scanCount === 0 && m.declaredCount === 0) {
        out.push({
          ...base,
          severity: "alta",
          text:
            m.manualCount > 0
              ? `${where}: nenhum registro de QR — só lançamentos manuais (${m.manualCount}). Pode ter havido falha na chamada.`
              : `${where}: encontro realizado sem nenhum registro de presença.`,
        });
      } else if (m.pct !== null && classAvg !== null && held.length > 1 && m.pct < classAvg * 0.5) {
        out.push({ ...base, severity: "alta", text: `${where}: presença de ${m.pct}% — menos da metade da média da turma (${classAvg}%).` });
      } else if (m.pct !== null && previous?.pct != null && previous.pct - m.pct > 30) {
        out.push({ ...base, severity: "media", text: `${where}: queda de ${Math.round(previous.pct - m.pct)} pontos em relação ao encontro anterior (${previous.pct}% → ${m.pct}%).` });
      } else if (m.pct !== null && klass.people.length >= 10 && m.pct < 40) {
        out.push({ ...base, severity: "media", text: `${where}: presença de apenas ${m.pct}% da turma — confira se houve falha na chamada.` });
      } else if (m.pct !== null && overallMedian !== null && klass.people.length >= 10 && m.pct < overallMedian * 0.75) {
        out.push({ ...base, severity: "media", text: `${where}: presença de ${m.pct}% — bem abaixo do padrão das demais turmas (mediana ${overallMedian}%).` });
      }

      const half = Math.floor(m.lessonPct.length / 2);
      if (half > 0) {
        const first = avg(m.lessonPct.slice(0, half));
        const second = avg(m.lessonPct.slice(half));
        if (first !== null && second !== null && first - second > 30) {
          out.push({ ...base, severity: "media", text: `${where}: ${first}% antes do intervalo e ${second}% depois — muita saída no intervalo ou falha no registro da volta.` });
        }
      }

      if (m.scanCount >= 5 && m.badLocation / m.scanCount >= 0.25) {
        out.push({ ...base, severity: "media", text: `${where}: ${m.badLocation} de ${m.scanCount} registros sem localização ou longe do local.` });
      }

      const mm = meta?.meetings.find((x) => x.id === m.id);
      if (mm && !mm.hasTeacher) out.push({ ...base, severity: "media", text: `${where}: encontro realizado sem professor atribuído.` });
      if (mm && mm.hasTeacher && !mm.hasReport) out.push({ ...base, severity: "media", text: `${where}: sem relatório pós-aula.` });
    });
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "alta" ? -1 : 1));
}
