export interface LessonBlockLike {
  meetingDateKey: string | null;
  startTime: string | null;
  blockStatus: string;
  meetingStatus: string;
}

/**
 * Próxima aula efetivamente atribuída ao professor: ignora blocos/encontros
 * cancelados e blocos sem data (a coordenação ainda não programou a data
 * real do encontro), escolhe a data+hora mais próxima a partir de hoje.
 * Nunca deriva "próxima aula" de um vínculo de turma sem bloco — quem chama
 * esta função já deve ter filtrado só os blocos deste professor.
 */
export function selectNextLesson<T extends LessonBlockLike>(blocks: T[], todayKey: string): T | null {
  const upcoming = blocks
    .filter((b): b is T & { meetingDateKey: string } => b.meetingDateKey !== null)
    .filter((b) => b.blockStatus !== "canceled" && b.meetingStatus !== "canceled")
    .filter((b) => b.meetingDateKey >= todayKey)
    .sort((a, b) => {
      if (a.meetingDateKey !== b.meetingDateKey) {
        return a.meetingDateKey < b.meetingDateKey ? -1 : 1;
      }
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });

  return upcoming[0] ?? null;
}
