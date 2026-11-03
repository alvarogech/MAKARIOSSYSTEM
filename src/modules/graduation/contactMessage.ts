import { buildWhatsAppLink } from "@/services/whatsapp";
import { MODULE_LABELS, type Requirement } from "./types";

/**
 * Mensagem de contato para o aluno com pendência. O sistema só PREPARA o texto
 * e o link: quem envia é a coordenação, no próprio WhatsApp. Nunca diz que o
 * aluno está aprovado nem que a vaga na cerimônia está garantida, porque isso
 * só se sabe depois que os requisitos forem confirmados.
 */

export function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR");
}

function moduleName(requirement: Requirement): string {
  return requirement.module ? MODULE_LABELS[requirement.module] : "";
}

/** Como a pendência é citada numa lista, em linguagem de conversa. */
function phrase(requirement: Requirement): string {
  const moduleLabel = moduleName(requirement);
  switch (requirement.category) {
    case "avaliacao":
      return `a avaliação final do módulo ${moduleLabel}`;
    case "frequencia":
      return `a frequência do módulo ${moduleLabel}`;
    case "conclusao_essencia":
    case "conclusao_caminho":
    case "conclusao_voz":
    case "historico":
      return `o registro de conclusão do módulo ${moduleLabel}`;
    case "inconsistencia_cadastral":
      return "os seus dados de cadastro";
    default:
      return requirement.title.toLowerCase();
  }
}

const HELP_CLOSING = "Se tiver alguma dificuldade, nos avise para verificarmos juntos.";

function single(requirement: Requirement): string {
  const moduleLabel = moduleName(requirement);
  switch (requirement.category) {
    case "avaliacao":
      return [
        `Estamos organizando a formatura da Escola Makários e verificamos que ainda consta uma pendência na sua avaliação do módulo ${moduleLabel}.`,
        "Queremos ajudar você a concluir essa etapa. Você consegue acessar sua plataforma e conferir a avaliação?",
        HELP_CLOSING,
      ].join("\n");
    case "frequencia":
      return [
        "Estamos conferindo os requisitos para a formatura da Makários e identificamos uma pendência relacionada à sua frequência.",
        "Você poderia acessar a plataforma e verificar se todas as suas presenças estão corretas? Caso exista alguma divergência, entre em contato conosco para analisarmos.",
      ].join("\n");
    case "conclusao_essencia":
    case "conclusao_caminho":
    case "conclusao_voz":
    case "historico":
      return [
        `Estamos conferindo os registros para a formatura da Escola Makários e não encontramos no sistema a conclusão do módulo ${moduleLabel}.`,
        `Você consegue nos contar quando e em qual turma cursou o ${moduleLabel}? Se tiver algum comprovante, pode nos enviar. Assim conseguimos conferir e atualizar o seu histórico.`,
      ].join("\n");
    case "inconsistencia_cadastral":
      return [
        "Estamos conferindo os dados para a formatura da Escola Makários.",
        "Você pode confirmar seu nome completo, como deve constar no certificado, e se já se cadastrou antes com outro e-mail ou telefone?",
      ].join("\n");
    default:
      return [
        "Estamos organizando a formatura da Escola Makários e há um ponto a conferir no seu cadastro acadêmico.",
        "Você consegue conversar com a gente para verificarmos juntos?",
      ].join("\n");
  }
}

/**
 * Texto para o WhatsApp. `open` são as pendências abertas do aluno (as que
 * entram na conversa); sem pendências, devolve um contato neutro de conferência.
 */
export function buildContactMessage(fullName: string, open: Requirement[]): string {
  const greeting = `Olá${firstName(fullName) ? `, ${firstName(fullName)}` : ""}! Tudo bem?`;
  const items = open.filter((r) => r.blocking && r.state !== "cumprido" && r.state !== "em_andamento");

  if (items.length === 0) {
    return `${greeting}\nEstamos organizando a formatura da Escola Makários e queremos conferir seus dados com você. Pode falar com a gente quando puder?`;
  }
  if (items.length === 1) return `${greeting}\n${single(items[0]!)}`;

  const unique = [...new Set(items.map(phrase))];
  return [
    greeting,
    "Estamos organizando a formatura da Escola Makários e, ao conferir os requisitos, encontramos alguns pontos a verificar:",
    ...unique.map((p) => `• ${p}`),
    "Queremos ajudar você a resolver cada um. Pode nos responder por aqui para combinarmos os próximos passos?",
    HELP_CLOSING,
  ].join("\n");
}

/** Link do WhatsApp com a mensagem já escrita. Abrir o link NÃO significa que a mensagem foi enviada. */
export function buildContactLink(phone: string, message: string): string {
  return `${buildWhatsAppLink(phone)}?text=${encodeURIComponent(message)}`;
}
