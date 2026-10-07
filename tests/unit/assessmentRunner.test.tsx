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
    expect(await screen.findByText(/não pode mais ser alterada/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Alt A/).matches(":disabled")).toBe(true);
  });

  it("o resumo avisa de resposta marcada e não confirmada e de questão sem resposta, e permite enviar assim", async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText("Primeira pergunta?");
    await user.click(screen.getByLabelText("Alt A")); // marcada, sem confirmar
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));

    expect(await screen.findByText(/marcada, mas não confirmada|marcadas, mas não confirmadas/i)).toBeTruthy();
    expect(screen.getByText(/sem resposta\. Você pode enviar assim/i)).toBeTruthy();
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
});
