import Papa from "papaparse";
import { formatSaoPauloDateTime } from "@/lib/saoPauloDate";
import { grNetworkLabel, scheduleLabel, volumeLabel } from "./labels";
import { ENROLLMENT_STATUS_LABELS, type EnrollmentRequestRow } from "./types";

/**
 * Monta o CSV de inscrições — cabeçalhos em português, só as colunas que a
 * coordenação tem autorização para ver (nunca o CPF completo, só os 4
 * últimos dígitos, iguais aos exibidos no painel). BOM UTF-8 no início
 * para o Excel reconhecer acentuação sem configuração extra.
 */
function yesNo(value: boolean | null): string {
  if (value === null) return "";
  return value ? "Sim" : "Não";
}

export function buildEnrollmentRequestsCsv(rows: EnrollmentRequestRow[]): string {
  const data = rows.map((row) => ({
    Protocolo: row.protocol,
    "Nome completo": row.fullName,
    "E-mail": row.email,
    WhatsApp: row.phone,
    "CPF (últimos 4 dígitos)": row.cpfLast4,
    "Volume principal": volumeLabel(row.primaryVolumeSlug),
    "Turma principal": scheduleLabel(row.primaryScheduleSlug),
    "Segundo volume": row.wantsSecondVolume ? volumeLabel(row.secondaryVolumeSlug) : "",
    "Turma do segundo volume": row.wantsSecondVolume ? scheduleLabel(row.secondaryScheduleSlug) : "",
    "Declaração de pré-requisito": row.prerequisiteDeclaration ?? "",
    "Frequenta outra igreja": yesNo(row.isOtherChurchMember),
    "Qual outra igreja": row.otherChurchName ?? "",
    "Membro da Emaús": yesNo(row.isEmausMember),
    "Tem GR": row.isEmausMember ? yesNo(row.hasGr) : "",
    "Rede do GR": row.hasGr ? grNetworkLabel(row.grNetworkSlug) : "",
    Observações: row.notes ?? "",
    Status: ENROLLMENT_STATUS_LABELS[row.status],
    "Data da inscrição": formatSaoPauloDateTime(row.createdAt),
  }));

  const csv = Papa.unparse(data, { header: true });
  return `﻿${csv}`;
}

export function buildEnrollmentCsvFilename(now: Date = new Date()): string {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `inscricoes-makarios-${key}.csv`;
}
