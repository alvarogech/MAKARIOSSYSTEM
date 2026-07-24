import { z } from "zod";

export const createAssessmentSchema = z.object({
  seasonVolumeOfferingId: z.string().uuid("Selecione uma oferta de volume."),
  type: z.enum(["final", "recovery"]),
  linkedAssessmentId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1, "Informe o título."),
  questionsCount: z.coerce.number().int().positive().default(20),
  durationMinutes: z.coerce.number().int().positive().default(60),
  opensAt: z.string().trim().optional(),
  windowDays: z.coerce.number().int().positive().default(14),
  passingGrade: z.coerce.number().min(0).max(10).default(6),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const addQuestionToAssessmentSchema = z.object({
  assessmentId: z.string().uuid(),
  questionId: z.string().uuid(),
  points: z.coerce.number().positive(),
  orderIndex: z.coerce.number().int().positive(),
});
export type AddQuestionToAssessmentInput = z.infer<
  typeof addQuestionToAssessmentSchema
>;

export const addRecoveryPathItemSchema = z
  .object({
    assessmentId: z.string().uuid(),
    contentId: z.string().uuid().optional().or(z.literal("")),
    activityId: z.string().uuid().optional().or(z.literal("")),
    orderIndex: z.coerce.number().int().positive(),
  })
  .refine((data) => Boolean(data.contentId) !== Boolean(data.activityId), {
    message: "Escolha um conteúdo OU um exercício, não os dois.",
    path: ["contentId"],
  });
export type AddRecoveryPathItemInput = z.infer<typeof addRecoveryPathItemSchema>;

export const publishAssessmentSchema = z.object({
  assessmentId: z.string().uuid(),
});
export type PublishAssessmentInput = z.infer<typeof publishAssessmentSchema>;

export const grantExceptionalAttemptSchema = z.object({
  assessmentId: z.string().uuid(),
  studentEmail: z.string().trim().email("E-mail inválido."),
  justification: z.string().trim().min(10, "Descreva a justificativa (mínimo 10 caracteres)."),
});
export type GrantExceptionalAttemptInput = z.infer<
  typeof grantExceptionalAttemptSchema
>;

export const submitAssessmentAnswerSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedOptionIds: z.array(z.string().uuid()),
});
export type SubmitAssessmentAnswerInput = z.infer<
  typeof submitAssessmentAnswerSchema
>;
