import { describe, expect, it } from "vitest";
import { dayLessons, isLessonOpen, lessonNumbersOfScan } from "@/modules/attendance/dayLessons";
import { scanLessons } from "@/modules/attendance/report";

const TUE_THU = { startTime: "19:30:00", endTime: "21:50:00", breakMinutes: 20 };
const SATURDAY = { startTime: "08:00:00", endTime: "12:30:00", breakMinutes: 30 };

describe("dayLessons", () => {
  it("terça/quinta: 4 aulas de 30 min, 2 antes e 2 depois do intervalo", () => {
    const lessons = dayLessons(TUE_THU);
    expect(lessons.map((l) => [l.number, l.block, l.start, l.end])).toEqual([
      [1, 1, "19:30", "20:00"],
      [2, 1, "20:00", "20:30"],
      [3, 2, "20:50", "21:20"],
      [4, 2, "21:20", "21:50"],
    ]);
  });

  it("sábado: 8 aulas, o bloco 2 continua a numeração (5 a 8)", () => {
    const lessons = dayLessons(SATURDAY);
    expect(lessons).toHaveLength(8);
    expect(lessons.filter((l) => l.block === 2).map((l) => l.number)).toEqual([5, 6, 7, 8]);
    expect(lessons[4]?.start).toBe("10:30");
  });

  it("associa a matéria ao horário de cada aula", () => {
    const lessons = dayLessons(TUE_THU, [
      { start: 19 * 60 + 30, end: 20 * 60 + 30, name: "Antigo Testamento" },
      { start: 20 * 60 + 50, end: 21 * 60 + 50, name: "Dons" },
    ]);
    expect(lessons.map((l) => l.subject)).toEqual(["Antigo Testamento", "Antigo Testamento", "Dons", "Dons"]);
  });

  it("sem escala montada, a matéria fica vazia", () => {
    expect(dayLessons(TUE_THU).every((l) => l.subject === null)).toBe(true);
  });
});

describe("isLessonOpen", () => {
  const lesson = { startMinute: 20 * 60 + 50 };
  it("abre 30 min antes do início da aula", () => {
    expect(isLessonOpen(lesson, 20 * 60 + 19)).toBe(false);
    expect(isLessonOpen(lesson, 20 * 60 + 20)).toBe(true);
    expect(isLessonOpen(lesson, 22 * 60)).toBe(true);
  });
});

describe("lessonNumbersOfScan / scanLessons", () => {
  it("registro novo: usa exatamente o que o aluno marcou (mesmo não contíguo)", () => {
    const row = { block: 1, lessons_credited: 2, lessons_total: 4, lesson_numbers: [4, 1] };
    expect(lessonNumbersOfScan(row)).toEqual([1, 4]);
    expect(scanLessons({ block: 1, lessonsCredited: 2, lessonsTotal: 4, lessonNumbers: [4, 1] })).toEqual([1, 4]);
  });

  it("registro antigo: deduz as últimas aulas do bloco", () => {
    expect(lessonNumbersOfScan({ block: 1, lessons_credited: 1, lessons_total: 2, lesson_numbers: null })).toEqual([2]);
    expect(lessonNumbersOfScan({ block: 2, lessons_credited: 2, lessons_total: 2, lesson_numbers: null })).toEqual([3, 4]);
    expect(scanLessons({ block: 2, lessonsCredited: 1, lessonsTotal: 4, lessonNumbers: null })).toEqual([8]);
  });
});
