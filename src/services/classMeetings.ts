/**
 * Geração de encontros a partir de um modelo de turma (class_template).
 * Função pura — nunca inventa data real de encontro (doc 08 §14), só a
 * estrutura de minutos acadêmicos/sequência que a coordenação depois
 * ajusta com datas reais.
 */

export interface ClassTemplateSpec {
  meetingsCount: number;
  academicMinutesPerMeeting: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export interface GeneratedMeeting {
  sequence: number;
  academicMinutes: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export function generateClassMeetings(
  template: ClassTemplateSpec,
): GeneratedMeeting[] {
  return Array.from({ length: template.meetingsCount }, (_, index) => ({
    sequence: index + 1,
    academicMinutes: template.academicMinutesPerMeeting,
    startTime: template.startTime,
    endTime: template.endTime,
    breakMinutes: template.breakMinutes,
  }));
}

/** Espelha a constraint `class_templates_total_minutes_consistent` do banco. */
export function isTemplateMinutesConsistent(
  template: ClassTemplateSpec & { totalAcademicMinutes: number },
): boolean {
  return (
    template.totalAcademicMinutes ===
    template.meetingsCount * template.academicMinutesPerMeeting
  );
}
