export interface StudentAnnouncement {
  id: string;
  title: string;
  body: string;
  published_at: string;
  is_urgent: boolean;
  expires_at: string | null;
}

/** Aviso ainda no ar: sem data de saída ou com a data de saída no futuro. */
export function isAnnouncementActive(a: Pick<StudentAnnouncement, "expires_at">, now: Date): boolean {
  return a.expires_at === null || new Date(a.expires_at).getTime() > now.getTime();
}

/**
 * Separa os avisos do aluno: os IMPORTANTES vão em destaque no topo (todos os que estão no ar, do mais novo ao mais antigo);
 * os comuns seguem na lista "Avisos da escola" (os mais recentes, até `regularLimit`). Aviso vencido não aparece.
 */
export function splitStudentAnnouncements(
  rows: StudentAnnouncement[],
  now: Date,
  regularLimit = 4,
): { urgent: StudentAnnouncement[]; regular: StudentAnnouncement[] } {
  const newestFirst = (a: StudentAnnouncement, b: StudentAnnouncement) => (a.published_at < b.published_at ? 1 : a.published_at > b.published_at ? -1 : 0);
  const active = rows.filter((row) => isAnnouncementActive(row, now)).sort(newestFirst);
  return {
    urgent: active.filter((row) => row.is_urgent),
    regular: active.filter((row) => !row.is_urgent).slice(0, regularLimit),
  };
}
