import { describe, expect, it } from "vitest";
import { computeVideoProgress, mergeProgressPercent } from "@/services/videoProgress";

describe("computeVideoProgress", () => {
  it("calcula o percentual e marca como concluído ao atingir o mínimo padrão (80%)", () => {
    const result = computeVideoProgress({
      positionSeconds: 800,
      durationSeconds: 1000,
      minPercent: 80,
    });
    expect(result.percent).toBe(80);
    expect(result.isCompleted).toBe(true);
  });

  it("não marca como concluído abaixo do percentual mínimo", () => {
    const result = computeVideoProgress({
      positionSeconds: 799,
      durationSeconds: 1000,
      minPercent: 80,
    });
    expect(result.isCompleted).toBe(false);
  });

  it("respeita um percentual mínimo configurado diferente do padrão", () => {
    const result = computeVideoProgress({
      positionSeconds: 600,
      durationSeconds: 1000,
      minPercent: 50,
    });
    expect(result.isCompleted).toBe(true);
  });

  it("nunca ultrapassa 100%, mesmo com posição além da duração", () => {
    const result = computeVideoProgress({
      positionSeconds: 1200,
      durationSeconds: 1000,
      minPercent: 80,
    });
    expect(result.percent).toBe(100);
  });

  it("duração zero/negativa resulta em 0% e não concluído (evita divisão por zero)", () => {
    const result = computeVideoProgress({
      positionSeconds: 10,
      durationSeconds: 0,
      minPercent: 80,
    });
    expect(result).toEqual({ percent: 0, isCompleted: false });
  });
});

describe("mergeProgressPercent", () => {
  it("mantém o maior percentual já alcançado (aluno voltou o vídeo)", () => {
    expect(mergeProgressPercent(80, 40)).toBe(80);
  });

  it("avança quando o novo percentual é maior", () => {
    expect(mergeProgressPercent(40, 80)).toBe(80);
  });
});
