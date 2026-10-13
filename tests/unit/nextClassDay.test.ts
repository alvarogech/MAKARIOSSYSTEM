import { describe, expect, it } from "vitest";
import {
  formatDayHeading,
  groupMeetingsByDate,
  isActiveMeeting,
  meetingTimeState,
  pickNextClassDay,
  pluralize,
  scheduleLabelFromSlug,
  shortPersonName,
  summarizeBlocks,
  type UpcomingMeeting,
} from "@/modules/academic/nextClassDay";
import { getSaoPauloMinuteOfDay } from "@/lib/saoPauloDate";

const meeting = (over: Partial<UpcomingMeeting> = {}): UpcomingMeeting => ({
  meetingId: "m1",
  classId: "c1",
  className: "Essência — Turma (terça/quinta)",
  sequence: 1,
  date: "2026-10-15",
  start: "19:30",
  end: "21:50",
  teachers: [],
  subjects: [],
  volumeName: "Essência",
  scheduleLabel: "Turma terça/quinta",
  status: "scheduled",
  classStatus: "planning",
  timeState: "upcoming",
  ...over,
});

/** Instante UTC a partir de hora de parede em São Paulo (UTC-3, sem horário de verão). */
const sp = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`);

describe("pickNextClassDay", () => {
  it("aula futura no mesmo dia: o próximo dia é hoje", () => {
    const day = pickNextClassDay([meeting()], sp("2026-10-15", "12:00"));
    expect(day?.date).toBe("2026-10-15");
    expect(day?.isToday).toBe(true);
  });

  it("aula em andamento (começou, ainda não terminou) conta como próxima", () => {
    const day = pickNextClassDay([meeting()], sp("2026-10-15", "20:30"));
    expect(day?.isToday).toBe(true);
    expect(day?.meetings).toHaveLength(1);
  });

  it("aula de hoje já encerrada não é tratada como próxima: vai para o outro dia", () => {
    const meetings = [meeting({ meetingId: "hoje" }), meeting({ meetingId: "amanha", date: "2026-10-20" })];
    const day = pickNextClassDay(meetings, sp("2026-10-15", "22:00"));
    expect(day?.date).toBe("2026-10-20");
    expect(day?.isToday).toBe(false);
    expect(day?.meetings.map((m) => m.meetingId)).toEqual(["amanha"]);
  });

  it("no minuto exato do término a aula já está encerrada", () => {
    expect(pickNextClassDay([meeting()], sp("2026-10-15", "21:50"))).toBeNull();
    expect(pickNextClassDay([meeting()], sp("2026-10-15", "21:49"))?.isToday).toBe(true);
  });

  it("próxima aula em outro dia (hoje não tem aula)", () => {
    const day = pickNextClassDay([meeting({ date: "2026-10-22" }), meeting({ meetingId: "m2", date: "2026-10-17" })], sp("2026-10-15", "09:00"));
    expect(day?.date).toBe("2026-10-17");
    expect(day?.isToday).toBe(false);
  });

  it("várias turmas na mesma data: todas aparecem, por horário e depois por nome da turma", () => {
    const meetings = [
      meeting({ meetingId: "tarde", date: "2026-10-17", start: "10:30", end: "12:30", className: "Voz — Turma (sábado)" }),
      meeting({ meetingId: "b", date: "2026-10-17", start: "08:00", end: "12:30", className: "Voz — Turma (sábado)" }),
      meeting({ meetingId: "a", date: "2026-10-17", start: "08:00", end: "12:30", className: "Caminho — Turma (sábado)" }),
      meeting({ meetingId: "outro-dia", date: "2026-10-20" }),
    ];
    const day = pickNextClassDay(meetings, sp("2026-10-15", "09:00"));
    expect(day?.meetings.map((m) => m.meetingId)).toEqual(["a", "b", "tarde"]);
  });

  it("nenhuma aula futura: null", () => {
    expect(pickNextClassDay([], sp("2026-10-15", "09:00"))).toBeNull();
    expect(pickNextClassDay([meeting({ date: "2026-10-01" })], sp("2026-10-15", "09:00"))).toBeNull();
  });

  it("ignora aula cancelada, já dada e de turma encerrada", () => {
    const meetings = [
      meeting({ meetingId: "cancelada", date: "2026-10-16", status: "canceled" }),
      meeting({ meetingId: "dada", date: "2026-10-16", status: "done" }),
      meeting({ meetingId: "turma-encerrada", date: "2026-10-16", classStatus: "closed" }),
      meeting({ meetingId: "valida", date: "2026-10-18" }),
    ];
    expect(pickNextClassDay(meetings, sp("2026-10-15", "09:00"))?.meetings.map((m) => m.meetingId)).toEqual(["valida"]);
  });

  it("usa o dia de São Paulo, não o de UTC (22h30 do dia 15 em SP já é dia 16 em UTC)", () => {
    const now = new Date("2026-10-16T01:30:00Z"); // 22:30 de 15/10 em São Paulo
    const meetings = [meeting({ meetingId: "dia16", date: "2026-10-16", start: "08:00", end: "12:30" })];
    const day = pickNextClassDay(meetings, now);
    expect(day?.date).toBe("2026-10-16");
    expect(day?.isToday).toBe(false);
  });

  it("virada de mês: 31/10 à noite aponta para 03/11", () => {
    const day = pickNextClassDay([meeting({ date: "2026-10-31", start: "08:00", end: "12:30" }), meeting({ meetingId: "nov", date: "2026-11-03" })], sp("2026-10-31", "20:00"));
    expect(day?.date).toBe("2026-11-03");
  });

  it("virada de ano: 31/12 à noite aponta para 02/01 e o título mostra o ano", () => {
    const now = sp("2026-12-31", "22:00");
    const day = pickNextClassDay([meeting({ date: "2027-01-02", start: "08:00", end: "12:30" })], now);
    expect(day?.date).toBe("2027-01-02");
    expect(formatDayHeading(day!.date, "2026-12-31")).toBe("Sábado, 2 de janeiro de 2027");
  });
});

describe("meetingTimeState / isActiveMeeting", () => {
  it("encerrada, em andamento ou a começar", () => {
    const m = { date: "2026-10-15", start: "19:30", end: "21:50" };
    expect(meetingTimeState(m, "2026-10-15", 18 * 60)).toBe("upcoming");
    expect(meetingTimeState(m, "2026-10-15", 19 * 60 + 30)).toBe("ongoing");
    expect(meetingTimeState(m, "2026-10-15", 21 * 60 + 50)).toBe("ended");
    expect(meetingTimeState(m, "2026-10-16", 0)).toBe("ended");
    expect(meetingTimeState(m, "2026-10-14", 23 * 60)).toBe("upcoming");
  });

  it("só 'scheduled' em turma não encerrada é ativa", () => {
    expect(isActiveMeeting({ status: "scheduled", classStatus: "open" })).toBe(true);
    expect(isActiveMeeting({ status: "canceled", classStatus: "open" })).toBe(false);
    expect(isActiveMeeting({ status: "done", classStatus: "open" })).toBe(false);
    expect(isActiveMeeting({ status: "scheduled", classStatus: "closed" })).toBe(false);
  });
});

describe("groupMeetingsByDate", () => {
  it("agrupa por data em ordem cronológica e ordena cada dia por horário", () => {
    const groups = groupMeetingsByDate([
      meeting({ meetingId: "c", date: "2026-10-17", start: "10:30" }),
      meeting({ meetingId: "b", date: "2026-10-15", start: "19:30" }),
      meeting({ meetingId: "a", date: "2026-10-17", start: "08:00" }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-10-15", "2026-10-17"]);
    expect(groups[1]!.meetings.map((m) => m.meetingId)).toEqual(["a", "c"]);
  });
});

describe("summarizeBlocks", () => {
  const teacherNames = new Map([
    ["t1", "Alvaro Ferreira"],
    ["t2", "Thais Borges"],
  ]);
  const moduleNames = new Map([
    ["mod1", "Deus: Trindade, Atributos e Nomes"],
    ["mod2", "Criação e Queda"],
  ]);
  const block = (over: Partial<{ teacher_id: string | null; teacher_label: string | null; module_id: string | null; status: string }> = {}) => ({
    teacher_id: null,
    teacher_label: null,
    module_id: null,
    status: "scheduled",
    ...over,
  });

  it("várias matérias e professores, sem duplicados e na ordem dos blocos", () => {
    const result = summarizeBlocks(
      [
        block({ teacher_id: "t1", module_id: "mod1" }),
        block({ teacher_id: "t1", module_id: "mod1" }),
        block({ teacher_id: "t2", module_id: "mod2" }),
        block({ teacher_label: "Pr. Vinicius Motta", module_id: "mod2" }),
      ],
      teacherNames,
      moduleNames,
    );
    expect(result.teachers).toEqual(["Alvaro Ferreira", "Thais Borges", "Pr. Vinicius Motta"]);
    expect(result.subjects).toEqual(["Deus: Trindade, Atributos e Nomes", "Criação e Queda"]);
  });

  it("professor ou matéria ausente: listas vazias (a tela mostra 'não definido'/'não informada')", () => {
    expect(summarizeBlocks([block()], teacherNames, moduleNames)).toEqual({ teachers: [], subjects: [] });
    expect(summarizeBlocks([block({ teacher_id: "inexistente", module_id: "inexistente", teacher_label: "  " })], teacherNames, moduleNames)).toEqual({ teachers: [], subjects: [] });
  });

  it("ignora bloco cancelado e nome repetido com outra caixa", () => {
    const result = summarizeBlocks(
      [block({ teacher_id: "t1", status: "canceled" }), block({ teacher_label: "ana lima" }), block({ teacher_label: "Ana  Lima" })],
      teacherNames,
      moduleNames,
    );
    expect(result.teachers).toEqual(["ana lima"]);
  });
});

describe("rótulos e utilitários", () => {
  it("título da data por extenso, com 'Hoje' tratado pelo componente", () => {
    expect(formatDayHeading("2026-10-15", "2026-10-13")).toBe("Quinta-feira, 15 de outubro");
  });

  it("modalidade da turma", () => {
    expect(scheduleLabelFromSlug("terca_quinta")).toBe("Turma terça/quinta");
    expect(scheduleLabelFromSlug("sabado")).toBe("Turma sábado");
    expect(scheduleLabelFromSlug("outro")).toBeNull();
    expect(scheduleLabelFromSlug(null)).toBeNull();
  });

  it("nome curto sem título", () => {
    expect(shortPersonName("Pr. Vinicius Motta")).toBe("Vinicius");
    expect(shortPersonName("Pra. Erica Nicolau")).toBe("Erica");
    expect(shortPersonName("Alvaro Ferreira")).toBe("Alvaro");
  });

  it("plural correto", () => {
    expect(pluralize(0, "inscrição pendente", "inscrições pendentes")).toBe("0 inscrições pendentes");
    expect(pluralize(1, "inscrição pendente", "inscrições pendentes")).toBe("1 inscrição pendente");
    expect(pluralize(2, "item", "itens")).toBe("2 itens");
  });

  it("minuto do dia em São Paulo", () => {
    expect(getSaoPauloMinuteOfDay(new Date("2026-10-15T22:00:00Z"))).toBe(19 * 60);
    expect(getSaoPauloMinuteOfDay(new Date("2026-10-16T02:59:00Z"))).toBe(23 * 60 + 59);
    expect(getSaoPauloMinuteOfDay(new Date("2026-10-16T03:00:00Z"))).toBe(0);
  });
});
