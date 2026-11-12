// Estados de uma questão na prova e os textos que o aluno e o leitor de tela recebem.
export type QuestionState = "atual" | "confirmada" | "selecionada" | "sem_resposta";

export const STATE_LABEL: Record<QuestionState, string> = {
  atual: "questão atual",
  confirmada: "resposta confirmada",
  selecionada: "marcada, falta confirmar",
  sem_resposta: "sem resposta",
};

export const PENDING_NOTICE = "Confirme a sua resposta antes de mudar de questão.";

export const networkNotice = (questionNumber: number) =>
  `Não conseguimos salvar esta resposta. O que você já confirmou está salvo e o tempo continua correndo. Toque em Recarregar e marque de novo a resposta da questão ${questionNumber}.`;

export const SEND_NETWORK_NOTICE =
  "Não foi possível enviar agora. Suas respostas confirmadas continuam salvas. Verifique a internet e tente de novo.";

export interface ConfirmFailure {
  message: string;
}

export const LOAD_NETWORK_NOTICE =
  "Não conseguimos carregar a prova. As respostas que você já confirmou estão salvas e o tempo continua correndo. Toque em Recarregar.";

/**
 * Quanto esperar pela última confirmação quando o tempo acaba, antes de pedir o envio. Não é um teto
 * para o envio: o Next manda as ações do servidor em fila, então se a confirmação ficar pendurada o
 * envio espera atrás dela. A varredura do banco encerra a tentativa em até 1 minuto de qualquer jeito.
 */
export const LAST_CONFIRM_WAIT_MS = 4000;
