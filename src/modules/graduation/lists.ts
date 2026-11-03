import { formatBrazilianPhone } from "@/services/phone";
import type { BoardRow } from "./boardView";
import { OVERALL_LABELS, MODULE_STATUS_LABELS } from "./eligibility";
import { MODULES, MODULE_LABELS } from "./types";

/**
 * Listas e relatórios da formatura (puros e testáveis). Cada lista é um recorte
 * dos mesmos candidatos já calculados; nenhuma tem lógica própria de aptidão.
 */

export const LISTS = [
  { code: "aptos", label: "Todos os aptos" },
  { code: "convidados", label: "Todos os convidados" },
  { code: "confirmados", label: "Confirmados" },
  { code: "nao_confirmados", label: "Não confirmados (não vão ou ainda não responderam)" },
  { code: "sem_resposta", label: "Sem resposta" },
  { code: "final", label: "Lista final de participantes" },
  { code: "concluiram_sem_participar", label: "Concluíram, mas não participarão" },
  { code: "certificados", label: "Preparação dos certificados" },
] as const;
export type ListCode = (typeof LISTS)[number]["code"];

export const isListCode = (value: string): value is ListCode => LISTS.some((l) => l.code === value);

const invited = (r: BoardRow) => !!r.participant.invitedAt;
const apto = (r: BoardRow) => r.evaluation.overall === "apto";

export function selectList(rows: BoardRow[], code: ListCode): BoardRow[] {
  switch (code) {
    case "aptos":
      return rows.filter(apto);
    case "convidados":
      return rows.filter(invited);
    case "confirmados":
      return rows.filter((r) => invited(r) && r.participant.response === "confirmado");
    case "nao_confirmados":
      return rows.filter((r) => invited(r) && r.participant.response !== "confirmado");
    case "sem_resposta":
      return rows.filter((r) => invited(r) && r.participant.response === "sem_resposta");
    // A lista final exige confirmação E aptidão atual: quem deixou de ser apto não entra sem a coordenação ver.
    case "final":
      return rows.filter((r) => invited(r) && r.participant.response === "confirmado" && apto(r));
    case "concluiram_sem_participar":
      return rows.filter((r) => apto(r) && invited(r) && r.participant.response === "nao_comparece");
    case "certificados":
      return rows.filter(apto);
  }
}

// ------------------------------------------------------------------ nomes

const PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);

/** "MARIA DA silva" → "Maria da Silva". Só padroniza a caixa; nunca troca letras nem inventa sobrenome. */
export function standardizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (index > 0 && PARTICLES.has(lower)) return lower;
      return word
        .split("-")
        .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1).toLocaleLowerCase("pt-BR"))
        .join("-");
    })
    .join(" ");
}

/** Problemas que a coordenação deve resolver antes de mandar o nome para impressão. */
export function nameIssues(name: string): string[] {
  const issues: string[] = [];
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.split(" ").length < 2) issues.push("nome sem sobrenome");
  if (clean.length > 3 && clean === clean.toLocaleUpperCase("pt-BR")) issues.push("tudo em maiúsculas");
  if (clean.length > 3 && clean === clean.toLocaleLowerCase("pt-BR")) issues.push("tudo em minúsculas");
  if (/\d/.test(clean)) issues.push("contém números");
  if (/[^\p{L}\s'.-]/u.test(clean)) issues.push("contém símbolos estranhos");
  if (name !== name.trim() || /\s{2,}/.test(name)) issues.push("espaços sobrando");
  return issues;
}

/** O nome que irá ao certificado: o conferido pela coordenação ou, na falta dele, o do cadastro padronizado. */
export function certificateNameOf(row: BoardRow): { name: string; checked: boolean; issues: string[] } {
  const checked = !!row.participant.certificateNameCheckedAt && !!row.participant.certificateName;
  const name = checked ? row.participant.certificateName! : standardizeName(row.name);
  return { name, checked, issues: checked ? [] : nameIssues(row.name) };
}

// --------------------------------------------------------------- linhas

export interface ExportTable {
  headers: string[];
  rows: string[][];
}

const dayLabel = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
const pct = (value: number | null) => (value === null ? "" : `${String(value).replace(".", ",")}%`);
const grade = (value: number | null) => (value === null ? "" : value.toFixed(1).replace(".", ","));

const RESPONSE_LABELS = { sem_resposta: "Sem resposta", confirmado: "Confirmou presença", nao_comparece: "Não comparecerá" } as const;
const ATTENDANCE_LABELS = { nao_registrado: "Não registrado", compareceu: "Compareceu", nao_compareceu: "Não compareceu" } as const;

export function buildListTable(rows: BoardRow[], code: ListCode, editionName: string): ExportTable {
  if (code === "certificados") return buildCertificateTable(rows, editionName);
  const moduleHeaders = MODULES.map((m) => `Situação de ${MODULE_LABELS[m]}`);
  return {
    headers: [
      "Nome completo",
      "Telefone",
      "E-mail",
      "Turma de Voz",
      "Temporada",
      ...moduleHeaders,
      "Frequência em Voz",
      "Nota em Voz",
      "Situação acadêmica",
      "Pendências",
      "Convite",
      "Resposta",
      "Origem da resposta",
      "Comparecimento na cerimônia",
    ],
    rows: rows.map((r) => [
      r.name,
      r.phone ? formatBrazilianPhone(r.phone) : "",
      r.email ?? "",
      r.className ?? "",
      r.seasonName ?? "",
      ...MODULES.map((m) => MODULE_STATUS_LABELS[r.evaluation.modules.find((x) => x.slug === m)?.status ?? "em_conferencia"]),
      pct(r.vozAttendancePct),
      grade(r.vozGrade),
      OVERALL_LABELS[r.evaluation.overall],
      String(r.evaluation.openCount),
      r.participant.invitedAt ? "Convidado" : "Não convidado",
      r.participant.invitedAt ? RESPONSE_LABELS[r.participant.response] : "",
      r.participant.responseSource === "coordenacao" ? `Registrado pela coordenação (${r.participant.responseChannel ?? "—"})` : r.participant.responseSource === "aluno" ? "Pelo aluno" : "",
      ATTENDANCE_LABELS[r.participant.ceremonyAttendance],
    ]),
  };
}

/** Dados para o certificado: só alunos aptos, com o nome padronizado e o estado da conferência. */
function buildCertificateTable(rows: BoardRow[], editionName: string): ExportTable {
  const eligible = rows.filter((r) => r.evaluation.overall === "apto");
  return {
    headers: [
      "Nome para o certificado",
      "Nome conferido pela coordenação",
      "Alertas no nome cadastrado",
      "Identificador do aluno",
      "Módulos concluídos",
      "Datas de conclusão",
      "Edição da formatura",
      "Situação acadêmica",
      "Situação de presença na cerimônia",
    ],
    rows: eligible.map((r) => {
      const cert = certificateNameOf(r);
      const done = r.evaluation.modules.filter((m) => m.status === "concluido");
      return [
        cert.name,
        cert.checked ? "Sim" : "Não",
        cert.issues.join("; "),
        r.studentId,
        done.map((m) => m.label).join(", "),
        done.map((m) => `${m.label}: ${m.completedOn ? dayLabel(m.completedOn) : (m.seasonName ?? "data não registrada")}`).join("; "),
        editionName,
        OVERALL_LABELS[r.evaluation.overall],
        r.participant.invitedAt ? `${RESPONSE_LABELS[r.participant.response]} · ${ATTENDANCE_LABELS[r.participant.ceremonyAttendance]}` : "Não convidado",
      ];
    }),
  };
}
