import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/assessment/actions/requestLateRelease", () => ({ requestLateRelease: async () => ({}) }));

import { RequestLateReleaseForm } from "@/modules/assessment/components/RequestLateReleaseForm";

afterEach(cleanup);

describe("RequestLateReleaseForm", () => {
  it("mostra a pergunta, o aviso das 24 horas e o botão, sem pedir nome, CPF nem e-mail", () => {
    render(<RequestLateReleaseForm assessmentId="a1" questionsCount={20} durationMinutes={60} />);
    expect(screen.getByLabelText("Por que você não conseguiu fazer?")).toBeTruthy();
    expect(
      screen.getByText("Depois de enviar, você tem 24 horas para fazer. São 20 questões e 60 minutos a partir do início. Envie só quando puder fazer."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar e liberar minha prova" })).toBeTruthy();
    // A dica usa a mesma palavra do erro do servidor ("caracteres") e está ligada ao campo.
    expect(screen.getByText("De 10 a 500 caracteres.")).toBeTruthy();
    const field = screen.getByLabelText("Por que você não conseguiu fazer?");
    expect(field.getAttribute("aria-describedby")).toBe("late-reason-hint");
    expect(document.getElementById("late-reason-hint")?.textContent).toBe("De 10 a 500 caracteres.");
    expect(screen.queryByLabelText(/e-mail|cpf|nome/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/[—–]/);
  });
});
