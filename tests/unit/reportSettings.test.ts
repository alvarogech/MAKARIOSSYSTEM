import { describe, expect, it } from "vitest";
import { isMeetingOver, isRelatorioAtivo, reportState } from "@/modules/teaching/reportSettings";
import { can } from "@/authorization";
import type { AuthContext } from "@/authorization";

describe("isRelatorioAtivo", () => {
  it("só é ativo quando o semestre diz true; ausente ou nulo = desligado", () => {
    expect(isRelatorioAtivo({ require_class_report: true })).toBe(true);
    expect(isRelatorioAtivo({ require_class_report: false })).toBe(false);
    expect(isRelatorioAtivo({})).toBe(false);
    expect(isRelatorioAtivo(null)).toBe(false);
    expect(isRelatorioAtivo(undefined)).toBe(false);
  });
});

describe("isMeetingOver", () => {
  // Quinta 08/10/2026, aula até 21:50 (horário de São Paulo = UTC-3 → 00:50Z do dia seguinte).
  it("só depois do horário de término", () => {
    expect(isMeetingOver("2026-10-08", "21:50:00", new Date("2026-10-09T00:49:00Z"))).toBe(false);
    expect(isMeetingOver("2026-10-08", "21:50:00", new Date("2026-10-09T00:50:00Z"))).toBe(true);
  });

  it("antes da aula (mesmo dia) ainda não está encerrado", () => {
    expect(isMeetingOver("2026-10-08", "21:50:00", new Date("2026-10-08T20:00:00Z"))).toBe(false);
  });

  it("sem data ou horário não está encerrado", () => {
    expect(isMeetingOver(null, "21:50:00", new Date())).toBe(false);
    expect(isMeetingOver("2026-10-08", null, new Date())).toBe(false);
  });

  it("aceita horário sem segundos", () => {
    expect(isMeetingOver("2026-10-08", "21:50", new Date("2026-10-09T01:00:00Z"))).toBe(true);
  });
});

describe("reportState", () => {
  it("desligado vence tudo", () => {
    expect(reportState({ active: false, scheduled: true, over: true })).toBe("inactive");
  });
  it("ligado: exige estar escalado e a aula ter terminado, nessa ordem", () => {
    expect(reportState({ active: true, scheduled: false, over: true })).toBe("not_scheduled");
    expect(reportState({ active: true, scheduled: true, over: false })).toBe("not_over");
    expect(reportState({ active: true, scheduled: true, over: true })).toBe("open");
  });
});

describe("permissão do interruptor", () => {
  const base = { userId: "u", fullName: "x", profileStatus: "active" } as const;
  const ctx = (role: string) => ({ ...base, roles: [role], activeRole: role }) as unknown as AuthContext;
  it("só o administrador altera a exigência do relatório", () => {
    const check = { resource: "seasons", action: "set_report_requirement" } as const;
    expect(can(ctx("admin"), check)).toBe(true);
    expect(can(ctx("coordinator"), check)).toBe(false);
    expect(can(ctx("teacher"), check)).toBe(false);
    expect(can(ctx("student"), check)).toBe(false);
  });
});
