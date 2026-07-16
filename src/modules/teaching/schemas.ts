import { z } from "zod";

const attendanceStatusEnum = z.enum([
  "presente",
  "ausente",
  "atrasado",
  "presenca_parcial",
  "falta_justificada",
  "reposicao",
  "pendente",
]);

export const attendanceRowSchema = z.object({
  enrollmentId: z.string().uuid(),
  status: attendanceStatusEnum,
  recognizedMinutes: z.coerce.number().int().min(0).optional(),
  observation: z.string().trim().optional(),
});
export type AttendanceRowInput = z.infer<typeof attendanceRowSchema>;

export const saveAttendanceSchema = z.object({
  meetingId: z.string().uuid(),
  rows: z.array(attendanceRowSchema).min(1),
  justification: z.string().trim().optional(),
});
export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;

export const finalizeAttendanceSchema = z.object({
  meetingId: z.string().uuid(),
});
export type FinalizeAttendanceInput = z.infer<typeof finalizeAttendanceSchema>;

export const submitClassReportSchema = z.object({
  meetingId: z.string().uuid(),
  contentCompleted: z.string().trim().optional(),
  planChanged: z.coerce.boolean().optional(),
  planChangeNotes: z.string().trim().optional(),
  recurringQuestions: z.string().trim().optional(),
  occurrences: z.string().trim().optional(),
  studentsNeedingAttention: z.string().trim().optional(),
  observation: z.string().trim().optional(),
});
export type SubmitClassReportInput = z.infer<typeof submitClassReportSchema>;
