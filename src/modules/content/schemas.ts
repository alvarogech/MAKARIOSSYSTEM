import { z } from "zod";

export const createModuleSchema = z.object({
  volumeId: z.string().uuid("Selecione um volume."),
  name: z.string().trim().min(1, "Informe o nome do módulo."),
  orderIndex: z.coerce.number().int().positive(),
});
export type CreateModuleInput = z.infer<typeof createModuleSchema>;

export const createLessonSchema = z.object({
  moduleId: z.string().uuid("Selecione um módulo."),
  name: z.string().trim().min(1, "Informe o nome da aula."),
  objectives: z.string().trim().optional(),
  orderIndex: z.coerce.number().int().positive(),
});
export type CreateLessonInput = z.infer<typeof createLessonSchema>;

const contentTypeEnum = z.enum(["video", "file", "text", "link"]);
const contentClassificationEnum = z.enum([
  "obrigatorio",
  "complementar",
  "preparatorio",
  "aprofundamento",
  "revisao",
  "exclusivo_professor",
  "exclusivo_coordenacao",
  "exclusivo_administracao",
]);

export const createContentSchema = z
  .object({
    lessonId: z.string().uuid("Selecione uma aula."),
    title: z.string().trim().min(1, "Informe o título."),
    description: z.string().trim().optional(),
    type: contentTypeEnum,
    classification: contentClassificationEnum,
    estimatedMinutes: z.coerce.number().int().positive().optional(),
    orderIndex: z.coerce.number().int().positive(),
    allowDownload: z.coerce.boolean().optional(),
    youtubeVideoId: z.string().trim().optional(),
    minPercent: z.coerce.number().int().min(1).max(100).optional(),
    fileName: z.string().trim().optional(),
    fileUrl: z.string().trim().url("URL do arquivo inválida.").optional().or(z.literal("")),
    linkUrl: z.string().trim().url("URL inválida.").optional().or(z.literal("")),
    textBody: z.string().trim().optional(),
  })
  .refine((data) => data.type !== "video" || Boolean(data.youtubeVideoId), {
    message: "Informe o ID do vídeo do YouTube.",
    path: ["youtubeVideoId"],
  })
  .refine((data) => data.type !== "file" || (Boolean(data.fileName) && Boolean(data.fileUrl)), {
    message: "Informe nome e URL do arquivo.",
    path: ["fileUrl"],
  })
  .refine((data) => data.type !== "link" || Boolean(data.linkUrl), {
    message: "Informe a URL do link.",
    path: ["linkUrl"],
  });
export type CreateContentInput = z.infer<typeof createContentSchema>;

export const publishContentSchema = z.object({
  contentId: z.string().uuid(),
  status: z.enum(["draft", "published", "archived"]),
});
export type PublishContentInput = z.infer<typeof publishContentSchema>;

const releaseRuleTypeEnum = z.enum([
  "immediate",
  "date",
  "manual",
  "after_content",
  "after_activity",
  "after_meeting",
]);

export const createReleaseRuleSchema = z
  .object({
    contentId: z.string().uuid("Selecione um conteúdo."),
    type: releaseRuleTypeEnum,
    releaseAt: z.string().trim().optional(),
    requiredContentId: z.string().uuid().optional().or(z.literal("")),
    requiredActivityId: z.string().uuid().optional().or(z.literal("")),
    requiredMeetingId: z.string().uuid().optional().or(z.literal("")),
  })
  .refine((data) => data.type !== "date" || Boolean(data.releaseAt), {
    message: "Informe a data/hora de liberação.",
    path: ["releaseAt"],
  })
  .refine((data) => data.type !== "after_content" || Boolean(data.requiredContentId), {
    message: "Selecione o conteúdo pré-requisito.",
    path: ["requiredContentId"],
  })
  .refine((data) => data.type !== "after_activity" || Boolean(data.requiredActivityId), {
    message: "Selecione o exercício pré-requisito.",
    path: ["requiredActivityId"],
  });
export type CreateReleaseRuleInput = z.infer<typeof createReleaseRuleSchema>;

const questionTypeEnum = z.enum(["multiple_choice", "true_false"]);
// "single" = uma resposta correta (rádio); "multiple" = marque todas as
// corretas (checkbox) — ver supabase/migrations/
// 00000000000029_question_selection_mode.sql.
const selectionModeEnum = z.enum(["single", "multiple"]);

export const createQuestionSchema = z.object({
  volumeId: z.string().uuid().optional().or(z.literal("")),
  lessonId: z.string().uuid().optional().or(z.literal("")),
  type: questionTypeEnum,
  selectionMode: selectionModeEnum.default("single"),
  prompt: z.string().trim().min(1, "Informe o enunciado."),
  explanation: z.string().trim().optional(),
  bibleReference: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  difficulty: z.enum(["facil", "medio", "dificil"]).default("medio"),
  // Multipla escolha: até 4 alternativas de texto livre (rótulos vazios são ignorados).
  optionLabel1: z.string().trim().optional(),
  optionLabel2: z.string().trim().optional(),
  optionLabel3: z.string().trim().optional(),
  optionLabel4: z.string().trim().optional(),
  // selectionMode = "single": um índice (rádio). "multiple": vários (checkbox).
  correctOptionIndex: z.coerce.number().int().min(1).max(4).optional(),
  correctOptionIndices: z.array(z.coerce.number().int().min(1).max(4)).optional(),
  // Verdadeiro ou falso: qual das duas é a correta.
  trueFalseCorrect: z.enum(["true", "false"]).optional(),
});
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const createActivitySchema = z.object({
  lessonId: z.string().uuid("Selecione uma aula."),
  title: z.string().trim().min(1, "Informe o título."),
  instructions: z.string().trim().optional(),
  maxAttempts: z.coerce.number().int().positive().optional(),
  blocksProgress: z.coerce.boolean().optional(),
  showFeedbackAfterSubmit: z.coerce.boolean().optional(),
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const attachQuestionSchema = z.object({
  activityId: z.string().uuid(),
  questionId: z.string().uuid(),
  orderIndex: z.coerce.number().int().positive(),
});
export type AttachQuestionInput = z.infer<typeof attachQuestionSchema>;
