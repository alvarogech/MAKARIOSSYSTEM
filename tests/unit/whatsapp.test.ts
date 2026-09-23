import { describe, expect, it } from "vitest";
import { buildWhatsAppLink } from "@/services/whatsapp";

describe("buildWhatsAppLink", () => {
  it("adiciona o código do Brasil a um número sem DDI", () => {
    expect(buildWhatsAppLink("62999999999")).toBe("https://wa.me/5562999999999");
  });

  it("aceita telefone já formatado com máscara", () => {
    expect(buildWhatsAppLink("(62) 99999-9999")).toBe("https://wa.me/5562999999999");
  });

  it("não duplica o código do país se já estiver presente", () => {
    expect(buildWhatsAppLink("5562999999999")).toBe("https://wa.me/5562999999999");
  });

  it("remove um zero de tronco isolado antes do DDD", () => {
    expect(buildWhatsAppLink("062999999999")).toBe("https://wa.me/5562999999999");
  });

  it("funciona com telefone fixo (10 dígitos)", () => {
    expect(buildWhatsAppLink("6233334444")).toBe("https://wa.me/556233334444");
  });
});
