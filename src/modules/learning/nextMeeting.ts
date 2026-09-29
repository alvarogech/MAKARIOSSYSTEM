export interface MeetingLike {
  meetingDateKey: string; // "YYYY-MM-DD"
  startTime: string | null;
}

/**
 * Encontro mais próximo cuja data seja hoje ou futura (comparação lexicográfica
 * de "YYYY-MM-DD", que já ordena corretamente por calendário), desempatando
 * por horário de início quando duas turmas têm encontro no mesmo dia.
 */
export function selectNextMeeting<T extends MeetingLike>(meetings: T[], todayKey: string): T | null {
  const upcoming = [...meetings]
    .filter((meeting) => meeting.meetingDateKey >= todayKey)
    .sort((a, b) => {
      if (a.meetingDateKey !== b.meetingDateKey) {
        return a.meetingDateKey < b.meetingDateKey ? -1 : 1;
      }
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });

  return upcoming[0] ?? null;
}
