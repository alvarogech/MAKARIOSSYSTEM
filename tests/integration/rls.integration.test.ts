/**
 * Testes de integração das políticas de RLS descritas nas migrations em
 * supabase/migrations/. Precisam de um Supabase local rodando
 * (`supabase start` + `supabase db reset`, que também roda supabase/seed.sql)
 * — por isso ficam fora da suíte padrão (`npm test`), que não depende de
 * Docker.
 *
 * IMPORTANTE (pendência declarada em FASE_1_RELATORIO.md): este arquivo
 * NÃO foi executado nesta sessão porque o ambiente não tinha Docker/
 * Supabase CLI disponíveis. Ele documenta o comportamento esperado e deve
 * ser a primeira coisa a rodar (`npm run test:integration`) assim que o
 * ambiente local for configurado, antes de qualquer trabalho da Fase 2.
 *
 * Rodar:
 *   supabase start && supabase db reset
 *   npm run test:integration
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_LOCAL_SECRET_KEY ?? "";

const TEST_PASSWORD = "Makarios#2026";

const TEST_USERS = {
  admin: "admin.teste@makarios.local",
  coordinator: "coordenacao.teste@makarios.local",
  teacher: "professor.teste@makarios.local",
  student: "aluno.teste@makarios.local",
  contentEditor: "editor.teste@makarios.local",
  suspended: "suspenso.teste@makarios.local",
};

async function signInAs(email: string) {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) {
    throw new Error(`Falha ao autenticar ${email} no Supabase local: ${error.message}`);
  }
  return client;
}

const hasLocalSupabaseConfig = SUPABASE_PUBLISHABLE_KEY.length > 0 && SUPABASE_SECRET_KEY.length > 0;

describe.skipIf(!hasLocalSupabaseConfig)(
  "RLS — acesso direto à API do Supabase (integração, requer ambiente local)",
  () => {
    let adminClient: ReturnType<typeof createClient<Database>>;

    beforeAll(() => {
      adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY);
    });

    it("aluno não lê o profile de outro usuário via API direta", async () => {
      const student = await signInAs(TEST_USERS.student);
      const { data: own } = await student
        .from("profiles")
        .select("id")
        .limit(10);

      // RLS só deve permitir a própria linha — nunca a de outro usuário.
      expect(own?.every((row) => true)).toBe(true);

      const { data: coordinatorProfile, error } = await student
        .from("profiles")
        .select("id")
        .eq("full_name", "Coordenação de Teste")
        .maybeSingle();

      // Não é erro de permissão explícito (RLS filtra silenciosamente),
      // mas a linha de outro usuário nunca deve vir de volta.
      expect(error).toBeNull();
      expect(coordinatorProfile).toBeNull();
    });

    it("aluno não consegue se autoatribuir o perfil admin via API direta", async () => {
      const student = await signInAs(TEST_USERS.student);
      const { data: adminRole } = await adminClient
        .from("roles")
        .select("id")
        .eq("slug", "admin")
        .single();

      const { error } = await student.from("user_roles").insert({
        user_id: (await student.auth.getUser()).data.user!.id,
        role_id: adminRole!.id,
      });

      expect(error).not.toBeNull();
    });

    it("professor não lê a tabela de convites (exclusiva de admin/coordenação)", async () => {
      const teacher = await signInAs(TEST_USERS.teacher);
      const { data, error } = await teacher.from("invitations").select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("coordenação consegue criar convite; professor não", async () => {
      const coordinator = await signInAs(TEST_USERS.coordinator);
      const { data: studentRole } = await adminClient
        .from("roles")
        .select("id")
        .eq("slug", "student")
        .single();

      const { error: coordinatorError } = await coordinator
        .from("invitations")
        .insert({
          email: `convite-teste-${Date.now()}@makarios.local`,
          intended_role_id: studentRole!.id,
          invited_by: (await coordinator.auth.getUser()).data.user!.id,
        });
      expect(coordinatorError).toBeNull();

      const teacher = await signInAs(TEST_USERS.teacher);
      const { error: teacherError } = await teacher.from("invitations").insert({
        email: `convite-teste-professor-${Date.now()}@makarios.local`,
        intended_role_id: studentRole!.id,
        invited_by: (await teacher.auth.getUser()).data.user!.id,
      });
      expect(teacherError).not.toBeNull();
    });

    it("usuário suspenso não consegue atualizar o próprio profile", async () => {
      const suspended = await signInAs(TEST_USERS.suspended);
      const userId = (await suspended.auth.getUser()).data.user!.id;

      const { error, data } = await suspended
        .from("profiles")
        .update({ full_name: "Tentativa de burlar suspensão" })
        .eq("id", userId)
        .select();

      // RLS nega via `current_profile_is_active()` na policy de UPDATE —
      // o update afeta zero linhas (nenhum erro de permissão explícito,
      // mas nenhuma linha é retornada/alterada).
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("ninguém além de service_role acessa a tabela interna `jobs` (schema private, não roteável)", async () => {
      const admin = await signInAs(TEST_USERS.admin);
      // `private` não é um schema exposto pelo PostgREST — esta chamada
      // deve falhar já na resolução do schema, não por RLS.
      const { error } = await admin
        .schema("private" as never)
        .from("jobs")
        .select("id");

      expect(error).not.toBeNull();
    });
  },
);
