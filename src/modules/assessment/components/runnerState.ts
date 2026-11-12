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
  "Não conseguimos salvar esta resposta. O que você já confirmou está salvo e o tempo continua correndo. Toque em Recarregar para continuar de onde parou.";

export const SEND_NETWORK_NOTICE =
  "Não foi possível enviar agora. Suas respostas confirmadas continuam salvas. Verifique a internet e tente de novo.";

export interface ConfirmFailure {
  message: string;
  /** Falha de rede ou de ação do servidor que sumiu: pede para recarregar. */
  network: boolean;
}
