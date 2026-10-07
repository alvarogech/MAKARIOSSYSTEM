import { describe, expect, it } from "vitest";
import { formatRoom } from "@/lib/room";

describe("formatRoom", () => {
  it("nunca repete o prefixo", () => {
    expect(formatRoom("Sala 02")).toBe("Sala 02");
    expect(formatRoom("sala 02")).toBe("Sala 02");
    expect(formatRoom("Sala Sala 02")).toBe("Sala 02");
  });
  it("acrescenta o prefixo quando só vem o número ou o nome", () => {
    expect(formatRoom("02")).toBe("Sala 02");
    expect(formatRoom("Auditório")).toBe("Sala Auditório");
  });
  it("vazio vira null", () => {
    expect(formatRoom(null)).toBeNull();
    expect(formatRoom("   ")).toBeNull();
  });
});
