import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const dir = path.join(root, "supabase/migrations");
const original = readFileSync(path.join(dir, "00000000000032_assessment_attempt_functions.sql"), "utf-8");
const migration = readFileSync(path.join(dir, "00000000000089_answer_key_after_submit.sql"), "utf-8");

function reviewFunction(sql: string): string {
  const from = sql.indexOf("create or replace function public.get_assessment_attempt_review");
  const to = sql.indexOf("revoke execute on function public.get_assessment_attempt_review");
  return sql
    .slice(from, to)
    .replace(/\\u([0-9a-f]{4})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/E'/g, "'")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const OWNER_CHECK =
  "if v_owner is not true then raise exception 'Tentativa não encontrada ou não pertence a este usuário.'; end if; ";
const FINISHED_CHECK =
  "if not exists ( select 1 from public.assessment_attempts where id = p_attempt_id and status in ('submitted', 'expired') ) then raise exception 'Termine a avaliação para ver o gabarito.'; end if; ";

describe("migração 089: gabarito só depois de terminar a prova", () => {
  it("get_assessment_attempt_review só ganhou a conferência do status, logo depois do dono", () => {
    const before = reviewFunction(original);
    expect(before).toContain(OWNER_CHECK);
    expect(reviewFunction(migration)).toBe(before.replace(OWNER_CHECK, OWNER_CHECK + FINISHED_CHECK));
  });

  it("mantém as permissões da função", () => {
    expect(migration).toContain("revoke execute on function public.get_assessment_attempt_review(uuid) from public, anon;");
    expect(migration).toContain("grant execute on function public.get_assessment_attempt_review(uuid) to authenticated;");
  });

  it("é só ASCII, idempotente e sem travessão", () => {
    expect(/[^\x00-\x7f]/.test(migration)).toBe(false);
    expect(migration).not.toMatch(/[—–]/);
    expect(migration).toContain("create or replace function public.attempt_review_open");
    expect(migration).toContain("drop policy if exists assessment_attempt_questions_select_own");
    expect(migration).toContain("drop policy if exists assessment_answers_select_own");
  });

  it("as duas políticas do aluno passam pela função (tentativa terminada e gabarito liberado)", () => {
    expect(migration).toMatch(/create policy assessment_attempt_questions_select_own[\s\S]*?using \(public\.attempt_review_open\(attempt_id\)\);/);
    expect(migration).toMatch(/create policy assessment_answers_select_own[\s\S]*?using \(public\.attempt_review_open\(attempt_id\)\);/);
    expect(migration).toContain("a.status in ('submitted', 'expired')");
    expect(migration).toContain("s.answer_key_released_at is not null");
    expect(migration).toContain("e.student_id = auth.uid()");
  });

  it("não mexe nas políticas da equipe", () => {
    expect(migration).not.toMatch(/_select_staff/);
  });
});

describe("o aplicativo não lê as tabelas do gabarito direto com a sessão", () => {
  function files(d: string): string[] {
    return readdirSync(d).flatMap((n) => {
      const p = path.join(d, n);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  }
  it("nenhum arquivo de src faz from() em assessment_attempt_questions ou assessment_answers", () => {
    const offenders = files(path.join(root, "src"))
      .filter((f) => !f.endsWith("types.ts"))
      .filter((f) => /from\(\s*["'](assessment_attempt_questions|assessment_answers)["']\s*\)/.test(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });
});
