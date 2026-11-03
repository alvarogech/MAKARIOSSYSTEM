import "server-only";

import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { ExportTable } from "./lists";

/** CSV com BOM, para o Excel reconhecer a acentuação sem configuração. */
export function toCsv(table: ExportTable): string {
  return `﻿${Papa.unparse({ fields: table.headers, data: table.rows })}`;
}

export async function toXlsx(table: ExportTable, sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 30));
  sheet.addRow(table.headers).font = { bold: true };
  for (const row of table.rows) sheet.addRow(row);
  sheet.columns.forEach((column, i) => {
    const longest = Math.max(table.headers[i]?.length ?? 8, ...table.rows.map((r) => (r[i] ?? "").length));
    column.width = Math.min(48, Math.max(12, longest + 2));
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
