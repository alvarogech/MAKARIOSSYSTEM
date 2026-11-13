import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.resolve(__dirname, "../../supabase/migrations");
const original = readFileSync(path.join(dir, "00000000000032_assessment_attempt_functions.sql"), "utf-8");
const migration = readFileSync(path.join(dir, "00000000000087_assessment_late_releases.sql"), "utf-8");

/** Pega só a função start_assessment_attempt, sem comentários, com espaços normalizados e acentos "decodificados". */
function startFunction(sql: string): string {
  const from = sql.indexOf("create or replace function public.start_assessment_attempt");
  const to = sql.indexOf("revoke execute on function public.start_assessment_attempt");
  return sql
    .slice(from, to)
    .replace(/\\u([0-9a-f]{4})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/E'/g, "'")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const OLD_DEADLINE_CHECK =
  "if v_assessment.closes_at is not null and now() > v_assessment.closes_at then raise exception 'O prazo desta avaliação já encerrou.'; end if; ";
const NEW_DEADLINE_CHECK =
  "if v_assessment.closes_at is not null and now() > v_assessment.closes_at and not exists ( select 1 from public.assessment_late_releases r where r.assessment_id = p_assessment_id and r.enrollment_id = v_enrollment_id and r.valid_until > now() ) then raise exception 'O prazo desta avaliação já encerrou.'; end if; ";
const ENROLLMENT_CHECK =
  "if v_enrollment_id is null then raise exception 'Você não tem matrícula ativa nesta oferta de volume.'; end if; ";

describe("migração 087: start_assessment_attempt", () => {
  const before = startFunction(original);
  const after = startFunction(migration);

  it("a definição de partida contém a regra antiga do prazo", () => {
    expect(before).toContain(OLD_DEADLINE_CHECK);
  });

  it("a ÚNICA mudança é a regra do prazo, e ela foi para depois de achar a matrícula", () => {
    const expected = before
      .replace(OLD_DEADLINE_CHECK, "")
      .replace(ENROLLMENT_CHECK, ENROLLMENT_CHECK + NEW_DEADLINE_CHECK);
    expect(after).toBe(expected);
  });

  it("o limite de tentativas continua só pela tentativa excepcional (a liberação não dá tentativa extra)", () => {
    expect(after).toContain("v_max_attempts := 1;");
    expect(after).toContain("from public.assessment_exceptional_grants");
    expect(after).not.toMatch(/v_max_attempts := (?!1;|2;)/);
    expect(after.match(/assessment_late_releases/g)).toHaveLength(1);
  });

  it("o tempo da prova continua o da avaliação (60 minutos), não o da liberação", () => {
    expect(after).toContain("now() + make_interval(mins => v_assessment.duration_minutes)");
  });

  it("mantém as permissões da função", () => {
    expect(migration).toContain("revoke execute on function public.start_assessment_attempt(uuid) from public, anon;");
    expect(migration).toContain("grant execute on function public.start_assessment_attempt(uuid) to authenticated;");
  });
});

describe("migração 087: tabela e segurança", () => {
  it("é só ASCII (cola no SQL Editor sem corromper acento)", () => {
    expect(/[^\x00-\x7f]/.test(migration)).toBe(false);
  });

  it("é idempotente: cada criação tem a sua proteção", () => {
    expect(migration).toContain("create table if not exists public.assessment_late_releases");
    expect(migration).toContain("drop trigger if exists assessment_late_releases_audit");
    for (const name of ["select_own", "select_staff", "insert_staff", "update_staff"]) {
      expect(migration).toContain(`drop policy if exists assessment_late_releases_${name}`);
    }
    expect(migration).toContain("create or replace function public.start_assessment_attempt");
  });

  it("tem as colunas pedidas, unicidade, RLS e auditoria", () => {
    for (const col of ["assessment_id", "enrollment_id", "valid_until", "granted_by", "reason", "created_at"]) {
      expect(migration).toContain(col);
    }
    expect(migration).toContain("unique (assessment_id, enrollment_id)");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("after insert or update or delete on public.assessment_late_releases");
    expect(migration).toContain("execute function private.log_audit_event()");
  });

  it("aluno só lê a sua; equipe grava em nome próprio", () => {
    expect(migration).toMatch(/select_own[\s\S]*e\.student_id = auth\.uid\(\)/);
    expect(migration.match(/granted_by = auth\.uid\(\)/g)?.length).toBe(2);
    expect(migration).not.toMatch(/for (delete|all) to authenticated/);
  });

  it("não usa travessão", () => {
    expect(migration).not.toMatch(/[—–]/);
  });
});
