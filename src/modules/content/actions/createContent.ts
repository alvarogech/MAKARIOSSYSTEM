"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createContentSchema } from "../schemas";

export interface CreateContentState {
  error?: string;
  success?: boolean;
}

/**
 * Cria o conteúdo e, conforme o tipo, a linha de detalhe associada
 * (video_contents/content_files) em passos sequenciais — não é uma única
 * transação atômica (diferente de `create_class_with_meetings` na Fase
 * 2). Simplificação desta fase: se o segundo passo falhar, o conteúdo já
 * existe como rascunho e pode ser corrigido reeditando — declarado em
 * FASE_3_RELATORIO.md.
 */
export async function createContent(
  _prevState: CreateContentState,
  formData: FormData,
): Promise<CreateContentState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "content", action: "manage" })) {
    return { error: "Você não tem permissão para gerenciar conteúdo." };
  }

  const parsed = createContentSchema.safeParse({
    lessonId: formData.get("lessonId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    type: formData.get("type"),
    classification: formData.get("classification"),
    estimatedMinutes: formData.get("estimatedMinutes") || undefined,
    orderIndex: formData.get("orderIndex"),
    allowDownload: formData.get("allowDownload") === "on",
    youtubeVideoId: formData.get("youtubeVideoId") || undefined,
    minPercent: formData.get("minPercent") || undefined,
    fileName: formData.get("fileName") || undefined,
    fileUrl: formData.get("fileUrl") || undefined,
    linkUrl: formData.get("linkUrl") || undefined,
    textBody: formData.get("textBody") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, module_id")
    .eq("id", parsed.data.lessonId)
    .single();

  if (!lesson) {
    return { error: "Aula não encontrada." };
  }

  const { data: moduleRow } = await supabase
    .from("modules")
    .select("volume_id")
    .eq("id", lesson.module_id)
    .single();

  if (!moduleRow) {
    return { error: "Módulo da aula não encontrado." };
  }

  const { data: content, error: contentError } = await supabase
    .from("contents")
    .insert({
      lesson_id: parsed.data.lessonId,
      volume_id: moduleRow.volume_id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      classification: parsed.data.classification,
      estimated_minutes: parsed.data.estimatedMinutes ?? null,
      order_index: parsed.data.orderIndex,
      allow_download: parsed.data.allowDownload ?? false,
      body: parsed.data.type === "link" ? parsed.data.linkUrl : parsed.data.type === "text" ? parsed.data.textBody : null,
    })
    .select("id")
    .single();

  if (contentError || !content) {
    return {
      error: contentError?.code === "23505"
        ? "Já existe um conteúdo com essa posição nesta aula."
        : "Não foi possível criar o conteúdo.",
    };
  }

  if (parsed.data.type === "video" && parsed.data.youtubeVideoId) {
    const { error: videoError } = await supabase.from("video_contents").insert({
      content_id: content.id,
      youtube_video_id: parsed.data.youtubeVideoId,
      min_percent: parsed.data.minPercent ?? 80,
    });
    if (videoError) {
      return {
        error: "Conteúdo criado, mas os dados do vídeo não puderam ser salvos. Edite o conteúdo para corrigir.",
      };
    }
  }

  if (parsed.data.type === "file" && parsed.data.fileUrl && parsed.data.fileName) {
    const { error: fileError } = await supabase.from("content_files").insert({
      content_id: content.id,
      file_name: parsed.data.fileName,
      file_url: parsed.data.fileUrl,
    });
    if (fileError) {
      return {
        error: "Conteúdo criado, mas o arquivo não pôde ser vinculado. Edite o conteúdo para corrigir.",
      };
    }
  }

  revalidatePath("/conteudo");
  return { success: true };
}
