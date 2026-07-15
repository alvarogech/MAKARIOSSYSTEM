import { describe, expect, it } from "vitest";
import {
  validateStudentImportRow,
  type ImportLookupTables,
} from "@/services/studentImport";

const lookups: ImportLookupTables = {
  findOffering(volumeName, seasonName) {
    if (volumeName === "Essência" && seasonName === "2026.2") {
      return { offeringId: "offering-essencia-2026-2" };
    }
    return null;
  },
  findClass(offeringId, className) {
    if (
      offeringId === "offering-essencia-2026-2" &&
      className === "Essência — Turma A (terça/quinta)"
    ) {
      return { classId: "class-tq" };
    }
    return null;
  },
};

describe("validateStudentImportRow", () => {
  it("valida uma linha completa e correta", () => {
    const result = validateStudentImportRow(
      {
        rowNumber: 2,
        raw: {
          nome: "Fulano de Tal",
          email: "Fulano@Makarios.local",
          telefone: "62999990000",
          nascimento: "2000-01-01",
          volume: "Essência",
          temporada: "2026.2",
          turma: "Essência — Turma A (terça/quinta)",
        },
      },
      lookups,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.email).toBe("fulano@makarios.local"); // normalizado para minúsculo
      expect(result.row.offeringId).toBe("offering-essencia-2026-2");
      expect(result.row.classId).toBe("class-tq");
    }
  });

  it("reporta nome e e-mail ausentes na mesma linha", () => {
    const result = validateStudentImportRow(
      { rowNumber: 5, raw: { volume: "Essência", temporada: "2026.2", turma: "x" } },
      lookups,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.rowNumber).toBe(5);
      expect(result.error.errors).toContain("Nome é obrigatório.");
      expect(result.error.errors).toContain(
        "E-mail é obrigatório e precisa ser válido.",
      );
    }
  });

  it("reporta e-mail em formato inválido", () => {
    const result = validateStudentImportRow(
      {
        rowNumber: 3,
        raw: {
          nome: "Fulano",
          email: "nao-e-um-email",
          volume: "Essência",
          temporada: "2026.2",
          turma: "Essência — Turma A (terça/quinta)",
        },
      },
      lookups,
    );

    expect(result.ok).toBe(false);
  });

  it("reporta oferta inexistente para o volume/temporada informados", () => {
    const result = validateStudentImportRow(
      {
        rowNumber: 4,
        raw: {
          nome: "Fulano",
          email: "fulano@makarios.local",
          volume: "Voz",
          temporada: "3026.1",
          turma: "qualquer",
        },
      },
      lookups,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errors[0]).toMatch(/Não existe oferta/);
    }
  });

  it("reporta turma inexistente dentro de uma oferta que existe", () => {
    const result = validateStudentImportRow(
      {
        rowNumber: 6,
        raw: {
          nome: "Fulano",
          email: "fulano@makarios.local",
          volume: "Essência",
          temporada: "2026.2",
          turma: "Turma que não existe",
        },
      },
      lookups,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errors[0]).toMatch(/não foi encontrada/);
    }
  });
});
