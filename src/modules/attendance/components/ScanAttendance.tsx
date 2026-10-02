"use client";

import { useCallback, useEffect, useState } from "react";
import { registerScan, type ScanResult } from "../actions/registerScan";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";

type Position = { lat: number; lng: number; accuracy: number } | null;

function readPosition(): Promise<Position> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    // O `timeout` do navegador só começa a contar depois que a pessoa
    // responde à pergunta de permissão; sem este limite, a tela ficaria
    // presa em "Registrando..." enquanto a pergunta estiver aberta.
    const fallback = setTimeout(() => resolve(null), 20000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(fallback);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
      },
      () => {
        clearTimeout(fallback);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

export function ScanAttendance({ token }: { token: string }) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [cpf, setCpf] = useState("");

  const perform = useCallback(
    async (cpfValue?: string) => {
      const position = await readPosition();
      return registerScan({
        token,
        cpf: cpfValue,
        lat: position?.lat,
        lng: position?.lng,
        accuracy: position?.accuracy,
      });
    },
    [token],
  );

  const apply = (response: ScanResult) => {
    setResult(response);
    setLoading(false);
  };

  useEffect(() => {
    let alive = true;
    void perform().then((response) => {
      if (alive) apply(response);
    });
    return () => {
      alive = false;
    };
  }, [perform]);

  const submit = (cpfValue?: string) => {
    setLoading(true);
    void perform(cpfValue).then(apply);
  };

  if (loading) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Spinner />
        <p className="text-sm text-neutral-500">Registrando a sua presença...</p>
      </Card>
    );
  }

  if (result?.ok) {
    return (
      <Card className="flex flex-col gap-3 py-8 text-center">
        <p className="text-4xl" aria-hidden>
          ✅
        </p>
        <h1 className="text-xl font-semibold text-neutral-900">
          {result.alreadyRegistered ? "Presença já registrada" : "Presença registrada"}
        </h1>
        <p className="text-neutral-700">
          {result.firstName}, {result.volumeName}
          <br />
          Dia {result.date}, às {result.time} (horário de Brasília)
        </p>
        {result.alreadyRegistered ? (
          <p className="text-sm text-neutral-500">
            Você escaneou de novo às {result.scannedNowTime}. Vale o primeiro escaneamento deste bloco, às {result.time}.
          </p>
        ) : null}
        <div className="rounded-[var(--radius-sm)] bg-neutral-50 px-3 py-3 text-left text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">
            Encontro {result.sequence}, {result.block === 1 ? "antes do intervalo" : "depois do intervalo"}: {result.blockStart} às{" "}
            {result.blockEnd}
          </p>
          {result.subjects.length > 0 ? <p className="mt-1">Matéria: {result.subjects.join("; ")}</p> : null}
          <ul className="mt-2 flex flex-col gap-1">
            {result.lessons.map((lesson) => (
              <li key={lesson.number} className={lesson.counted ? "text-neutral-800" : "text-neutral-400 line-through"}>
                {lesson.counted ? "✓" : "✗"} Aula {lesson.number}: {lesson.start} às {lesson.end}
              </li>
            ))}
          </ul>
          {result.lessonNumbers.length === 0 ? (
            <p className="mt-2">Você chegou depois da tolerância de 15 minutos, então nenhuma aula deste bloco foi contada.</p>
          ) : result.lessonsCredited < result.lessonsTotal ? (
            <p className="mt-2">As aulas riscadas não contaram, por causa do horário de chegada (tolerância de 15 minutos).</p>
          ) : null}
          {result.placeLabel ? <p className="mt-2 text-neutral-500">Localização: {result.placeLabel}</p> : null}
        </div>
        {result.makeupForSequence ? (
          <p className="text-sm text-neutral-500">Contou como reposição do encontro {result.makeupForSequence} da sua turma.</p>
        ) : null}
        {result.block === 1 ? (
          <p className="text-sm font-medium text-neutral-700">Na volta do intervalo, escaneie de novo.</p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 py-6">
      <h1 className="text-lg font-semibold text-neutral-900">Marcar presença</h1>
      {result && result.code !== "precisa_cpf" ? <Alert variant="danger">{result.message}</Alert> : null}

      {result?.code === "precisa_localizacao" ? (
        <p className="text-sm text-neutral-600">
          No iPhone: Ajustes, Privacidade, Serviços de Localização, Safari, &quot;Ao Usar o App&quot;. No Android: toque no
          cadeado ao lado do endereço e permita a localização. Depois toque em Tentar de novo.
        </p>
      ) : null}

      {result?.code === "precisa_cpf" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit(cpf);
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
            Marcar presença
          </Button>
          <p className="text-xs text-neutral-400">Só na primeira vez. Depois este celular lembra de você.</p>
        </form>
      ) : (
        <Button type="button" className="w-full" onClick={() => submit()}>
          Tentar de novo
        </Button>
      )}
    </Card>
  );
}
