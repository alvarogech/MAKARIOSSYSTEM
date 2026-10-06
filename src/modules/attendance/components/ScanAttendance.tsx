"use client";

import { useCallback, useEffect, useState } from "react";
import { loadAttendanceDay, saveAttendanceDay, type DayResult } from "../actions/attendanceDay";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";

type Position = { lat: number; lng: number; accuracy: number } | null;

function tryPosition(highAccuracy: boolean, ms: number): Promise<Position> {
  return new Promise((resolve) => {
    // O `timeout` do navegador só começa a contar depois que a pessoa
    // responde à pergunta de permissão; sem este limite próprio, a tela
    // ficaria presa em "Carregando..." enquanto a pergunta estiver aberta.
    const fallback = setTimeout(() => resolve(null), ms + 10000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(fallback);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
      },
      () => {
        clearTimeout(fallback);
        resolve(null);
      },
      { enableHighAccuracy: highAccuracy, timeout: ms, maximumAge: 60000 },
    );
  });
}

/**
 * GPS de alta precisão dentro de prédio pode demorar; se falhar, tenta a
 * localização pela rede (Wi-Fi/antena), mais rápida e suficiente para um
 * raio de 200 m.
 */
async function readPosition(): Promise<Position> {
  if (!("geolocation" in navigator)) return null;
  return (await tryPosition(true, 8000)) ?? (await tryPosition(false, 8000));
}

type Day = Extract<DayResult, { ok: true }>;

export function ScanAttendance({ token }: { token: string }) {
  const [result, setResult] = useState<DayResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cpf, setCpf] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<number[] | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const locate = useCallback(async () => {
    const position = await readPosition();
    return { lat: position?.lat, lng: position?.lng, accuracy: position?.accuracy };
  }, []);

  const apply = (response: DayResult) => {
    setResult(response);
    setLoading(false);
    if (response.ok) {
      setSelected(new Set(response.lessons.filter((l) => l.selected).map((l) => l.number)));
      setSaved(null);
      setSaveError(null);
    }
  };

  const load = useCallback(
    async (cpfValue?: string) => {
      const where = await locate();
      return loadAttendanceDay({ token, cpf: cpfValue, ...where });
    },
    [token, locate],
  );

  useEffect(() => {
    let alive = true;
    void load().then((response) => {
      if (alive) apply(response);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const retry = (cpfValue?: string) => {
    setLoading(true);
    void load(cpfValue).then(apply);
  };

  const toggle = (n: number) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const save = async (day: Day) => {
    setSaving(true);
    setSaveError(null);
    const where = await locate();
    const response = await saveAttendanceDay({
      token,
      cpf: cpf || undefined,
      lessons: [...selected].sort((a, b) => a - b),
      ...where,
    });
    setSaving(false);
    if (response.ok) {
      setSaved(response.lessonNumbers);
      // Reflete na lista o que ficou gravado (para o "Alterar" começar dele).
      setResult({ ...day, hasRecord: response.lessonNumbers.length > 0, lessons: day.lessons.map((l) => ({ ...l, selected: response.lessonNumbers.includes(l.number) })) });
    } else {
      setSaveError(response.message);
    }
  };

  if (loading) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Spinner />
        <p className="text-sm text-neutral-500">Carregando as aulas de hoje...</p>
      </Card>
    );
  }

  if (result?.ok && saved) {
    const chosen = result.lessons.filter((l) => saved.includes(l.number));
    return (
      <Card className="flex flex-col gap-3 py-8 text-center">
        <p className="text-4xl" aria-hidden>
          ✅
        </p>
        <h1 className="text-xl font-semibold text-neutral-900">
          {saved.length > 0 ? "Presença registrada" : "Presença removida"}
        </h1>
        <p className="text-neutral-700">
          {result.firstName}, {result.volumeName} · encontro {result.sequence}
          <br />
          {result.dateLabel}
        </p>
        {chosen.length > 0 ? (
          <div className="rounded-[var(--radius-sm)] bg-neutral-50 px-3 py-3 text-left text-sm text-neutral-700">
            <p className="font-medium text-neutral-900">Aulas marcadas</p>
            <ul className="mt-2 flex flex-col gap-1">
              {chosen.map((l) => (
                <li key={l.number}>
                  ✓ Aula {l.number}: {l.start} às {l.end}
                  {l.subject ? ` — ${l.subject}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {result.makeupForSequence ? (
          <p className="text-sm text-neutral-500">Contou como reposição do encontro {result.makeupForSequence} da sua turma.</p>
        ) : null}
        <p className="text-sm text-neutral-500">
          Pronto: você só precisa fazer isso uma vez no dia. Se precisar corrigir, leia o QR de novo — dá para ajustar até o fim do dia.
        </p>
        <Button type="button" variant="secondary" className="w-full" onClick={() => setSaved(null)}>
          Alterar as aulas marcadas
        </Button>
      </Card>
    );
  }

  if (result?.ok) {
    const day = result;
    const blocks = [1, 2] as const;
    const allSelected = day.lessons.length > 0 && day.lessons.every((l) => selected.has(l.number));

    return (
      <Card className="flex flex-col gap-4 py-6">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            Olá, {day.firstName}! Marque as aulas de hoje
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {day.volumeName} · encontro {day.sequence} · {day.dateLabel}
            <br />
            Turma: {day.scheduleLabel}
          </p>
          {day.makeupForSequence ? (
            <p className="mt-1 text-sm text-neutral-500">
              Esta turma não é a sua: vai contar como reposição do encontro {day.makeupForSequence} da sua turma.
            </p>
          ) : null}
        </div>

        {blocks.map((block) => {
          const lessons = day.lessons.filter((l) => l.block === block);
          if (lessons.length === 0) return null;
          return (
            <fieldset key={block} className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {block === 1 ? "Antes do intervalo" : "Depois do intervalo"}
              </legend>
              {lessons.map((lesson) => (
                <label
                  key={lesson.number}
                  className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm hover:border-brand-blue"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-brand-blue"
                    checked={selected.has(lesson.number)}
                    onChange={() => toggle(lesson.number)}
                  />
                  <span>
                    <span className="font-medium text-neutral-900">
                      Aula {lesson.number} · {lesson.start} às {lesson.end}
                    </span>
                    {lesson.subject ? <span className="block text-neutral-600">{lesson.subject}</span> : null}
                  </span>
                </label>
              ))}
            </fieldset>
          );
        })}

        <button
          type="button"
          className="self-start text-sm font-medium text-brand-blue hover:underline"
          onClick={() => setSelected(allSelected ? new Set() : new Set(day.lessons.map((l) => l.number)))}
        >
          {allSelected ? "Desmarcar todas" : "Marcar todas as aulas"}
        </button>

        {saveError ? <Alert variant="danger">{saveError}</Alert> : null}
        {day.placeLabel ? <p className="text-xs text-neutral-400">Localização: {day.placeLabel}</p> : null}

        <Button type="button" className="w-full" isLoading={saving} onClick={() => void save(day)}>
          {selected.size > 0 ? `Confirmar presença (${selected.size} aula${selected.size > 1 ? "s" : ""})` : day.hasRecord ? "Remover minha presença de hoje" : "Confirmar presença"}
        </Button>
        {selected.size === 0 && !day.hasRecord ? (
          <p className="text-xs text-neutral-400">Marque pelo menos uma aula para registrar a presença.</p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 py-6">
      <h1 className="text-lg font-semibold text-neutral-900">Marcar presença</h1>
      {result && !result.ok && result.code !== "precisa_cpf" ? <Alert variant="danger">{result.message}</Alert> : null}

      {result && !result.ok && result.code === "precisa_localizacao" ? (
        <p className="text-sm text-neutral-600">
          No iPhone: Ajustes, Privacidade, Serviços de Localização, Safari, &quot;Ao Usar o App&quot;. No Android: toque no
          cadeado ao lado do endereço e permita a localização. Depois toque em Tentar de novo.
        </p>
      ) : null}

      {result && !result.ok && result.code === "precisa_cpf" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            retry(cpf);
          }}
        >
          <p className="text-sm text-neutral-600">{result.message}</p>
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(event) => setCpf(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Continuar
          </Button>
          <p className="text-xs text-neutral-400">Só na primeira vez. Depois este celular lembra de você.</p>
        </form>
      ) : (
        <Button type="button" className="w-full" onClick={() => retry()}>
          Tentar de novo
        </Button>
      )}
    </Card>
  );
}
