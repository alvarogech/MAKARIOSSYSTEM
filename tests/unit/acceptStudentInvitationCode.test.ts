// Primeiro acesso por convite: conta por código de acesso (e-mail dividido na família) e conta normal por e-mail.
import { beforeEach, describe, expect, it, vi } from "vitest";

const CODE = "999123456";
const LOGIN = "999123456@makarios.invalid";
const CONTACT = "familia@teste.local";
const PASSWORD = "Senha1234";

interface FakeUser { id: string; phone: string | null; email: string | null }
interface Invitation {
  id: string;
  class_ids: string[];
  enrollment_request_id: string | null;
  consumed_at: string | null;
  revoked_at: string | null;
  token_expires_at: string;
  use_access_code: boolean;
}

/** Ordem do que aconteceu, para provar que o e-mail técnico entra depois de a conta existir e antes do login. */
const events: string[] = [];
let users: FakeUser[] = [];
let invitation: Invitation;
let updateFails = false;
const createUserCalls: Record<string, unknown>[] = [];
const signInCalls: Record<string, unknown>[] = [];
const profileUpdates: Record<string, unknown>[] = [];

/** Banco de mentira: cada tabela devolve o mínimo que a ação precisa para seguir. */
function table(name: string) {
  let op: "select" | "update" | "insert" = "select";
  let values: Record<string, unknown> = {};
  const result = () => {
    if (op === "update" && name === "profiles") profileUpdates.push(values);
    if (op === "update" && name === "invitations") events.push("convite usado");
    return { data: null, error: null };
  };
  const chain = {
    select: () => chain,
    update: (v: Record<string, unknown>) => ((op = "update"), (values = v), chain),
    insert: (v: Record<string, unknown>) => ((op = "insert"), (values = v), chain),
    eq: () => chain,
    is: () => chain,
    maybeSingle: async () => {
      if (name === "invitations") return { data: invitation, error: null };
      if (name === "enrollment_requests") return { data: { reviewed_by: null, reviewed_at: null }, error: null };
      return { data: null, error: null };
    },
    single: async () => (name === "roles" ? { data: { id: "papel-aluno" }, error: null } : { data: null, error: null }),
    then: (resolve: (value: unknown) => void) => resolve(result()),
  };
  return chain;
}

const admin = {
  from: (name: string) => table(name),
  auth: {
    admin: {
      createUser: async (attrs: { phone?: string; email?: string }) => {
        events.push("conta criada");
        createUserCalls.push(attrs);
        const user = { id: "U-novo", phone: attrs.phone ?? null, email: attrs.email ?? null };
        users.push(user);
        return { data: { user }, error: null };
      },
      deleteUser: async () => ({ error: null }),
      getUserById: async (id: string) => {
        const user = users.find((u) => u.id === id);
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "não achou" } };
      },
      updateUserById: async (id: string, attrs: { email?: string }) => {
        events.push("e-mail técnico");
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
    signInWithPassword: async (credential: Record<string, unknown>) => {
      events.push("login");
      signInCalls.push(credential);
      const ok = users.some((u) => u.email !== null && u.email === credential.email) && credential.password === PASSWORD;
      return { error: ok ? null : { code: "invalid_credentials", status: 400, message: "Invalid login credentials" } };
    },
  },
};

const sendMail = vi.fn(async (_input: { to: string; subject: string; text: string; html: string }) => {});

vi.mock("@/integrations/supabase/admin", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/integrations/supabase/server", () => ({ createSupabaseServerClient: async () => server }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/modules/auth/rateLimit", () => ({ checkRateLimit: async () => true, getClientIp: async () => "1.1.1.1" }));
vi.mock("@/modules/notifications/mailer", () => ({ sendMail: (input: never) => sendMail(input) }));
vi.mock("@/modules/enrollment/existingAccount", () => ({
  ALREADY_HAS_ACCOUNT_MESSAGE: "Você já tem uma conta.",
  findExistingAccountForPerson: async () => null,
}));
// Só o sorteio do código é fixado; o resto (formato e e-mail técnico) é o código de verdade.
vi.mock("@/modules/auth/accessCode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/auth/accessCode")>()),
  generateUniqueAccessCode: async () => CODE,
}));

import { acceptStudentInvitation } from "@/modules/enrollment/actions/acceptStudentInvitation";

function form() {
  const data = new FormData();
  data.set("token", "token-do-convite");
  data.set("fullName", "Ana Teste");
  data.set("email", " Familia@Teste.local ");
  data.set("password", PASSWORD);
  data.set("confirmPassword", PASSWORD);
  return data;
}

function newInvitation(useAccessCode: boolean): Invitation {
  return {
    id: "convite-1",
    class_ids: [],
    enrollment_request_id: "inscricao-1",
    consumed_at: null,
    revoked_at: null,
    token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    use_access_code: useAccessCode,
  };
}

beforeEach(() => {
  events.length = 0;
  users = [];
  updateFails = false;
  createUserCalls.length = 0;
  signInCalls.length = 0;
  profileUpdates.length = 0;
  sendMail.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("primeiro acesso com convite por código de acesso", () => {
  it("cria a conta pelo código, grava o código no perfil, põe o e-mail técnico depois e entra por ele", async () => {
    invitation = newInvitation(true);

    const result = await acceptStudentInvitation({}, form());

    expect(result).toEqual({ result: { mode: "access_code", accessCode: "999-123-456" } });

    // A conta nasce pelo telefone (o código), sem e-mail de login, e guarda o e-mail de contato à parte.
    expect(createUserCalls).toHaveLength(1);
    expect(createUserCalls[0]).toMatchObject({ phone: CODE, phone_confirm: true, password: PASSWORD });
    expect(createUserCalls[0]).not.toHaveProperty("email");
    expect(createUserCalls[0]?.user_metadata).toMatchObject({ contact_email: CONTACT });

    // O perfil fica com o código e com o e-mail de contato (não o técnico).
    expect(profileUpdates).toContainEqual(expect.objectContaining({ access_code: CODE, email: CONTACT }));

    // A conta passa a ter o e-mail técnico de login.
    expect(users[0]?.email).toBe(LOGIN);

    // O login logo em seguida usa o e-mail técnico, nunca o telefone.
    expect(signInCalls).toHaveLength(1);
    expect(signInCalls[0]).toEqual({ email: LOGIN, password: PASSWORD });
    expect(signInCalls[0]).not.toHaveProperty("phone");

    // Ordem: conta criada, depois o e-mail técnico, depois o login.
    expect(events.indexOf("conta criada")).toBeLessThan(events.indexOf("e-mail técnico"));
    expect(events.indexOf("e-mail técnico")).toBeLessThan(events.indexOf("login"));

    // O código vai para o e-mail de contato da família.
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({ to: CONTACT });
    expect(sendMail.mock.calls[0]?.[0].text).toContain("999-123-456");
  });

  it("se colocar o e-mail técnico falhar, a ação não quebra e a conta continua criada", async () => {
    invitation = newInvitation(true);
    updateFails = true;

    const result = await acceptStudentInvitation({}, form());

    expect(result).toEqual({ result: { mode: "access_code", accessCode: "999-123-456" } });
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ phone: CODE, email: null });
    expect(profileUpdates).toContainEqual(expect.objectContaining({ access_code: CODE }));
    expect(events).toContain("convite usado");

    // Tenta entrar pelo e-mail técnico; o login falha (a conta ainda não tem esse e-mail), e a ação segue.
    expect(signInCalls).toEqual([{ email: LOGIN, password: PASSWORD }]);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});

describe("primeiro acesso com convite normal (e-mail só do aluno)", () => {
  it("cria a conta pelo e-mail de contato e entra por ele, sem código e sem e-mail técnico", async () => {
    invitation = newInvitation(false);

    const result = await acceptStudentInvitation({}, form());

    expect(result).toEqual({ result: { mode: "email" } });

    expect(createUserCalls).toHaveLength(1);
    expect(createUserCalls[0]).toMatchObject({ email: CONTACT, email_confirm: true, password: PASSWORD });
    expect(createUserCalls[0]).not.toHaveProperty("phone");

    expect(profileUpdates).toContainEqual(expect.objectContaining({ access_code: null, email: CONTACT }));
    expect(events).not.toContain("e-mail técnico");
    expect(users[0]?.email).toBe(CONTACT);

    expect(signInCalls).toEqual([{ email: CONTACT, password: PASSWORD }]);
    expect(JSON.stringify(signInCalls)).not.toContain("makarios.invalid");
  });
});
