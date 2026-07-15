import { describe, expect, it } from "vitest";
import { checkPrerequisites } from "@/services/prerequisites";

// Grafo padrão: Essência → Caminho → Voz (doc 02 §2).
const GRAPH = {
  essencia: [],
  caminho: ["essencia"],
  voz: ["caminho"],
};

describe("checkPrerequisites", () => {
  it("libera um volume sem pré-requisito (Essência)", () => {
    const result = checkPrerequisites("essencia", GRAPH, new Set());
    expect(result.satisfied).toBe(true);
    expect(result.missingVolumeIds).toEqual([]);
  });

  it("bloqueia Caminho quando Essência não foi concluído", () => {
    const result = checkPrerequisites("caminho", GRAPH, new Set());
    expect(result.satisfied).toBe(false);
    expect(result.missingVolumeIds).toEqual(["essencia"]);
  });

  it("libera Caminho quando Essência já foi aprovado", () => {
    const result = checkPrerequisites(
      "caminho",
      GRAPH,
      new Set(["essencia"]),
    );
    expect(result.satisfied).toBe(true);
  });

  it("bloqueia Voz mesmo com Essência aprovado, se Caminho não foi", () => {
    const result = checkPrerequisites("voz", GRAPH, new Set(["essencia"]));
    expect(result.satisfied).toBe(false);
    expect(result.missingVolumeIds).toEqual(["caminho"]);
  });

  it("uma exceção da coordenação libera especificamente o pré-requisito perdoado", () => {
    const result = checkPrerequisites(
      "caminho",
      GRAPH,
      new Set(),
      new Set(["essencia"]),
    );
    expect(result.satisfied).toBe(true);
    expect(result.missingVolumeIds).toEqual([]);
  });

  it("exceção para um volume não relacionado não libera o pré-requisito de verdade", () => {
    const result = checkPrerequisites(
      "voz",
      GRAPH,
      new Set(),
      new Set(["essencia"]), // exceção errada — Voz precisa de Caminho, não Essência
    );
    expect(result.satisfied).toBe(false);
    expect(result.missingVolumeIds).toEqual(["caminho"]);
  });

  it("volume desconhecido no grafo é tratado como sem pré-requisito", () => {
    const result = checkPrerequisites("volume-inexistente", GRAPH, new Set());
    expect(result.satisfied).toBe(true);
  });
});
