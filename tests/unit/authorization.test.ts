import { describe, expect, it } from "vitest";
import { can, canAccessArea } from "@/authorization/policies";
import { resolveActiveRole } from "@/authorization/session";
import type { AuthContext } from "@/authorization/types";

function makeContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    fullName: "Usuário de Teste",
    profileStatus: "active",
    roles: [],
    activeRole: null,
    ...overrides,
  };
}

describe("camada de políticas tipada — src/authorization", () => {
  it("aluno não acessa rota/área de professor", () => {
    const student = makeContext({ roles: ["student"], activeRole: "student" });

    expect(canAccessArea(student, "student")).toBe(true);
    expect(canAccessArea(student, "teacher")).toBe(false);
  });

  it("professor não acessa administração", () => {
    const teacher = makeContext({ roles: ["teacher"], activeRole: "teacher" });

    expect(canAccessArea(teacher, "teacher")).toBe(true);
    expect(canAccessArea(teacher, "admin")).toBe(false);
    expect(canAccessArea(teacher, "coordination")).toBe(false);
  });

  it("editor de conteúdo não acessa gestão de matrículas", () => {
    const editor = makeContext({
      roles: ["content_editor"],
      activeRole: "content_editor",
    });

    expect(canAccessArea(editor, "content_editor")).toBe(true);
    expect(can(editor, { resource: "enrollments", action: "manage" })).toBe(
      false,
    );
  });

  it("coordenação gerencia matrículas e convites, mas não perfis/permissões nem auditoria", () => {
    const coordinator = makeContext({
      roles: ["coordinator"],
      activeRole: "coordinator",
    });

    expect(can(coordinator, { resource: "enrollments", action: "manage" })).toBe(
      true,
    );
    expect(can(coordinator, { resource: "invitations", action: "create" })).toBe(
      true,
    );
    expect(can(coordinator, { resource: "user_roles", action: "manage" })).toBe(
      false,
    );
    expect(can(coordinator, { resource: "audit_logs", action: "read" })).toBe(
      false,
    );
  });

  it("administrador herda o que a coordenação pode, além de exclusividades próprias", () => {
    const admin = makeContext({ roles: ["admin"], activeRole: "admin" });

    expect(canAccessArea(admin, "coordination")).toBe(true);
    expect(can(admin, { resource: "enrollments", action: "manage" })).toBe(true);
    expect(can(admin, { resource: "invitations", action: "create" })).toBe(true);
    expect(can(admin, { resource: "user_roles", action: "manage" })).toBe(true);
    expect(can(admin, { resource: "audit_logs", action: "read" })).toBe(true);
  });

  it("usuário só lê/atualiza o próprio perfil, nunca o de outra pessoa via *_own", () => {
    const student = makeContext({ roles: ["student"], activeRole: "student" });

    expect(
      can(student, {
        resource: "profile",
        action: "read_own",
        targetUserId: "user-1",
      }),
    ).toBe(true);
    expect(
      can(student, {
        resource: "profile",
        action: "read_own",
        targetUserId: "outro-usuario",
      }),
    ).toBe(false);
    expect(can(student, { resource: "profile", action: "read_any" })).toBe(
      false,
    );
  });

  it("usuário com múltiplos perfis: sem perfil ativo resolvido, área nenhuma é liberada", () => {
    const multiRoleNoActive = makeContext({
      roles: ["student", "teacher"],
      activeRole: null,
    });

    expect(canAccessArea(multiRoleNoActive, "student")).toBe(false);
    expect(canAccessArea(multiRoleNoActive, "teacher")).toBe(false);
  });

  it("trocar o perfil ativo altera as permissões concedidas (mesma conta, dois contextos)", () => {
    const asStudent = makeContext({
      roles: ["student", "teacher"],
      activeRole: "student",
    });
    const asTeacher = makeContext({
      roles: ["student", "teacher"],
      activeRole: "teacher",
    });

    expect(canAccessArea(asStudent, "student")).toBe(true);
    expect(canAccessArea(asStudent, "teacher")).toBe(false);

    expect(canAccessArea(asTeacher, "student")).toBe(false);
    expect(canAccessArea(asTeacher, "teacher")).toBe(true);
  });

  it("nunca confia em um perfil ativo que a conta não possui de fato (defesa contra cookie adulterado)", () => {
    const tampered = makeContext({
      roles: ["student"],
      activeRole: "admin", // a conta NÃO tem o perfil admin em `roles`
    });

    expect(canAccessArea(tampered, "admin")).toBe(false);
    expect(canAccessArea(tampered, "student")).toBe(false);
  });

  it("usuário suspenso perde o acesso a tudo, mesmo com o perfil certo", () => {
    const suspendedAdmin = makeContext({
      roles: ["admin"],
      activeRole: "admin",
      profileStatus: "suspended",
    });

    expect(canAccessArea(suspendedAdmin, "admin")).toBe(false);
    expect(
      can(suspendedAdmin, {
        resource: "profile",
        action: "read_own",
        targetUserId: "user-1",
      }),
    ).toBe(false);
  });

  it("verificação de recurso desconhecida nega por padrão (fail closed)", () => {
    const admin = makeContext({ roles: ["admin"], activeRole: "admin" });

    // @ts-expect-error — resource/action fora da união conhecida, de propósito
    expect(can(admin, { resource: "algo_inexistente", action: "fazer" })).toBe(
      false,
    );
  });
});

describe("políticas da Fase 2 — administração acadêmica", () => {
  it("coordenação e admin gerenciam temporadas, ofertas, turmas e encontros; professor e aluno não", () => {
    const coordinator = makeContext({
      roles: ["coordinator"],
      activeRole: "coordinator",
    });
    const admin = makeContext({ roles: ["admin"], activeRole: "admin" });
    const teacher = makeContext({ roles: ["teacher"], activeRole: "teacher" });
    const student = makeContext({ roles: ["student"], activeRole: "student" });

    for (const check of [
      { resource: "seasons", action: "manage" } as const,
      { resource: "offerings", action: "manage" } as const,
      { resource: "classes", action: "manage" } as const,
      { resource: "class_meetings", action: "manage" } as const,
      { resource: "teacher_assignments", action: "manage" } as const,
    ]) {
      expect(can(coordinator, check)).toBe(true);
      expect(can(admin, check)).toBe(true);
      expect(can(teacher, check)).toBe(false);
      expect(can(student, check)).toBe(false);
    }
  });

  it("exceção de pré-requisito só pode ser criada/lida por coordenação/admin", () => {
    const coordinator = makeContext({
      roles: ["coordinator"],
      activeRole: "coordinator",
    });
    const teacher = makeContext({ roles: ["teacher"], activeRole: "teacher" });

    expect(
      can(coordinator, { resource: "prerequisite_exceptions", action: "create" }),
    ).toBe(true);
    expect(
      can(teacher, { resource: "prerequisite_exceptions", action: "create" }),
    ).toBe(false);
  });

  it("importação de planilha só pode ser feita por coordenação/admin", () => {
    const admin = makeContext({ roles: ["admin"], activeRole: "admin" });
    const contentEditor = makeContext({
      roles: ["content_editor"],
      activeRole: "content_editor",
    });

    expect(can(admin, { resource: "imports", action: "create" })).toBe(true);
    expect(can(contentEditor, { resource: "imports", action: "create" })).toBe(
      false,
    );
  });
});

describe("políticas da Fase 3 — conteúdo e exercícios", () => {
  it("editor de conteúdo gerencia conteúdo, banco de questões, exercícios e regras de liberação", () => {
    const editor = makeContext({
      roles: ["content_editor"],
      activeRole: "content_editor",
    });

    for (const check of [
      { resource: "content", action: "manage" } as const,
      { resource: "question_bank", action: "manage" } as const,
      { resource: "activities", action: "manage" } as const,
      { resource: "release_rules", action: "manage" } as const,
    ]) {
      expect(can(editor, check)).toBe(true);
    }
  });

  it("coordenação e admin também gerenciam conteúdo (não é exclusividade do editor)", () => {
    const coordinator = makeContext({
      roles: ["coordinator"],
      activeRole: "coordinator",
    });
    const admin = makeContext({ roles: ["admin"], activeRole: "admin" });

    expect(can(coordinator, { resource: "content", action: "manage" })).toBe(true);
    expect(can(admin, { resource: "content", action: "manage" })).toBe(true);
  });

  it("professor não edita conteúdo oficial nem o banco de questões (doc 03 §3)", () => {
    const teacher = makeContext({ roles: ["teacher"], activeRole: "teacher" });

    expect(can(teacher, { resource: "content", action: "manage" })).toBe(false);
    expect(can(teacher, { resource: "question_bank", action: "manage" })).toBe(false);
  });

  it("aluno não gerencia conteúdo, exercícios nem banco de questões", () => {
    const student = makeContext({ roles: ["student"], activeRole: "student" });

    expect(can(student, { resource: "content", action: "manage" })).toBe(false);
    expect(can(student, { resource: "activities", action: "manage" })).toBe(false);
    expect(can(student, { resource: "question_bank", action: "manage" })).toBe(false);
  });
});

describe("políticas da Fase 4 — frequência e relatório pós-aula", () => {
  it("professor registra frequência, mas não corrige (doc 03 §7)", () => {
    const teacher = makeContext({ roles: ["teacher"], activeRole: "teacher" });

    expect(can(teacher, { resource: "attendance", action: "record" })).toBe(true);
    expect(can(teacher, { resource: "attendance", action: "correct" })).toBe(false);
  });

  it("coordenação e admin registram e corrigem frequência", () => {
    const coordinator = makeContext({
      roles: ["coordinator"],
      activeRole: "coordinator",
    });
    const admin = makeContext({ roles: ["admin"], activeRole: "admin" });

    for (const person of [coordinator, admin]) {
      expect(can(person, { resource: "attendance", action: "record" })).toBe(true);
      expect(can(person, { resource: "attendance", action: "correct" })).toBe(true);
    }
  });

  it("aluno nunca registra nem corrige frequência", () => {
    const student = makeContext({ roles: ["student"], activeRole: "student" });

    expect(can(student, { resource: "attendance", action: "record" })).toBe(false);
    expect(can(student, { resource: "attendance", action: "correct" })).toBe(false);
  });

  it("professor envia relatório pós-aula; só coordenação/admin têm a leitura consolidada", () => {
    const teacher = makeContext({ roles: ["teacher"], activeRole: "teacher" });
    const coordinator = makeContext({
      roles: ["coordinator"],
      activeRole: "coordinator",
    });

    expect(can(teacher, { resource: "class_reports", action: "submit" })).toBe(true);
    expect(can(teacher, { resource: "class_reports", action: "read" })).toBe(false);
    expect(can(coordinator, { resource: "class_reports", action: "read" })).toBe(true);
  });
});

describe("políticas da Fase 5 — avaliações e recuperação", () => {
  it("editor monta avaliações, mas não publica, não libera gabarito nem concede tentativa excepcional", () => {
    const editor = makeContext({
      roles: ["content_editor"],
      activeRole: "content_editor",
    });

    expect(can(editor, { resource: "assessments", action: "manage" })).toBe(true);
    expect(can(editor, { resource: "assessments", action: "publish" })).toBe(false);
    expect(can(editor, { resource: "assessments", action: "release_answer_key" })).toBe(false);
    expect(
      can(editor, { resource: "assessments", action: "grant_exceptional_attempt" }),
    ).toBe(false);
  });

  it("coordenação e admin publicam, liberam gabarito e concedem tentativa excepcional", () => {
    const coordinator = makeContext({
      roles: ["coordinator"],
      activeRole: "coordinator",
    });
    const admin = makeContext({ roles: ["admin"], activeRole: "admin" });

    for (const person of [coordinator, admin]) {
      expect(can(person, { resource: "assessments", action: "publish" })).toBe(true);
      expect(can(person, { resource: "assessments", action: "release_answer_key" })).toBe(true);
      expect(
        can(person, { resource: "assessments", action: "grant_exceptional_attempt" }),
      ).toBe(true);
    }
  });

  it("só aluno faz avaliação; professor e staff de conteúdo não", () => {
    const student = makeContext({ roles: ["student"], activeRole: "student" });
    const teacher = makeContext({ roles: ["teacher"], activeRole: "teacher" });

    expect(can(student, { resource: "assessments", action: "take" })).toBe(true);
    expect(can(teacher, { resource: "assessments", action: "take" })).toBe(false);
  });

  it("professor nunca gerencia avaliações (não cria, não edita conteúdo oficial)", () => {
    const teacher = makeContext({ roles: ["teacher"], activeRole: "teacher" });
    expect(can(teacher, { resource: "assessments", action: "manage" })).toBe(false);
  });
});

describe("resolveActiveRole — seleção/troca de perfil ativo", () => {
  it("usa o cookie quando ele corresponde a um perfil real do usuário", () => {
    expect(resolveActiveRole(["student", "teacher"], "teacher")).toBe(
      "teacher",
    );
  });

  it("ignora um cookie que não corresponde a nenhum perfil do usuário (sem fallback de perfil único ambíguo)", () => {
    expect(resolveActiveRole(["student", "teacher"], "admin")).toBeNull();
  });

  it("com apenas um perfil possível, resolve para ele mesmo se o cookie (inválido) apontar para outro", () => {
    // Comportamento documentado: sem ambiguidade real (só existe um perfil
    // possível), não força seleção manual só por causa de um cookie velho/
    // adulterado — mas o valor retornado vem sempre de `roles` (dado real),
    // nunca do cookie não confiável.
    expect(resolveActiveRole(["student"], "admin")).toBe("student");
  });

  it("resolve automaticamente quando há apenas um perfil possível", () => {
    expect(resolveActiveRole(["student"], undefined)).toBe("student");
  });

  it("exige seleção explícita quando há múltiplos perfis e nenhum cookie válido", () => {
    expect(resolveActiveRole(["student", "teacher"], undefined)).toBeNull();
  });

  it("retorna null quando o usuário não possui nenhum perfil atribuído", () => {
    expect(resolveActiveRole([], undefined)).toBeNull();
  });
});
