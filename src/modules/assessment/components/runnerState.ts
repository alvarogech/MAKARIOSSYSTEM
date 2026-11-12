// Estados de uma questão na prova e os textos que o aluno e o leitor de tela recebem.
export type QuestionState = "atual" | "confirmada" | "selecionada" | "sem_resposta";

export const STATE_LABEL: Record<QuestionState, string> = {
  atual: "questão atual",
  confirmada: "resposta confirmada",
  selecionada: "marcada, falta confirmar",
  sem_resposta: "sem resposta",
};

export const PENDING_NOTICE = "Confirme a sua resposta antes de mudar de questão.";

export const NETWORK_NOTICE =
  "Não conseguimos salvar esta resposta. O que você já confirmou está salvo e o tempo continua correndo. Toque em Recarregar e marque esta resposta de novo.";

export const SEND_NETWORK_NOTICE =
  "Não foi possível enviar agora. Suas respostas confirmadas continuam salvas. Verifique a internet e tente de novo.";

export interface ConfirmFailure {
  message: string;
  /** Todo erro que não é regra de prova (rede, ação do servidor que sumiu, sessão) oferece "Recarregar". */
  canReload: boolean;
}

export const LOAD_NETWORK_NOTICE =
  "Não conseguimos carregar a prova. As respostas que você já confirmou estão salvas e o tempo continua correndo. Toque em Recarregar.";

/** Quanto esperar, no máximo, pela última confirmação quando o tempo acaba. */
export const LAST_CONFIRM_WAIT_MS = 4000;
