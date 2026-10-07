import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { volumeLabel } from "@/modules/enrollment/labels";

type DB = SupabaseClient<Database>;

/** Em que ponto do caminho cada aluno aprovado está. */
export type AccessStage =
  /** Aprovado, mas ainda não criou a conta (não abriu o link do e-mail). */
  | "sem_conta"
  /** Criou a conta, mas nunca entrou. */
  | "conta_sem_login"
  /** Entrou na plataforma, mas ainda não abriu nenhum material. */
  | "entrou_sem_material"
  /** Já abriu pelo menos um material. */
  | "abriu_material";

export const ACCESS_STAGE_LABELS: Record<AccessStage, string> = {
  sem_conta: "Ainda não criou a conta",
  conta_sem_login: "Criou a conta, nunca entrou",
  entrou_sem_material: "Entrou, não abriu material",
  abriu_material: "Abriu material",
};

export interface AccessPerson {
  personKey: string;
  name: string;
  email: string;
  phone: string;
  volumes: string[];
  stage: AccessStage;
  lastSignInAt: string | null;
  materialsOpened: number;
  lastMaterialAt: string | null;
}

export interface AccessSummary {
  approved: number;
  /** Criaram a conta (qualquer etapa depois de "sem_conta"). */
  withAccount: number;
  /** Já entraram ao menos uma vez. */
  loggedIn: number;
  /** Abriram ao menos um material (a contagem começa quando o registro entrou no ar). */
  openedMaterial: number;
  byStage: Record<AccessStage, number>;
}

function stageOf(row: { student_id: string | null; last_sign_in_at: string | null; materials_opened: number }): AccessStage {
  if (!row.student_id) return "sem_conta";
  if (!row.last_sign_in_at) return "conta_sem_login";
  if (row.materials_opened === 0) return "entrou_sem_material";
  return "abriu_material";
}

export function summarize(people: AccessPerson[]): AccessSummary {
  const byStage: Record<AccessStage, number> = { sem_conta: 0, conta_sem_login: 0, entrou_sem_material: 0, abriu_material: 0 };
  for (const p of people) byStage[p.stage] += 1;
  return {
    approved: people.length,
    withAccount: people.length - byStage.sem_conta,
    loggedIn: byStage.entrou_sem_material + byStage.abriu_material,
    openedMaterial: byStage.abriu_material,
    byStage,
  };
}

/**
 * Alunos com inscrição aprovada e o quanto já acessaram a plataforma. Uma pessoa
 * com dois volumes aparece uma vez só. A função do banco só devolve linhas para
 * coordenação/admin.
 */
export async function loadStudentAccess(supabase: DB): Promise<AccessPerson[]> {
  const { data } = await supabase.rpc("coordination_student_access");

  const byPerson = new Map<string, AccessPerson>();
  for (const row of data ?? []) {
    const existing = byPerson.get(row.person_key);
    const volume = volumeLabel(row.volume_slug);
    if (existing) {
      if (volume && !existing.volumes.includes(volume)) existing.volumes.push(volume);
      continue;
    }
    byPerson.set(row.person_key, {
      personKey: row.person_key,
      name: row.full_name,
      email: row.email,
      phone: row.phone,
      volumes: volume ? [volume] : [],
      stage: stageOf(row),
      lastSignInAt: row.last_sign_in_at,
      materialsOpened: row.materials_opened,
      lastMaterialAt: row.last_material_at,
    });
  }
  return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
