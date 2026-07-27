import { z } from "zod";

export const createSeasonSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da temporada (ex.: 2026.2)."),
  startsOn: z.string().trim().optional(),
  endsOn: z.string().trim().optional(),
});

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;

export const createOfferingSchema = z.object({
  seasonId: z.string().uuid("Selecione uma temporada."),
  volumeId: z.string().uuid("Selecione um volume."),
});

export type CreateOfferingInput = z.infer<typeof createOfferingSchema>;

export const createClassSchema = z.object({
  seasonVolumeOfferingId: z.string().uuid("Selecione uma oferta de volume."),
  classTemplateId: z.string().uuid("Selecione um modelo de horário."),
  name: z.string().trim().min(1, "Informe o nome da turma."),
  location: z.string().trim().optional(),
  capacity: z.coerce.number().int().positive().optional(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;

export const assignTeacherSchema = z.object({
  classId: z.string().uuid("Selecione uma turma."),
  teacherEmail: z.string().trim().email("E-mail inválido."),
  moduleId: z.string().uuid().optional(),
});

export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;

export const createEnrollmentSchema = z.object({
  studentEmail: z.string().trim().email("E-mail inválido."),
  seasonVolumeOfferingId: z.string().uuid("Selecione uma oferta de volume."),
  classId: z.string().uuid("Selecione uma turma."),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

export const createPrerequisiteExceptionSchema = z.object({
  studentEmail: z.string().trim().email("E-mail inválido."),
  volumeId: z.string().uuid(),
  missingPrerequisiteVolumeId: z.string().uuid(),
  justification: z.string().trim().min(10, "Descreva a justificativa (mínimo 10 caracteres)."),
});

export type CreatePrerequisiteExceptionInput = z.infer<
  typeof createPrerequisiteExceptionSchema
>;
