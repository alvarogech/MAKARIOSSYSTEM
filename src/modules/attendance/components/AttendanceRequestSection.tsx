"use client";

import { useActionState, useState } from "react";
import { cancelAttendanceRequest, submitAttendanceRequest, type RequestState } from "../actions/requests";
import type { OwnRequest, RequestableMeeting } from "../requests";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const STATUS = {
  pending: { label: "Aguardando análise", className: "bg-amber-50 text-amber-700" },
  approved: { label: "Aprovado — a presença já conta", className: "bg-green-50 text-green-700" },
  rejected: { label: "Não aprovado", className: "bg-red-50 text-red-700" },
} as const;

const dateLabel = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${key}T12:00:00-03:00`));

function RequestForm({ meeting, onDone }: { meeting: RequestableMeeting; onDone: () => void }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(submitAttendanceRequest, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-3 border-t border-neutral-100 pt-3">
      <input type="hidden" name="meetingId" value={meeting.meetingId} />
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-neutral-800">Em quais aulas você esteve?</legend>
        {meeting.missing.map((lesson) => (
          <label key={lesson.number} className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm">
            <input type="checkbox" name="lessons" value={lesson.number} defaultChecked className="mt-0.5 size-5 shrink-0 accent-brand-blue" />
            <span>
              <span className="font-medium text-neutral-900">
                Aula {lesson.number} · {lesson.start} às {lesson.end}
              </span>
              {lesson.subject ? <span className="block text-neutral-600">{lesson.subject}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor={`just-${meeting.meetingId}`} className="mb-1 block text-sm font-medium text-neutral-800">
          Justificativa
        </label>
        <textarea
          id={`just-${meeting.meetingId}`}
          name="justification"
          rows={3}
          required
          minLength={10}
          maxLength={1000}
          placeholder="Conte o que aconteceu — por exemplo: estive na aula, mas o QR Code não funcionou no meu celular."
          className="w-full rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        <p className="mt-1 text-xs text-neutral-500">A coordenação analisa cada pedido. Só conta para a frequência depois de aprovado.</p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" isLoading={pending}>
          Enviar pedido
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Fechar
        </Button>
      </div>
    </form>
  );
}

function CancelButton({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(cancelAttendanceRequest, {});
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <Button type="submit" size="sm" variant="ghost" isLoading={pending}>
        Cancelar pedido
      </Button>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}

/** Seção "Solicitar presença" da página Minha frequência. */
export function AttendanceRequestSection({ requestable, own }: { requestable: RequestableMeeting[]; own: OwnRequest[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (requestable.length === 0 && own.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="solicitar-presenca">
      <div>
        <h2 id="solicitar-presenca" className="text-base font-semibold text-neutral-900">
          Solicitar presença
        </h2>
        <p className="text-sm text-neutral-500">
          Esteve numa aula e ela não consta como presença? Faça o pedido e explique o motivo. O administrador aprova ou não — e você vê a resposta aqui.
        </p>
      </div>

      {own.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {own.map((request) => (
            <li key={request.id}>
              <Card className="flex flex-col gap-1 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-neutral-900">
                    {request.label} · aulas {request.lessons.join(", ")}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[request.status].className}`}>{STATUS[request.status].label}</span>
                </div>
                <p className="text-neutral-600">“{request.justification}”</p>
                {request.decisionNote ? <p className="text-neutral-700">Resposta da coordenação: {request.decisionNote}</p> : null}
                {request.status === "pending" ? <CancelButton requestId={request.id} /> : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {requestable.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {requestable.map((meeting) => (
            <li key={meeting.meetingId}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-neutral-800">
                    <span className="font-medium">
                      {meeting.volumeName} · encontro {meeting.sequence}
                    </span>{" "}
                    · {dateLabel(meeting.date)} · {meeting.missing.length} aula(s) sem presença
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setOpenId(openId === meeting.meetingId ? null : meeting.meetingId)}
                    aria-expanded={openId === meeting.meetingId}
                  >
                    Solicitar presença
                  </Button>
                </div>
                {openId === meeting.meetingId ? <RequestForm meeting={meeting} onDone={() => setOpenId(null)} /> : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
