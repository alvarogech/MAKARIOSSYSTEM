"use client";

import { useActionState, useState } from "react";
import { createContent, type CreateContentState } from "../actions/createContent";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateContentState = {};

const CLASSIFICATION_LABELS: Record<string, string> = {
  obrigatorio: "Obrigatório",
  complementar: "Complementar",
  preparatorio: "Preparatório",
  aprofundamento: "Aprofundamento",
  revisao: "Revisão",
  exclusivo_professor: "Exclusivo de professor",
  exclusivo_coordenacao: "Exclusivo de coordenação",
  exclusivo_administracao: "Exclusivo de administração",
};

export function CreateContentForm({
  lessons,
}: {
  lessons: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createContent, initialState);
  const [type, setType] = useState("video");

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Conteúdo criado como rascunho — publique quando revisar.</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="content-lessonId">Aula</Label>
          <select
            id="content-lessonId"
            name="lessonId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="content-title">Título</Label>
          <Input id="content-title" name="title" required />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="content-type">Tipo</Label>
          <select
            id="content-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="video">Vídeo (YouTube)</option>
            <option value="file">Arquivo</option>
            <option value="text">Texto</option>
            <option value="link">Link</option>
          </select>
        </div>
        <div>
          <Label htmlFor="content-classification">Classificação</Label>
          <select
            id="content-classification"
            name="classification"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {Object.entries(CLASSIFICATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="content-orderIndex">Posição</Label>
          <Input id="content-orderIndex" name="orderIndex" type="number" min={1} required />
        </div>
        <div>
          <Label htmlFor="content-estimatedMinutes">Duração (min)</Label>
          <Input id="content-estimatedMinutes" name="estimatedMinutes" type="number" min={1} />
        </div>
      </div>

      {type === "video" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="content-youtubeVideoId">ID do vídeo no YouTube (não listado)</Label>
            <Input id="content-youtubeVideoId" name="youtubeVideoId" />
          </div>
          <div>
            <Label htmlFor="content-minPercent">% mínimo para concluir</Label>
            <Input id="content-minPercent" name="minPercent" type="number" min={1} max={100} defaultValue={80} />
          </div>
        </div>
      ) : null}

      {type === "file" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="content-fileName">Nome do arquivo</Label>
            <Input id="content-fileName" name="fileName" />
          </div>
          <div>
            <Label htmlFor="content-fileUrl">URL do arquivo</Label>
            <Input id="content-fileUrl" name="fileUrl" placeholder="https://..." />
            <p className="mt-1 text-xs text-neutral-500">
              Sem upload nesta fase — cole o link de um arquivo já hospedado.
            </p>
          </div>
        </div>
      ) : null}

      {type === "link" ? (
        <div>
          <Label htmlFor="content-linkUrl">URL</Label>
          <Input id="content-linkUrl" name="linkUrl" placeholder="https://..." />
        </div>
      ) : null}

      {type === "text" ? (
        <div>
          <Label htmlFor="content-textBody">Texto</Label>
          <textarea
            id="content-textBody"
            name="textBody"
            rows={4}
            className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" name="allowDownload" className="size-4 rounded border-neutral-300" />
        Permitir download
      </label>

      <Button type="submit" isLoading={isPending} className="self-start">
        Criar conteúdo
      </Button>
    </form>
  );
}
