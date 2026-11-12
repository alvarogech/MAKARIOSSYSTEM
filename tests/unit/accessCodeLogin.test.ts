// Login da conta por código de acesso pelo e-mail técnico (sem depender do provedor Phone do Supabase).
import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeUser { id: string; phone: string | null; email: string | null }

let users: FakeUser[] = [];
let profiles: { id: string; access_code: string | null }[] = [];
let updateFails = false;
/** Simula a chave de servidor ausente: criar o cliente administrativo lança erro. */
let adminBroken = false;
/** Senha certa de cada login (e-mail); o resto é recusado. */
let passwords: Record<string, string> = {};
const signInCalls: { email?: string; phone?: string }[] = [];
const adminCalls: string[] = [];

const admin = {
  from(table: string) {
    adminCalls.push(`from:${table}`);
    let code = "";
    const chain = {
      select: () => chain,
      eq: (_column: string, value: string) => ((code = value), chain),
      maybeSingle: async () => ({ data: profiles.find((p) => p.access_code === code) ?? null, error: null }),
    };
    return chain;
  },
  auth: {
    admin: {
      getUserById: async (id: string) => {
        adminCalls.push("getUserById");
        const user = users.find((u) => u.id === id);
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "não achou" } };
      },
      updateUserById: async (id: string, attrs: { email?: string; email_confirm?: boolean }) => {
        adminCalls.push("updateUserById");
        if (updateFails) return { data: null, error: { code: "x", status: 500, message: "falhou" } };
        const user = users.find((u) => u.id === id)!;
        user.email = attrs.email ?? user.email;
        return { data: { user }, error: null };
      },
    },
  },
};

const server = {
  auth: {
    signInWithPassword: async (credential: { email?: string; phone?: string; password: string }) => {
      signInCalls.push({ email: credential.email, phone: credential.phone });
      const known = users.some((u) => u.email && u.email === credential.email);
      const ok = known && passwords[credential.email ?? ""] === credential.password;
      return { error: ok ? null : { code: "invalid_credentials", status: 400, message: "Invalid login credentials" } };
    },
  },
};

vi.mock("@/integrations/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    if (adminBroken) throw new Error("chave de servidor ausente");
    return admin;
  },
}));
vi.mock("@/integrations/supabase/server", () => ({ createSupabaseServerClient: async () => server }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import { accessCodeLoginEmail, isAccessCode } from "@/modules/auth/accessCode";
import { attachAccessCodeLoginEmail, prepareAccessCodeLogin } from "@/modules/auth/accessCodeLogin";
import { signIn } from "@/modules/auth/actions/signIn";

const CODE = "999123456";
const LOGIN = "999123456@makarios.invalid";

function form(identifier: string, password: string) {
  const data = new FormData();
  data.set("identifier", identifier);
  data.set("password", password);
  return data;
}

beforeEach(() => {
  users = [];
  profiles = [];
  passwords = {};
  updateFails = false;
  adminBroken = false;
  signInCalls.length = 0;
  adminCalls.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("e-mail técnico do código de acesso", () => {
  it("monta o e-mail a partir do código, com ou sem traço", () => {
    expect(accessCodeLoginEmail("999-123-456")).toBe(LOGIN);
    expect(accessCodeLoginEmail(CODE)).toBe(LOGIN);
  });
  it("reconhece só código de 9 números começando com 999", () => {
    expect(isAccessCode(CODE)).toBe(true);
    expect(isAccessCode("52998224725")).toBe(false);
    expect(isAccessCode("998123456")).toBe(false);
    expect(isAccessCode("")).toBe(false);
  });
});

describe("attachAccessCodeLoginEmail", () => {
  it("coloca o e-mail técnico na conta que só tinha o código", async () => {
    users = [{ id: "U1", phone: CODE, email: null }];
    expect(await attachAccessCodeLoginEmail(admin as never, "U1", CODE)).toBe(true);
    expect(users[0]?.email).toBe(LOGIN);
  });
  it("não mexe em conta que já tem e-mail de login", async () => {
    users = [{ id: "U1", phone: CODE, email: "ana@teste.local" }];
    expect(await attachAccessCodeLoginEmail(admin as never, "U1", CODE)).toBe(false);
    expect(users[0]?.email).toBe("ana@teste.local");
    expect(adminCalls).not.toContain("updateUserById");
  });
  it("não mexe em conta cujo telefone não é o código informado", async () => {
    users = [{ id: "U1", phone: "999000000", email: null }];
    expect(await attachAccessCodeLoginEmail(admin as never, "U1", CODE)).toBe(false);
    expect(users[0]?.email).toBeNull();
  });
  it("devolve falso quando o Supabase recusa a mudança", async () => {
    users = [{ id: "U1", phone: CODE, email: null }];
    updateFails = true;
    expect(await attachAccessCodeLoginEmail(admin as never, "U1", CODE)).toBe(false);
  });
});

describe("prepareAccessCodeLogin", () => {
  it("não consulta nada quando o que foi digitado não é um código (um CPF, por exemplo)", async () => {
    expect(await prepareAccessCodeLogin(admin as never, "52998224725")).toBe(false);
    expect(adminCalls).toHaveLength(0);
  });
  it("devolve falso quando nenhum perfil tem aquele código", async () => {
    expect(await prepareAccessCodeLogin(admin as never, CODE)).toBe(false);
    expect(adminCalls).not.toContain("updateUserById");
  });
});

describe("signIn", () => {
  it("conta por código já preparada entra pelo e-mail técnico, sem usar telefone nem consulta administrativa", async () => {
    users = [{ id: "U1", phone: CODE, email: LOGIN }];
    passwords[LOGIN] = "Senha123";
    await expect(signIn({}, form("999-123-456", "Senha123"))).rejects.toThrow("REDIRECT:/dashboard");
    expect(signInCalls).toEqual([{ email: LOGIN, phone: undefined }]);
    expect(adminCalls).toHaveLength(0);
  });

  it("conta por código antiga (só telefone) é preparada e entra na segunda tentativa", async () => {
    users = [{ id: "U1", phone: CODE, email: null }];
    profiles = [{ id: "U1", access_code: CODE }];
    passwords[LOGIN] = "Senha123";
    await expect(signIn({}, form(CODE, "Senha123"))).rejects.toThrow("REDIRECT:/dashboard");
    expect(signInCalls).toHaveLength(2);
    expect(users[0]?.email).toBe(LOGIN);
  });

  it("senha errada em conta por código já preparada: uma tentativa só e a frase genérica", async () => {
    users = [{ id: "U1", phone: CODE, email: LOGIN }];
    profiles = [{ id: "U1", access_code: CODE }];
    passwords[LOGIN] = "Senha123";
    const result = await signIn({}, form(CODE, "errada"));
    expect(result.error).toBe("E-mail/código de acesso ou senha inválidos.");
    expect(signInCalls).toHaveLength(1);
    expect(adminCalls).not.toContain("updateUserById");
  });

  it("conta antiga com senha errada: é preparada, tenta de novo, e a tela mostra só a frase genérica", async () => {
    users = [{ id: "U1", phone: CODE, email: null }];
    profiles = [{ id: "U1", access_code: CODE }];
    passwords[LOGIN] = "Senha123";
    const result = await signIn({}, form(CODE, "errada"));
    expect(result.error).toBe("E-mail/código de acesso ou senha inválidos.");
    // O preparo não depende da senha e não dá acesso: só deixa a conta pronta para o dono entrar.
    expect(users[0]?.email).toBe(LOGIN);
    expect(signInCalls).toHaveLength(2);
    // Na vez seguinte, com a senha certa, entra de primeira.
    signInCalls.length = 0;
    await expect(signIn({}, form(CODE, "Senha123"))).rejects.toThrow("REDIRECT:/dashboard");
    expect(signInCalls).toHaveLength(1);
  });

  it("falha do cliente administrativo não derruba o login: frase genérica e nada gravado", async () => {
    users = [{ id: "U1", phone: CODE, email: null }];
    profiles = [{ id: "U1", access_code: CODE }];
    adminBroken = true;
    const result = await signIn({}, form(CODE, "Senha123"));
    expect(result.error).toBe("E-mail/código de acesso ou senha inválidos.");
    expect(users[0]?.email).toBeNull();
    expect(signInCalls).toHaveLength(1);
  });

  it("código que não existe não cria nada e devolve a frase genérica", async () => {
    const result = await signIn({}, form("999000111", "qualquer"));
    expect(result.error).toBe("E-mail/código de acesso ou senha inválidos.");
    expect(adminCalls).not.toContain("updateUserById");
  });

  it("login por e-mail continua igual e nunca toca no cliente administrativo", async () => {
    users = [{ id: "U2", phone: null, email: "ana@teste.local" }];
    passwords["ana@teste.local"] = "Senha123";
    await expect(signIn({}, form(" Ana@Teste.local ", "Senha123"))).rejects.toThrow("REDIRECT:/dashboard");
    expect(signInCalls).toEqual([{ email: "ana@teste.local", phone: undefined }]);
    expect(adminCalls).toHaveLength(0);

    const wrong = await signIn({}, form("ana@teste.local", "errada"));
    expect(wrong.error).toBe("E-mail/código de acesso ou senha inválidos.");
    expect(adminCalls).toHaveLength(0);
  });
});
