import { buttonVariants } from "@/components/ui/Button";
import type { MaterialItem, MaterialsBundle } from "../loadMaterials";

const TYPE_LABELS_PT: Record<string, string> = {
  file: "Arquivo",
  link: "Apresentação",
  video: "Vídeo",
  text: "Texto",
};

function MaterialRow({ material, showModuleName }: { material: MaterialItem; showModuleName: boolean }) {
  const actions =
    material.type === "file" && material.files.length > 0
      ? material.files.map((file) => ({
          label: file.file_name.endsWith("(PPTX)") ? "Baixar PPTX" : file.file_name.endsWith("(PDF)") ? "Abrir PDF" : "Baixar",
          href: file.file_url,
        }))
      : material.type === "link" && material.body
        ? [{ label: "Abrir no Drive", href: material.body }]
        : [];

  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-neutral-700">
        {material.title}
        <span className="ml-1.5 text-xs text-neutral-400">
          ({TYPE_LABELS_PT[material.type] ?? material.type})
        </span>
        {showModuleName && material.moduleName ? (
          <span className="text-neutral-400"> · {material.moduleName}</span>
        ) : null}
      </span>
      {actions.length > 0 ? (
        <div className="flex shrink-0 gap-2">
          {actions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              {action.label}
            </a>
          ))}
        </div>
      ) : (
        <span className="shrink-0 text-xs text-neutral-400">Sem ação disponível</span>
      )}
    </li>
  );
}

/**
 * Seção "Apostilas"/"Slides" reutilizada na página da turma (biblioteca
 * completa do volume) e na página de preparar aula (recorte de um módulo).
 * Nunca expõe o enum bruto de `type` — sempre o rótulo em português.
 */
export function MaterialsSection({
  materials,
  showModuleName,
  emptyApostilasLabel = "Nenhuma apostila publicada ainda.",
  emptySlidesLabel = "Os slides desta aula ainda não foram disponibilizados.",
}: {
  materials: MaterialsBundle;
  showModuleName: boolean;
  emptyApostilasLabel?: string;
  emptySlidesLabel?: string;
}) {
  return (
    <>
      <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-neutral-400">Apostilas</h3>
      <ul className="mt-2 divide-y divide-neutral-100">
        {materials.apostilas.map((material) => (
          <MaterialRow key={material.id} material={material} showModuleName={showModuleName} />
        ))}
        {materials.apostilas.length === 0 ? <li className="py-1.5 text-sm text-neutral-400">{emptyApostilasLabel}</li> : null}
      </ul>

      <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-neutral-400">Slides</h3>
      <p className="mt-1 text-xs text-neutral-400">Uso exclusivo do professor — nunca aparece na área do aluno.</p>
      <ul className="mt-2 divide-y divide-neutral-100">
        {materials.slides.map((material) => (
          <MaterialRow key={material.id} material={material} showModuleName={showModuleName} />
        ))}
        {materials.slides.length === 0 ? <li className="py-1.5 text-sm text-neutral-400">{emptySlidesLabel}</li> : null}
      </ul>
    </>
  );
}
