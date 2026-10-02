import { describe, expect, it } from "vitest";
import {
  evaluateScan,
  locationVerdict,
  makeupTargetSequence,
  toMinutes,
  weekStartOf,
} from "@/modules/attendance/rules";

const tercaQuinta = { startTime: "19:30:00", endTime: "21:50:00", breakMinutes: 20 };
const sabado = { startTime: "08:00:00", endTime: "12:30:00", breakMinutes: 30 };
const at = (t: string) => toMinutes(t);

describe("evaluateScan — terça/quinta", () => {
  it("chegou cedo: aulas 1 e 2", () => {
    expect(evaluateScan(tercaQuinta, at("19:20"))).toMatchObject({ block: 1, lessonsCredited: 2, recognizedMinutes: 60 });
  });
  it("dentro da tolerância de 15 min: aulas 1 e 2", () => {
    expect(evaluateScan(tercaQuinta, at("19:45"))?.lessonsCredited).toBe(2);
  });
  it("passou da tolerância da aula 1: só a aula 2", () => {
    expect(evaluateScan(tercaQuinta, at("19:46"))?.lessonsCredited).toBe(1);
    expect(evaluateScan(tercaQuinta, at("19:50"))?.lessonsCredited).toBe(1);
  });
  it("passou da tolerância das duas: nenhuma aula do bloco 1", () => {
    expect(evaluateScan(tercaQuinta, at("20:16"))).toMatchObject({ block: 1, lessonsCredited: 0 });
  });
  it("na volta do intervalo abre o bloco 2", () => {
    expect(evaluateScan(tercaQuinta, at("20:35"))).toMatchObject({ block: 2, lessonsTotal: 2, lessonsCredited: 2 });
    expect(evaluateScan(tercaQuinta, at("21:20"))).toMatchObject({ block: 2, lessonsCredited: 1 });
  });
  it("fora do horário: nada", () => {
    expect(evaluateScan(tercaQuinta, at("18:59"))).toBeNull();
    expect(evaluateScan(tercaQuinta, at("21:50"))).toBeNull();
  });
});

describe("evaluateScan — sábado", () => {
  it("4 aulas por bloco", () => {
    expect(evaluateScan(sabado, at("07:50"))).toMatchObject({ block: 1, lessonsTotal: 4, lessonsCredited: 4, recognizedMinutes: 120 });
    expect(evaluateScan(sabado, at("08:50"))).toMatchObject({ block: 1, lessonsCredited: 2 });
    expect(evaluateScan(sabado, at("10:30"))).toMatchObject({ block: 2, lessonsCredited: 4 });
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
