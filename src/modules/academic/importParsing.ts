import "server-only";

import Papa from "papaparse";
import ExcelJS from "exceljs";
import type { ImportRawRow } from "@/services/studentImport";

/**
 * Lê um arquivo enviado (.csv ou .xlsx) e devolve linhas cruas com número
 * de linha da planilha (linha 1 = cabeçalho, dados começam na linha 2).
 * Nenhuma validação de conteúdo acontece aqui — só leitura de arquivo.
 */
export async function parseImportFile(file: File): Promise<ImportRawRow[]> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".csv")) {
    return parseCsv(buffer.toString("utf-8"));
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseXlsx(buffer);
  }

  throw new Error(
    "Formato de arquivo não suportado. Envie um arquivo .csv ou .xlsx.",
  );
}

function parseCsv(content: string): ImportRawRow[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  return result.data.map((raw, index) => ({
    rowNumber: index + 2,
    raw,
  }));
}

async function parseXlsx(buffer: Buffer): Promise<ImportRawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    return [];
  }

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim().toLowerCase();
  });

  const rows: ImportRawRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const raw: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        raw[header] = cellValueToString(cell.value);
      }
    });

    if (Object.values(raw).some((value) => value.trim() !== "")) {
      rows.push({ rowNumber, raw });
    }
  });

  return rows;
}

function cellValueToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: unknown }).text ?? "");
  }
  return String(value);
}
