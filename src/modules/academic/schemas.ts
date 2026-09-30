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

export const assignLessonBlockSchema = z.object({
  classMeetingId: z.string().uuid("Selecione um encontro."),
  moduleId: z.string().uuid("Selecione um módulo/tema.").optional(),
  teacherEmail: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "Informe o horário de início (HH:MM)."),
  endTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "Informe o horário de término (HH:MM)."),
  orderIndex: z.coerce.number().int().positive(),
  coordinationNotes: z.string().trim().optional(),
});

export type AssignLessonBlockInput = z.infer<typeof assignLessonBlockSchema>;

export const createLocationSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do local."),
  address: z.string().trim().optional(),
  entryInstructions: z.string().trim().optional(),
  parkingInstructions: z.string().trim().optional(),
  arrivalMinutesBefore: z.coerce.number().int().positive().optional(),
  coordinationContact: z.string().trim().optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const assignClassLocationSchema = z.object({
  classId: z.string().uuid("Selecione uma turma."),
  locationId: z.string().uuid("Selecione um local."),
});

export type AssignClassLocationInput = z.infer<typeof assignClassLocationSchema>;

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1, "Informe o título do aviso."),
  body: z.string().trim().min(1, "Informe o texto do aviso."),
  classId: z.string().uuid().optional().or(z.literal("")),
  moduleId: z.string().uuid().optional().or(z.literal("")),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
