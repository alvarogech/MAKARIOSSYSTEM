import { formatBrazilianPhone } from "@/services/phone";
import { CONTACT_LABELS, contactStatusOf, isOverdue, type BoardRow } from "./boardView";
import { PENDENCY_LABELS, type ModuleStatus, type OverallStatus } from "./types";

/** O que a tabela de candidatos precisa, em dados simples (atravessam servidor → navegador). */
export interface CandidateVM {
  studentId: string;
  name: string;
  email: string | null;
  phone: string | null;
  className: string | null;
  seasonName: string | null;
  modules: { slug: string; label: string; status: ModuleStatus; seasonName: string | null }[];
  attendancePct: number | null;
  grade: number | null;
  overall: OverallStatus;
  openCount: number;
  categories: string[];
  contactLabel: string;
  responsibleName: string | null;
  overdue: boolean;
  invited: boolean;
  response: string;
  nextAction: string | null;
}

export function toCandidateVM(row: BoardRow, todayKey: string): CandidateVM {
  const firstOpen = row.evaluation.requirements.find((r) => r.blocking && r.state !== "cumprido" && r.state !== "em_andamento");
  return {
    studentId: row.studentId,
    name: row.name,
    email: row.email,
    phone: row.phone ? formatBrazilianPhone(row.phone) : null,
    className: row.className,
    seasonName: row.seasonName,
    modules: row.evaluation.modules.map((m) => ({ slug: m.slug, label: m.label, status: m.status, seasonName: m.seasonName })),
    attendancePct: row.vozAttendancePct,
    grade: row.vozGrade,
    overall: row.evaluation.overall,
    openCount: row.evaluation.openCount,
    categories: row.evaluation.categories.map((c) => PENDENCY_LABELS[c]),
    contactLabel: CONTACT_LABELS[contactStatusOf(row)],
    responsibleName: row.followUp?.responsibleName ?? null,
    overdue: isOverdue(row, todayKey),
    invited: !!row.participant.invitedAt,
    response: row.participant.response,
    nextAction: row.followUp?.nextStep ?? firstOpen?.title ?? null,
  };
}
