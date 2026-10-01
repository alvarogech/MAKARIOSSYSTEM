import { describe, expect, it } from "vitest";
import { generateInviteToken, hashInviteToken } from "@/modules/auth/inviteTokens";

describe("generateInviteToken", () => {
  it("gera tokens diferentes a cada chamada (alta entropia, não reaproveitável)", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateInviteToken()));
    expect(tokens.size).toBe(50);
  });

  it("gera um token longo o suficiente para não ser adivinhável", () => {
    expect(generateInviteToken().length).toBeGreaterThanOrEqual(32);
  });
});

describe("hashInviteToken", () => {
  it("é determinístico — o mesmo token sempre produz o mesmo hash", () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
  });

  it("tokens diferentes produzem hashes diferentes", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(hashInviteToken(a)).not.toBe(hashInviteToken(b));
  });

  it("nunca devolve o próprio token (o hash não é reversível por inspeção)", () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).not.toBe(token);
  });

  it("produz um hash hexadecimal sha256 (64 caracteres)", () => {
    expect(hashInviteToken("qualquer-coisa")).toMatch(/^[0-9a-f]{64}$/);
  });
});
