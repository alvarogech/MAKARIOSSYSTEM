import { isValidBrazilianPhone } from "@/services/phone";
import type { DataQualityFlag } from "./types";

/**
 * Domínios de e-mail comuns no Brasil — usados só para sugerir uma possível
 * correção quando o domínio informado é muito parecido com um destes (nunca
 * para validar/rejeitar um e-mail; qualquer domínio real é aceito).
 */
const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "live.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "globo.com",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUGGESTION_DISTANCE = 2;

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) distances[i]![0] = i;
  for (let j = 0; j < cols; j++) distances[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      distances[i]![j] =
        a[i - 1] === b[j - 1]
          ? distances[i - 1]![j - 1]!
          : 1 + Math.min(distances[i - 1]![j]!, distances[i]![j - 1]!, distances[i - 1]![j - 1]!);
    }
  }

  return distances[a.length]![b.length]!;
}

/** Sugere um domínio comum só quando o informado é bem parecido, mas diferente — evita falsos positivos. */
function suggestEmailDomain(domain: string): string | null {
  if (COMMON_EMAIL_DOMAINS.includes(domain)) return null;

  let closest: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const distance = levenshteinDistance(domain, candidate);
    if (distance <= MAX_SUGGESTION_DISTANCE && (!closest || distance < closest.distance)) {
      closest = { domain: candidate, distance };
    }
  }
  return closest?.domain ?? null;
}

/**
 * Sinalização visual e não destrutiva de possíveis inconsistências — nunca
 * corrige nada automaticamente, só aponta o que a coordenação pode querer
 * confirmar com a pessoa.
 */
export function checkEnrollmentDataQuality(row: { email: string; phone: string }): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];

  if (!EMAIL_PATTERN.test(row.email)) {
    flags.push({ field: "email", message: "Este e-mail não parece ter um formato válido." });
  } else {
    const [localPart, domain] = row.email.toLowerCase().split("@");
    const suggestion = domain ? suggestEmailDomain(domain) : null;
    if (suggestion) {
      flags.push({
        field: "email",
        message: "Este domínio de e-mail pode conter um erro de digitação.",
        suggestion: `Você quis dizer ${localPart}@${suggestion}?`,
      });
    }
  }

  if (!isValidBrazilianPhone(row.phone)) {
    flags.push({ field: "phone", message: "Este telefone parece incompleto." });
  }

  return flags;
}
