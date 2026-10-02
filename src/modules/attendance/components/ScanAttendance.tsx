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
          Encontro {result.sequence}, {result.block === 1 ? "antes do intervalo" : "depois do intervalo"}, às {result.time}
        </p>
        <p className="text-sm text-neutral-500">
          {result.lessonsCredited === result.lessonsTotal
            ? `Valeram as ${result.lessonsTotal} aulas deste bloco.`
            : result.lessonsCredited === 0
              ? "Você chegou depois da tolerância das aulas deste bloco, então nenhuma aula foi contada."
              : `Valeu ${result.lessonsCredited} de ${result.lessonsTotal} aulas deste bloco, por causa do horário de chegada.`}
        </p>
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
