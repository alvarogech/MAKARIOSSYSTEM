import { describe, expect, it } from "vitest";
import {
  calculateAttendancePercent,
  isAttendanceSufficient,
  resolveRecognizedMinutes,
} from "@/services/attendance";

describe("resolveRecognizedMinutes", () => {
  it("presente reconhece os minutos acadêmicos inteiros do encontro", () => {
    expect(resolveRecognizedMinutes("presente", 120)).toBe(120);
  });

  it("ausente, falta justificada, pendente e reposição reconhecem zero", () => {
    expect(resolveRecognizedMinutes("ausente", 120)).toBe(0);
    expect(resolveRecognizedMinutes("falta_justificada", 120)).toBe(0);
    expect(resolveRecognizedMinutes("pendente", 120)).toBe(0);
    expect(resolveRecognizedMinutes("reposicao", 120)).toBe(0);
  });

  it("presença parcial usa o valor informado por quem registrou", () => {
    expect(resolveRecognizedMinutes("presenca_parcial", 120, 45)).toBe(45);
  });

  it("atrasado usa o valor informado por quem registrou", () => {
    expect(resolveRecognizedMinutes("atrasado", 120, 90)).toBe(90);
  });

  it("nunca reconhece mais minutos do que o encontro tem", () => {
    expect(resolveRecognizedMinutes("presenca_parcial", 120, 500)).toBe(120);
  });

  it("nunca reconhece minutos negativos", () => {
    expect(resolveRecognizedMinutes("atrasado", 120, -10)).toBe(0);
  });

  it("presença parcial sem valor informado reconhece zero (fail closed)", () => {
    expect(resolveRecognizedMinutes("presenca_parcial", 120, undefined)).toBe(0);
  });
});

describe("calculateAttendancePercent", () => {
  it("12 de 16 horas (720 de 960 min) resulta em 75% — critério de aceitação da Fase 6, já válido aqui", () => {
    expect(calculateAttendancePercent(720, 960)).toBe(75);
  });

  it("16 de 16 horas resulta em 100%", () => {
    expect(calculateAttendancePercent(960, 960)).toBe(100);
  });

  it("nunca ultrapassa 100% mesmo com minutos reconhecidos além do total", () => {
    expect(calculateAttendancePercent(1200, 960)).toBe(100);
  });

  it("carga total zero/negativa resulta em 0% (evita divisão por zero)", () => {
    expect(calculateAttendancePercent(500, 0)).toBe(0);
  });
});

describe("isAttendanceSufficient", () => {
  it("75% é suficiente (limite exato do padrão)", () => {
    expect(isAttendanceSufficient(75)).toBe(true);
  });

  it("74.9% não é suficiente", () => {
    expect(isAttendanceSufficient(74.9)).toBe(false);
  });

  it("respeita um mínimo customizado", () => {
    expect(isAttendanceSufficient(60, 50)).toBe(true);
  });
});
