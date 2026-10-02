import { describe, expect, it } from "vitest";
import { computeProgress, formatHours, type MeetingInfo } from "@/modules/attendance/progress";

const sabado: MeetingInfo[] = [1, 2, 3, 4].map((n) => ({ id: `s${n}`, minutes: 240, past: true }));
const tercaQuinta: MeetingInfo[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `t${n}`, minutes: 120, past: true }));
const full = (id: string, minutes: number) => ({ meetingId: id, makeupForMeetingId: null, minutes });

describe("computeProgress", () => {
  it("sábado: 1 falta fica no limite, 2 reprovam", () => {
    const umaFalta = computeProgress(sabado, ["s1", "s2", "s3"].map((id) => full(id, 240)));
    expect(umaFalta).toMatchObject({ absences: 1, situation: "no_limite", attendedMinutes: 720 });
    const duas = computeProgress(sabado, ["s1", "s2"].map((id) => full(id, 240)));
    expect(duas.situation).toBe("reprovado");
  });

  it("terça/quinta: 2 faltas no limite, 3 reprovam", () => {
    const ids = tercaQuinta.map((m) => m.id);
    expect(computeProgress(tercaQuinta, ids.slice(2).map((id) => full(id, 120))).situation).toBe("no_limite");
    expect(computeProgress(tercaQuinta, ids.slice(3).map((id) => full(id, 120))).situation).toBe("reprovado");
  });

  it("atraso conta proporcionalmente e reposição devolve as horas", () => {
    const scans = [
      ...["s1", "s2", "s3"].map((id) => full(id, 240)),
      { meetingId: "s4", makeupForMeetingId: null, minutes: 210 },
    ];
    expect(computeProgress(sabado, scans)).toMatchObject({ situation: "atencao", missedMinutes: 30, slackMinutes: 210 });
    const comReposicao = [
      ...["s1", "s2", "s3"].map((id) => full(id, 240)),
      { meetingId: "outra", makeupForMeetingId: "s4", minutes: 120 },
      { meetingId: "outra2", makeupForMeetingId: "s4", minutes: 120 },
    ];
    expect(computeProgress(sabado, comReposicao)).toMatchObject({ situation: "em_dia", attendedMinutes: 960 });
  });

  it("encontros futuros não contam como falta", () => {
    const meetings = sabado.map((m, i) => ({ ...m, past: i === 0 }));
    expect(computeProgress(meetings, [full("s1", 240)])).toMatchObject({ situation: "em_dia", absences: 0 });
  });

  it("formatHours", () => {
    expect(formatHours(720)).toBe("12h");
    expect(formatHours(90)).toBe("1h30");
  });
});
