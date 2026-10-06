import { describe, expect, it } from "vitest";
import { dayLessons, lessonNumbersOfScan, lessonsFromUnits } from "@/modules/attendance/dayLessons";
import { scanLessons } from "@/modules/attendance/report";

const TUE_THU = { startTime: "19:30:00", endTime: "21:50:00", breakMinutes: 20 };
const SATURDAY = { startTime: "08:00:00", endTime: "12:30:00", breakMinutes: 30 };

describe("dayLessons", () => {
  it("terça/quinta: 2 aulas de 1 hora, uma antes e uma depois do intervalo", () => {
    const lessons = dayLessons(TUE_THU);
    expect(lessons.map((l) => [l.number, l.block, l.start, l.end])).toEqual([
      [1, 1, "19:30", "20:30"],
      [2, 2, "20:50", "21:50"],
    ]);
  });

  it("sábado: 4 aulas de 1 hora, duas por bloco (o bloco 2 continua a numeração)", () => {
    const lessons = dayLessons(SATURDAY);
    expect(lessons.map((l) => [l.number, l.block, l.start])).toEqual([
      [1, 1, "08:00"],
      [2, 1, "09:00"],
      [3, 2, "10:30"],
      [4, 2, "11:30"],
    ]);
  });

  it("cada aula cobre 2 unidades de 30 min, como o banco registra", () => {
    expect(dayLessons(SATURDAY).map((l) => l.units)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    expect(dayLessons(TUE_THU).map((l) => l.units)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("associa a matéria ao horário de cada aula", () => {
    const lessons = dayLessons(TUE_THU, [
      { start: 19 * 60 + 30, end: 20 * 60 + 30, name: "Antigo Testamento" },
      { start: 20 * 60 + 50, end: 21 * 60 + 50, name: "Dons" },
    ]);
    expect(lessons.map((l) => l.subject)).toEqual(["Antigo Testamento", "Dons"]);
  });

  it("sem escala montada, a matéria fica vazia", () => {
    expect(dayLessons(TUE_THU).every((l) => l.subject === null)).toBe(true);
  });
});

describe("lessonsFromUnits", () => {
  it("só conta a aula quando as duas unidades de 30 min estão registradas", () => {
    const lessons = dayLessons(SATURDAY);
    expect(lessonsFromUnits(lessons, [1, 2, 3, 4])).toEqual([1, 2]);
    expect(lessonsFromUnits(lessons, [2, 3, 4])).toEqual([2]);
    expect(lessonsFromUnits(lessons, [])).toEqual([]);
  });
});

describe("lessonNumbersOfScan / scanLessons", () => {
  it("registro novo: usa exatamente o que o aluno marcou", () => {
    const row = { block: 1, lessons_credited: 2, lessons_total: 4, lesson_numbers: [4, 1] };
    expect(lessonNumbersOfScan(row)).toEqual([1, 4]);
    expect(scanLessons({ block: 1, lessonsCredited: 2, lessonsTotal: 4, lessonNumbers: [4, 1] })).toEqual([1, 4]);
  });

  it("registro antigo: deduz as últimas unidades do bloco", () => {
    expect(lessonNumbersOfScan({ block: 1, lessons_credited: 1, lessons_total: 2, lesson_numbers: null })).toEqual([2]);
    expect(lessonNumbersOfScan({ block: 2, lessons_credited: 2, lessons_total: 2, lesson_numbers: null })).toEqual([3, 4]);
    expect(scanLessons({ block: 2, lessonsCredited: 1, lessonsTotal: 4, lessonNumbers: null })).toEqual([8]);
  });
});
