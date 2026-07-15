import { z } from "zod";

/**
 * Validação por linha da importação de alunos (doc 06 §5). Função pura:
 * recebe a linha crua e "tabelas de consulta" já resolvidas (fornecidas
 * por quem chama, tipicamente carregadas do banco antes de validar o lote
 * inteiro) — não sabe nada sobre Postgres/Supabase, então é testável sem
 * banco.
 */

const emailSchema = z.string().trim().toLowerCase().email();

export interface ImportRawRow {
  rowNumber: number;
  raw: Record<string, string | undefined>;
}

export interface ImportLookupTables {
  findOffering(
    volumeName: string,
    seasonName: string,
  ): { offeringId: string } | null;
  findClass(offeringId: string, className: string): { classId: string } | null;
}

export interface ValidatedImportRow {
  rowNumber: number;
  fullName: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  offeringId: string;
  classId: string;
}

export interface ImportRowError {
  rowNumber: number;
  errors: string[];
}

export type ImportRowValidationResult =
  | { ok: true; row: ValidatedImportRow }
  | { ok: false; error: ImportRowError };

export function validateStudentImportRow(
  { rowNumber, raw }: ImportRawRow,
  lookups: ImportLookupTables,
): ImportRowValidationResult {
  const errors: string[] = [];

  const fullName = raw.nome?.trim();
  if (!fullName) {
    errors.push("Nome é obrigatório.");
  }

  const emailParse = emailSchema.safeParse(raw.email);
  if (!emailParse.success) {
    errors.push("E-mail é obrigatório e precisa ser válido.");
  }

  const volume = raw.volume?.trim();
  const season = raw.temporada?.trim();
  const className = raw.turma?.trim();

  if (!volume) errors.push("Volume é obrigatório.");
  if (!season) errors.push("Temporada é obrigatória.");
  if (!className) errors.push("Turma é obrigatória.");

  if (errors.length > 0) {
    return { ok: false, error: { rowNumber, errors } };
  }

  const offering = lookups.findOffering(volume!, season!);
  if (!offering) {
    errors.push(
      `Não existe oferta para o volume "${volume}" na temporada "${season}".`,
    );
    return { ok: false, error: { rowNumber, errors } };
  }

  const klass = lookups.findClass(offering.offeringId, className!);
  if (!klass) {
    errors.push(
      `A turma "${className}" não foi encontrada nesta oferta de volume.`,
    );
    return { ok: false, error: { rowNumber, errors } };
  }

  return {
    ok: true,
    row: {
      rowNumber,
      fullName: fullName!,
      // Neste ponto já garantimos errors.length === 0, então
      // emailParse.success é sempre true — o ternário só existe para
      // satisfazer o narrowing do TypeScript através do fluxo acima.
      email: emailParse.success ? emailParse.data : raw.email!.trim().toLowerCase(),
      phone: raw.telefone?.trim() || null,
      birthDate: raw.nascimento?.trim() || null,
      offeringId: offering.offeringId,
      classId: klass.classId,
    },
  };
}

/** Cabeçalhos esperados pela planilha, na ordem documentada (doc 06 §5). */
export const STUDENT_IMPORT_EXPECTED_HEADERS = [
  "nome",
  "email",
  "telefone",
  "nascimento",
  "volume",
  "temporada",
  "turma",
] as const;
