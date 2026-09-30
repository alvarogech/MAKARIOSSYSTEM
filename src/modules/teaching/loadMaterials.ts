import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface MaterialFile {
  file_name: string;
  file_url: string;
}

export interface MaterialItem {
  id: string;
  title: string;
  type: string;
  body: string | null;
  moduleName: string | null;
  files: MaterialFile[];
}

export interface MaterialsBundle {
  apostilas: MaterialItem[];
  slides: MaterialItem[];
}

/**
 * Materiais publicados de um volume — opcionalmente restritos a um módulo
 * (a "aula" específica). RLS de `contents` já garante que só professor/
 * coordenação/admin veem `classification = exclusivo_professor`; aqui só
 * separamos por classification para a UI (Apostilas vs. Slides).
 */
export async function loadMaterials(
  supabase: SupabaseClient<Database>,
  params: { volumeId: string; moduleId?: string },
): Promise<MaterialsBundle> {
  let query = supabase
    .from("contents")
    .select("id, title, type, classification, body, order_index, lesson:lessons(name, module:modules(id, name, order_index))")
    .eq("volume_id", params.volumeId)
    .order("order_index");

  const { data: contentsData } = await query;

  const filtered = params.moduleId
    ? (contentsData ?? []).filter((c) => c.lesson?.module?.id === params.moduleId)
    : (contentsData ?? []);

  const contentIds = filtered.map((c) => c.id);
  const { data: contentFiles } = contentIds.length
    ? await supabase.from("content_files").select("content_id, file_name, file_url").in("content_id", contentIds)
    : { data: [] };

  const filesByContentId = new Map<string, MaterialFile[]>();
  for (const file of contentFiles ?? []) {
    const list = filesByContentId.get(file.content_id) ?? [];
    list.push(file);
    filesByContentId.set(file.content_id, list);
  }

  const materials: (MaterialItem & { moduleOrder: number; orderIndex: number })[] = filtered.map((content) => ({
    id: content.id,
    title: content.title,
    type: content.type,
    body: content.body,
    moduleName: content.lesson?.module?.name ?? null,
    files: filesByContentId.get(content.id) ?? [],
    moduleOrder: content.lesson?.module?.order_index ?? 0,
    orderIndex: content.order_index,
  }));

  materials.sort((a, b) => a.moduleOrder - b.moduleOrder || a.orderIndex - b.orderIndex);

  const classificationById = new Map(filtered.map((c) => [c.id, c.classification]));

  return {
    apostilas: materials.filter((m) => classificationById.get(m.id) !== "exclusivo_professor"),
    slides: materials.filter((m) => classificationById.get(m.id) === "exclusivo_professor"),
  };
}
