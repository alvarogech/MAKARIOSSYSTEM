export interface ScheduleBlockInterval {
  id: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  label: string;
}

export interface ScheduleConflict {
  dateKey: string;
  blocks: ScheduleBlockInterval[];
}

/**
 * Sobreposição REAL de horário entre aulas do mesmo professor — compara
 * intervalos de início/término, não apenas "mesmo horário de início" nem
 * "vinculado às duas turmas". Duas turmas cujo modelo de horário coincide
 * (ex.: ambas sábado 08h-12h30) não geram conflito aqui se as aulas
 * efetivamente atribuídas àquele professor, dentro do dia, não se cruzam.
 */
export function detectScheduleConflicts(blocks: ScheduleBlockInterval[]): ScheduleConflict[] {
  const byDate = new Map<string, ScheduleBlockInterval[]>();
  for (const block of blocks) {
    const list = byDate.get(block.dateKey) ?? [];
    list.push(block);
    byDate.set(block.dateKey, list);
  }

  const conflicts: ScheduleConflict[] = [];
  for (const [dateKey, dayBlocks] of byDate) {
    const overlapping: ScheduleBlockInterval[] = [];
    for (let i = 0; i < dayBlocks.length; i++) {
      for (let j = i + 1; j < dayBlocks.length; j++) {
        const a = dayBlocks[i];
        const b = dayBlocks[j];
        if (!a || !b) continue;
        const intervalsOverlap = a.startTime < b.endTime && b.startTime < a.endTime;
        if (intervalsOverlap) {
          if (!overlapping.includes(a)) overlapping.push(a);
          if (!overlapping.includes(b)) overlapping.push(b);
        }
      }
    }
    if (overlapping.length > 0) {
      conflicts.push({ dateKey, blocks: overlapping });
    }
  }

  return conflicts;
}
