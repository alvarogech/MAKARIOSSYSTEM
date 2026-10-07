import { describe, expect, it } from "vitest";
import {
  locationVerdict,
  meetingBlocks,
  makeupTargetSequence,
  weekStartOf,
} from "@/modules/attendance/rules";

const tercaQuinta = { startTime: "19:30:00", endTime: "21:50:00", breakMinutes: 20 };
const sabado = { startTime: "08:00:00", endTime: "12:30:00", breakMinutes: 30 };

describe("meetingBlocks — aulas de 1 hora", () => {
  it("terça/quinta: 1 aula por bloco (2 por encontro, 2 h)", () => {
    const [b1, b2] = meetingBlocks(tercaQuinta);
    expect([b1.lessons, b2.lessons]).toEqual([1, 1]);
    expect([b1.start, b1.end, b2.start, b2.end]).toEqual([19 * 60 + 30, 20 * 60 + 30, 20 * 60 + 50, 21 * 60 + 50]);
  });
  it("sábado: 2 aulas por bloco (4 por encontro, 4 h)", () => {
    const [b1, b2] = meetingBlocks(sabado);
    expect([b1.lessons, b2.lessons]).toEqual([2, 2]);
    expect([b1.start, b1.end, b2.start, b2.end]).toEqual([8 * 60, 10 * 60, 10 * 60 + 30, 12 * 60 + 30]);
  });
});

describe("makeupTargetSequence", () => {
  it("meia manhã de sábado cobre um encontro de terça/quinta", () => {
    expect(makeupTargetSequence({ schedule: "sabado", sequence: 2, block: 1 }, "terca_quinta")).toBe(3);
    expect(makeupTargetSequence({ schedule: "sabado", sequence: 2, block: 2 }, "terca_quinta")).toBe(4);
  });
  it("terça/quinta repõe o sábado correspondente", () => {
    expect(makeupTargetSequence({ schedule: "terca_quinta", sequence: 3, block: 1 }, "sabado")).toBe(2);
    expect(makeupTargetSequence({ schedule: "terca_quinta", sequence: 8, block: 2 }, "sabado")).toBe(4);
  });
  it("mesma turma não é reposição", () => {
    expect(makeupTargetSequence({ schedule: "sabado", sequence: 1, block: 1 }, "sabado")).toBeNull();
  });
});

describe("locationVerdict", () => {
  const uneed = { lat: -16.6973877, lng: -49.2767771, radius: 200 };
  it("na Uneed: dentro", () => {
    expect(locationVerdict({ lat: -16.6975, lng: -49.2769, accuracy: 30 }, [uneed])).toBe("dentro");
  });
  it("a ~3 km, GPS bom: longe", () => {
    expect(locationVerdict({ lat: -16.695639, lng: -49.2485452, accuracy: 20 }, [uneed])).toBe("longe");
  });
  it("perto, mas GPS impreciso alcançando o local: impreciso", () => {
    expect(locationVerdict({ lat: -16.7, lng: -49.2767771, accuracy: 400 }, [uneed])).toBe("impreciso");
  });
});

describe("weekStartOf", () => {
  it("devolve a segunda-feira", () => {
    expect(weekStartOf("2026-10-03")).toBe("2026-09-28");
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05");
    expect(weekStartOf("2026-10-11")).toBe("2026-10-05");
  });
});
