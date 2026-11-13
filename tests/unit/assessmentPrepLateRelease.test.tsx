import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AssessmentPrep } from "@/modules/assessment/components/AssessmentPrep";

afterEach(cleanup);

const props = {
  title: "Avaliação final",
  type: "final",
  questionsCount: 20,
  durationMinutes: 60,
  passingGrade: 6,
  closesAt: "2026-11-12T23:59:00Z",
  attemptsAllowed: 1,
  attemptsUsed: 0,
};

describe("AssessmentPrep com liberação fora do prazo", () => {
  it("mostra até quando a prova está liberada", () => {
    render(<AssessmentPrep {...props} lateReleaseUntil="2026-11-14T13:30:00Z"><span>botão</span></AssessmentPrep>);
    expect(screen.getByText("Prova liberada para você até 14/11 às 10:30.")).toBeTruthy();
  });

  it("sem liberação não mostra a frase", () => {
    render(<AssessmentPrep {...props}><span>botão</span></AssessmentPrep>);
    expect(screen.queryByText(/Prova liberada para você/)).toBeNull();
  });
});
