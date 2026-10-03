import { describe, expect, it } from "vitest";
import {
  availableActions,
  countByStatus,
  isReviewAction,
  REVIEW_ACTION_RULES,
} from "@/modules/content/reviewWorkflow";

describe("availableActions", () => {
  it("rascunho só pode ir para revisão — e qualquer editor pode enviar", () => {
    expect(availableActions("draft", { canApprove: false, kind: "question" })).toEqual(["submit_review"]);
  });

  it("em revisão: editor só devolve; coordenação também aprova", () => {
    expect(availableActions("in_review", { canApprove: false, kind: "question" })).toEqual(["return_draft"]);
    expect(availableActions("in_review", { canApprove: true, kind: "question" })).toEqual(["return_draft", "approve"]);
  });

  it("aprovada: só quem aprova pode reabrir; questão não é publicada direto", () => {
    expect(availableActions("approved", { canApprove: false, kind: "question" })).toEqual([]);
    expect(availableActions("approved", { canApprove: true, kind: "question" })).toEqual(["reopen"]);
  });

  it("desafio aprovado pode ser publicado; publicado pode ser arquivado", () => {
    expect(availableActions("approved", { canApprove: true, kind: "challenge" })).toEqual(["reopen", "publish"]);
    expect(availableActions("published", { canApprove: true, kind: "challenge" })).toEqual(["archive"]);
    expect(availableActions("published", { canApprove: false, kind: "challenge" })).toEqual([]);
  });

  it("não há saída de arquivada nem pulo de rascunho para aprovada", () => {
    expect(availableActions("archived", { canApprove: true, kind: "challenge" })).toEqual([]);
    for (const rule of Object.values(REVIEW_ACTION_RULES)) {
      expect(rule.from.includes("draft") && rule.to === "approved").toBe(false);
    }
  });
});

describe("isReviewAction / countByStatus", () => {
  it("valida o nome da ação", () => {
    expect(isReviewAction("approve")).toBe(true);
    expect(isReviewAction("delete")).toBe(false);
    expect(isReviewAction(undefined)).toBe(false);
  });

  it("conta por estado ignorando valores desconhecidos", () => {
    const counts = countByStatus(["draft", "draft", "approved", "banana"]);
    expect(counts.draft).toBe(2);
    expect(counts.approved).toBe(1);
    expect(counts.published).toBe(0);
  });
});
