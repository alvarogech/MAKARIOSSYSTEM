import { describe, expect, it } from "vitest";
import { buildEnrollmentCsvFilename, buildEnrollmentRequestsCsv } from "@/modules/enrollment/csv";
import type { EnrollmentRequestRow } from "@/modules/enrollment/types";

function makeRow(overrides: Partial<EnrollmentRequestRow> = {}): EnrollmentRequestRow {
  return {
    id: "1",
    protocol: "MK-2026-ABC123",
    fullName: "Fulano de Tal",
    cpfLast4: "1234",
    email: "fulano@example.com",
    phone: "62999999999",
    primaryVolumeSlug: "essencia",
    primaryScheduleSlug: "terca_quinta",
    wantsSecondVolume: false,
    secondaryVolumeSlug: null,
    secondaryScheduleSlug: null,
    prerequisiteDeclaration: null,
    notes: null,
    status: "pending",
    reviewedAt: null,
    reviewedBy: null,
    createdAt: "2026-03-12T14:00:00Z",
    updatedAt: "2026-03-12T14:00:00Z",
    ...overrides,
  };
}

describe("buildEnrollmentRequestsCsv", () => {
  it("inclui BOM UTF-8 e cabeçalhos em português", () => {
    const csv = buildEnrollmentRequestsCsv([makeRow()]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Nome completo");
    expect(csv).toContain("Fulano de Tal");
    expect(csv).toContain("Essência");
  });

  it("nunca inclui o CPF completo, só os últimos 4 dígitos", () => {
    const csv = buildEnrollmentRequestsCsv([makeRow({ cpfLast4: "4725" })]);
    expect(csv).toContain("4725");
    expect(csv).not.toContain("cpf_encrypted");
  });
});

describe("buildEnrollmentCsvFilename", () => {
  it("segue o padrão inscricoes-makarios-AAAA-MM-DD.csv", () => {
    expect(buildEnrollmentCsvFilename(new Date("2026-03-12T23:30:00Z"))).toBe(
      "inscricoes-makarios-2026-03-12.csv",
    );
  });
});
