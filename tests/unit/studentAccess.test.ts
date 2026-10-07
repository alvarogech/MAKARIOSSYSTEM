import { describe, expect, it } from "vitest";
import { summarize, type AccessPerson } from "@/modules/access/studentAccess";

const person = (stage: AccessPerson["stage"]): AccessPerson => ({
  personKey: stage,
  name: stage,
  email: `${stage}@x.com`,
  phone: "62999999999",
  volumes: ["Essência"],
  stage,
  lastSignInAt: null,
  materialsOpened: 0,
  lastMaterialAt: null,
});

describe("summarize", () => {
  it("conta cada etapa e os acumulados (conta criada ⊇ entrou ⊇ abriu material)", () => {
    const summary = summarize([
      person("sem_conta"),
      person("sem_conta"),
      person("conta_sem_login"),
      person("entrou_sem_material"),
      person("abriu_material"),
    ]);
    expect(summary.approved).toBe(5);
    expect(summary.withAccount).toBe(3);
    expect(summary.loggedIn).toBe(2);
    expect(summary.openedMaterial).toBe(1);
    expect(summary.byStage.sem_conta).toBe(2);
  });

  it("sem ninguém, tudo zero", () => {
    const summary = summarize([]);
    expect(summary.approved).toBe(0);
    expect(summary.openedMaterial).toBe(0);
  });
});
