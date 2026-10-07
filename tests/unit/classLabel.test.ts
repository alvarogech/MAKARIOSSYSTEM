import { describe, expect, it } from "vitest";
import { classScheduleLabel, classTagLabel } from "@/lib/classLabel";

describe("classTagLabel", () => {
  it("trilha + turma sem repetir o nome do volume", () => {
    expect(classTagLabel("Essência", "Essência — Turma (terça/quinta)")).toBe("Essência · Ter/Qui");
    expect(classTagLabel("Caminho", "Caminho — Turma (sábado)")).toBe("Caminho · Sáb");
  });
  it("sem parênteses usa o que vem depois do traço", () => {
    expect(classScheduleLabel("Voz — Turma A")).toBe("Turma A");
  });
  it("nome simples permanece", () => {
    expect(classScheduleLabel("Turma única")).toBe("Turma única");
  });
});
