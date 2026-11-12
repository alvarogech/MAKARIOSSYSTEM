import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const getQuestions = vi.fn();
const submitAnswer = vi.fn();
const finalize = vi.fn();
vi.mock("@/modules/assessment/actions/attemptActions", () => ({
  getAssessmentAttemptQuestions: (...a: unknown[]) => getQuestions(...a),
  submitAssessmentAnswer: (...a: unknown[]) => submitAnswer(...a),
  finalizeAssessmentAttempt: (...a: unknown[]) => finalize(...a),
}));

import { AssessmentRunner } from "@/modules/assessment/components/AssessmentRunner";

const questions = [
  { questionId: "q1", position: 1, prompt: "Primeira pergunta?", questionType: "x", selectionMode: "single", answered: false, options: [{ optionId: "a", label: "Alt A", orderIndex: 1 }, { optionId: "b", label: "Alt B", orderIndex: 2 }] },
  { questionId: "q2", position: 2, prompt: "Segunda pergunta?", questionType: "x", selectionMode: "multiple", answered: false, options: [{ optionId: "c", label: "Alt C", orderIndex: 1 }, { optionId: "d", label: "Alt D", orderIndex: 2 }] },
];

const future = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

function renderRunner(over: Partial<{ deadlineAt: string; serverNow: string }> = {}) {
  return render(<AssessmentRunner assessmentId="as1" attemptId="at1" deadlineAt={over.deadlineAt ?? future()} serverNow={over.serverNow ?? new Date().toISOString()} />);
}

beforeEach(() => {
  push.mockReset();
  getQuestions.mockReset().mockResolvedValue({ ok: true, questions });
  submitAnswer.mockReset().mockResolvedValue({ ok: true, alreadyAnswered: false });
  finalize.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("AssessmentRunner", () => {
  it("mostra uma questão por vez e nenhum acerto/erro durante a prova", async () => {
    renderRunner();
    expect(await screen.findByText("Primeira pergunta?")).toBeTruthy();
    expect(screen.queryByText("Segunda pergunta?")).toBeNull();
    expect(screen.queryByText(/acertou|errou|correta/i)).toBeNull();
  });

  it("marcar não salva: só 'Confirmar resposta' chama o servidor e trava a questão", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));
    expect(submitAnswer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ir para a questão 1 (questão atual)" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Confirmar resposta" }));
    await waitFor(() => expect(submitAnswer).toHaveBeenCalledWith("at1", "q1", ["a"]));
    // Confirmar já leva à próxima questão; ao voltar, a primeira está travada.
    expect(await screen.findByText("Segunda pergunta?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByText(/não pode mais ser alterada/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Alt A/).matches(":disabled")).toBe(true);
  });

  it("o resumo avisa de questão sem resposta e permite enviar assim", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" })); // nada marcado: pode sair

    expect(await screen.findByText(/2 questões estão sem resposta\. Você pode enviar assim/i)).toBeTruthy();
    expect(screen.getByText(/envio é definitivo/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    await waitFor(() => expect(finalize).toHaveBeenCalledWith("at1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/avaliacoes/as1/resultado"));
  });

  it("só confirma o envio depois da resposta do servidor: se falhar, mostra erro e permite tentar de novo", async () => {
    const user = userEvent.setup();
    finalize.mockResolvedValueOnce({ ok: false, error: "Falha de rede" }).mockResolvedValueOnce({ ok: true });
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));

    expect(await screen.findByText(/Falha de rede/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Tentar enviar de novo" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/avaliacoes/as1/resultado"));
  });

  it("tentativa já encerrada pelo servidor leva ao resultado em vez de travar", async () => {
    const user = userEvent.setup();
    finalize.mockResolvedValue({ ok: false, error: "Esta tentativa já foi encerrada." });
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/avaliacoes/as1/resultado"));
  });

  it("o relógio usa a hora do servidor: aparelho adiantado não encurta o tempo", async () => {
    // Servidor diz que agora são 10:00; o prazo é 10:30. O aparelho está 2h adiantado.
    const deviceNow = Date.now();
    const serverNow = new Date(deviceNow - 2 * 60 * 60 * 1000).toISOString();
    const deadlineAt = new Date(deviceNow - 2 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();
    renderRunner({ serverNow, deadlineAt });
    await screen.findByText("Primeira pergunta?");
    const timer = screen.getByRole("timer").textContent ?? "";
    expect(timer).toMatch(/Tempo restante (29|30):\d\d/);
    expect(finalize).not.toHaveBeenCalled();
  });

  it("o tempo acabou: envia sozinho o que foi confirmado", async () => {
    const serverNow = new Date().toISOString();
    renderRunner({ serverNow, deadlineAt: new Date(Date.now() + 1500).toISOString() });
    await screen.findByText("Primeira pergunta?");
    await waitFor(() => expect(finalize).toHaveBeenCalledWith("at1"), { timeout: 5000 });
    expect(await screen.findByText(/O tempo acabou/)).toBeTruthy();
  });

  it("com alternativa marcada e não confirmada, nada deixa sair da questão", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));

    expect(screen.getByText("Confirme a sua resposta antes de mudar de questão.")).toBeTruthy();
    for (const name of ["Anterior", "Próxima", "Revisar e enviar"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByRole("button", { name: /Ir para a questão 2/ }) as HTMLButtonElement).disabled).toBe(true);

    // Limpar a marcação libera a saída, sem responder.
    await user.click(screen.getByRole("button", { name: "Limpar marcação" }));
    expect((screen.getByRole("button", { name: "Próxima" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("Confirme a sua resposta antes de mudar de questão.")).toBeNull();
  });

  it("questão em branco pode ser pulada e respondida depois", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    expect(await screen.findByText("Segunda pergunta?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByText("Primeira pergunta?")).toBeTruthy();
    expect(submitAnswer).not.toHaveBeenCalled();
  });

  it("confirmar leva sozinho à próxima questão não confirmada e, na última, ao resumo", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));
    await user.click(screen.getByRole("button", { name: "Confirmar resposta" }));
    expect(await screen.findByText("Segunda pergunta?")).toBeTruthy();

    await user.click(screen.getByLabelText("Alt C"));
    await user.click(screen.getByRole("button", { name: "Confirmar resposta" }));
    expect(await screen.findByRole("heading", { name: "Revisar e enviar" })).toBeTruthy();
  });

  it("pula questões já confirmadas ao avançar", async () => {
    const user = userEvent.setup();
    getQuestions.mockResolvedValue({
      ok: true,
      questions: [
        { ...questions[0] },
        { ...questions[1], answered: true },
        { ...questions[0], questionId: "q3", position: 3, prompt: "Terceira pergunta?" },
      ],
    });
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));
    await user.click(screen.getByRole("button", { name: "Confirmar resposta" }));
    expect(await screen.findByText("Terceira pergunta?")).toBeTruthy();
  });

  it("erro de rede ao confirmar solta a trava, avisa abaixo do botão e deixa tentar de novo", async () => {
    const user = userEvent.setup();
    submitAnswer.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce({ ok: true });
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));
    await user.click(screen.getByRole("button", { name: "Confirmar resposta" }));

    expect(await screen.findByText(/Não conseguimos salvar esta resposta\. O que você já confirmou está salvo e o tempo continua correndo\. Toque em Recarregar e marque esta resposta de novo\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeTruthy();
    // A trava foi solta: o botão não está bloqueado, e a tela segue na mesma questão.
    expect((screen.getByRole("button", { name: "Confirmar resposta" }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Segunda pergunta?")).toBeTruthy();
    expect(submitAnswer).toHaveBeenCalledTimes(2);
  });

  it("erro devolvido pelo servidor ao confirmar aparece abaixo do botão, com Tentar de novo e Recarregar", async () => {
    const user = userEvent.setup();
    submitAnswer.mockResolvedValueOnce({ ok: false, error: "Sessão expirada." });
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));
    await user.click(screen.getByRole("button", { name: "Confirmar resposta" }));
    expect(await screen.findByText("Sessão expirada.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });

  it("erro de rede no envio solta a trava e mostra 'Tentar enviar de novo'", async () => {
    const user = userEvent.setup();
    finalize.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce({ ok: true });
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));

    expect(await screen.findByText(/Não foi possível enviar agora\. Suas respostas confirmadas continuam salvas/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Enviar avaliação" }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getByRole("button", { name: "Tentar enviar de novo" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/avaliacoes/as1/resultado"));
  });

  it("tempo zerando com marcação pendente: tenta confirmar a marcação e só depois envia", async () => {
    const user = userEvent.setup();
    renderRunner({ deadlineAt: new Date(Date.now() + 2500).toISOString() });
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));
    await waitFor(() => expect(finalize).toHaveBeenCalledWith("at1"), { timeout: 6000 });
    expect(submitAnswer).toHaveBeenCalledWith("at1", "q1", ["a"]);
    expect(submitAnswer.mock.invocationCallOrder[0]).toBeLessThan(finalize.mock.invocationCallOrder[0]!);
  });

  it("tempo zerando: se a última confirmação falhar na rede, envia mesmo assim", async () => {
    const user = userEvent.setup();
    submitAnswer.mockRejectedValue(new Error("Failed to fetch"));
    renderRunner({ deadlineAt: new Date(Date.now() + 2500).toISOString() });
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));
    await waitFor(() => expect(finalize).toHaveBeenCalledWith("at1"), { timeout: 6000 });
  });

  it("confirmar com 'tempo esgotou' envia e vai ao resultado, sem aviso de Recarregar", async () => {
    const user = userEvent.setup();
    submitAnswer.mockResolvedValueOnce({ ok: false, error: "O tempo desta avaliação esgotou." });
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));
    await user.click(screen.getByRole("button", { name: "Confirmar resposta" }));
    await waitFor(() => expect(finalize).toHaveBeenCalledWith("at1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/avaliacoes/as1/resultado"));
    expect(screen.queryByRole("button", { name: "Recarregar" })).toBeNull();
  });

  it("múltipla escolha desmarcando tudo solta a trava sozinha", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText("Segunda pergunta?");
    await user.click(screen.getByLabelText("Alt C"));
    expect((screen.getByRole("button", { name: "Anterior" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: /Alt C/ }));
    expect((screen.getByRole("button", { name: "Anterior" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("última questão confirmada com uma em branco para trás vai ao resumo, não volta", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText("Segunda pergunta?");
    await user.click(screen.getByLabelText("Alt C"));
    await user.click(screen.getByRole("button", { name: "Confirmar resposta" }));
    expect(await screen.findByRole("heading", { name: "Revisar e enviar" })).toBeTruthy();
    expect(screen.getByText(/1 questão está sem resposta/)).toBeTruthy();
  });

  it("'já respondida' (alreadyAnswered) conta como confirmada e avança", async () => {
    const user = userEvent.setup();
    submitAnswer.mockResolvedValueOnce({ ok: true, alreadyAnswered: true });
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));
    await user.click(screen.getByRole("button", { name: "Confirmar resposta" }));
    expect(await screen.findByText("Segunda pergunta?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ir para a questão 1 (resposta confirmada)" })).toBeTruthy();
  });

  it("duplo toque em Confirmar chama o servidor uma vez só", async () => {
    const user = userEvent.setup();
    let release: (v: unknown) => void = () => {};
    submitAnswer.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A"));
    const button = screen.getByRole("button", { name: "Confirmar resposta" });
    await user.dblClick(button);
    expect(submitAnswer).toHaveBeenCalledTimes(1);
    release({ ok: true });
    expect(await screen.findByText("Segunda pergunta?")).toBeTruthy();
  });

  it("falha ao carregar as questões mostra aviso com Recarregar, em vez de girar para sempre", async () => {
    getQuestions.mockRejectedValueOnce(new Error("Failed to fetch"));
    renderRunner();
    expect(await screen.findByText(/Não conseguimos carregar a prova/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeTruthy();
  });

  it("falha devolvida pelo servidor ao carregar também oferece Recarregar", async () => {
    getQuestions.mockResolvedValueOnce({ ok: false, error: "Tentativa não encontrada." });
    renderRunner();
    expect(await screen.findByText("Tentativa não encontrada.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeTruthy();
  });

  it("depois de recarregar, abre na primeira questão ainda não confirmada", async () => {
    getQuestions.mockResolvedValue({ ok: true, questions: [{ ...questions[0], answered: true }, { ...questions[1] }] });
    renderRunner();
    expect(await screen.findByText("Segunda pergunta?")).toBeTruthy();
  });

  it("marcação pendente avisa antes de fechar ou recarregar a página; sem marcação não avisa", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    const fire = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(fire()).toBe(false);
    await user.click(screen.getByLabelText("Alt A"));
    expect(fire()).toBe(true);
    await user.click(screen.getByRole("button", { name: "Limpar marcação" }));
    expect(fire()).toBe(false);
  });

  it("erro de envio aparece logo abaixo do botão Enviar, na tela de revisão", async () => {
    const user = userEvent.setup();
    finalize.mockRejectedValueOnce(new Error("Failed to fetch"));
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    const notice = await screen.findByText(/Não foi possível enviar agora/);
    expect(notice.closest("[role=alert]")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Tentar enviar de novo" })).toHaveLength(1);
  });

  it("o relógio dos últimos 5 minutos não usa travessão", async () => {
    renderRunner({ deadlineAt: new Date(Date.now() + 120 * 1000).toISOString() });
    await screen.findByText("Primeira pergunta?");
    const timer = screen.getByRole("timer").textContent ?? "";
    expect(timer).toContain("menos de 5 minutos");
    expect(timer).not.toMatch(/[—–]/);
  });

  it("as bolinhas têm toque de pelo menos 44 px", async () => {
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    expect(screen.getByRole("button", { name: /Ir para a questão 1/ }).className).toContain("size-11");
  });
});
