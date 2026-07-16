"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createQuestionSchema } from "../schemas";

export interface CreateQuestionState {
  error?: string;
  success?: boolean;
}

/**
 * Cria uma questão do banco (múltipla escolha ou verdadeiro/falso — os
 * únicos dois tipos com editor nesta fase; associação/ordenação/
 * preenchimento ficam modelados no banco, mas sem tela de autoria ainda
 * — ver FASE_3_RELATORIO.md). Nunca discursiva (doc 02 §5.7).
 */
export async function createQuestion(
  _prevState: CreateQuestionState,
  formData: FormData,
): Promise<CreateQuestionState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "question_bank", action: "manage" })) {
    return { error: "Você não tem permissão para gerenciar o banco de questões." };
  }

  const parsed = createQuestionSchema.safeParse({
    volumeId: formData.get("volumeId") || undefined,
    lessonId: formData.get("lessonId") || undefined,
    type: formData.get("type"),
    prompt: formData.get("prompt"),
    explanation: formData.get("explanation") || undefined,
    bibleReference: formData.get("bibleReference") || undefined,
    topic: formData.get("topic") || undefined,
    difficulty: formData.get("difficulty") || "medio",
    optionLabel1: formData.get("optionLabel1") || undefined,
    optionLabel2: formData.get("optionLabel2") || undefined,
    optionLabel3: formData.get("optionLabel3") || undefined,
    optionLabel4: formData.get("optionLabel4") || undefined,
    correctOptionIndex: formData.get("correctOptionIndex") || undefined,
    trueFalseCorrect: formData.get("trueFalseCorrect") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const options: { label: string; isCorrect: boolean; orderIndex: number }[] = [];

  if (parsed.data.type === "multiple_choice") {
    const labels = [
      parsed.data.optionLabel1,
      parsed.data.optionLabel2,
      parsed.data.optionLabel3,
      parsed.data.optionLabel4,
    ];
    const filled = labels.filter((l): l is string => Boolean(l));
    if (filled.length < 2) {
      return { error: "Informe pelo menos duas alternativas." };
    }
    if (!parsed.data.correctOptionIndex || !labels[parsed.data.correctOptionIndex - 1]) {
      return { error: "Selecione qual alternativa é a correta." };
    }
    labels.forEach((label, index) => {
      if (label) {
        options.push({
          label,
          isCorrect: index + 1 === parsed.data.correctOptionIndex,
          orderIndex: index + 1,
        });
      }
    });
  } else if (parsed.data.type === "true_false") {
    if (!parsed.data.trueFalseCorrect) {
      return { error: "Selecione se a afirmação é verdadeira ou falsa." };
    }
    options.push(
      { label: "Verdadeiro", isCorrect: parsed.data.trueFalseCorrect === "true", orderIndex: 1 },
      { label: "Falso", isCorrect: parsed.data.trueFalseCorrect === "false", orderIndex: 2 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: question, error: questionError } = await supabase
    .from("question_bank")
    .insert({
      volume_id: parsed.data.volumeId || null,
      lesson_id: parsed.data.lessonId || null,
      type: parsed.data.type,
      prompt: parsed.data.prompt,
      explanation: parsed.data.explanation ?? null,
      bible_reference: parsed.data.bibleReference ?? null,
      topic: parsed.data.topic ?? null,
      difficulty: parsed.data.difficulty,
      author_id: authContext.userId,
      status: "published",
    })
    .select("id")
    .single();

  if (questionError || !question) {
    return { error: "Não foi possível criar a questão." };
  }

  const { error: optionsError } = await supabase.from("question_options").insert(
    options.map((option) => ({
      question_id: question.id,
      label: option.label,
      is_correct: option.isCorrect,
      order_index: option.orderIndex,
    })),
  );

  if (optionsError) {
    return {
      error: "Questão criada, mas as alternativas não puderam ser salvas. Revise no banco de questões.",
    };
  }

  revalidatePath("/conteudo/questoes");
  return { success: true };
}
