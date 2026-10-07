import Link from "next/link";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SITUATION } from "@/modules/attendance/situation";
import type { TodayData } from "../today";

const dayLabel = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(
    new Date(`${key}T12:00:00-03:00`),
  );

function Block({ title, href, hrefLabel, children }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-neutral-900">{title}</h2>
        {href ? (
          <Link href={href} className="text-sm font-medium text-brand-blue hover:underline">
            {hrefLabel ?? "Ver"} →
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

/** Home da coordenação: só o que pede ação ou atenção. */
export function TodayPanel({ data }: { data: TodayData }) {
  const { alerts } = data;
  const nothingUrgent =
    data.anomalies.length === 0 &&
    alerts.withoutTeacher.length === 0 &&
    alerts.reportsMissing === 0 &&
    data.pendingRequests === 0 &&
    data.approvedWithoutAccount === 0 &&
    data.atRisk.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {data.anomalies.length > 0 ? (
        <Card className="border-danger/30 bg-danger/5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-danger">Possíveis falhas na chamada</h2>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-neutral-800">
                {data.anomalies.map((a, i) => (
                  <li key={i}>{a.text}</li>
                ))}
              </ul>
              <Link href="/coordenacao/presenca" className="mt-1 inline-block text-sm font-medium text-brand-blue hover:underline">
                Abrir a visão geral da presença →
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      {nothingUrgent ? (
        <Card className="border-success/30 bg-success/5 text-sm text-success">Tudo em dia por aqui. Nada pede ação agora.</Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Próximos 7 dias" href="/coordenacao/turmas" hrefLabel="Turmas">
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum encontro nos próximos 7 dias.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
              {data.upcoming.map((m) => (
                <li key={m.meetingId} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <span className="min-w-0 text-neutral-800">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CalendarDays className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                      {dayLabel(m.date)} · {m.start} às {m.end}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {m.className} · encontro {m.sequence}
                      {m.subjects.length > 0 ? ` · ${m.subjects.join(", ")}` : ""}
                    </span>
                  </span>
                  {m.teachers.length > 0 ? (
                    <span className="text-xs text-neutral-600">{m.teachers.join(", ")}</span>
                  ) : (
                    <Link href={`/coordenacao/turmas/${m.classId}/escala`} className="text-xs font-medium text-danger hover:underline">
                      Sem professor — atribuir
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Presença do último encontro" href="/coordenacao/presenca" hrefLabel="Visão geral">
          {data.lastMeetingByClass.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum encontro realizado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {data.lastMeetingByClass.map((entry) => (
                <li key={entry.label} className="flex items-center gap-2">
                  <span className="w-44 shrink-0 text-neutral-700">
                    {entry.label} <span className="text-neutral-400">· E{entry.sequence}</span>
                  </span>
                  <span className="h-3 flex-1 rounded bg-neutral-100">
                    <span className="block h-3 rounded bg-brand-blue" style={{ width: `${entry.pct ?? 0}%` }} />
                  </span>
                  <span className="w-10 shrink-0 text-right font-medium text-neutral-800">{entry.pct === null ? "—" : `${Math.round(entry.pct)}%`}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Alunos em risco" href="/coordenacao/alunos" hrefLabel="Todos os alunos">
          <p className="text-sm text-neutral-600">
            {data.bands.emDia} em dia · {data.bands.atencao} no limite · <span className="font-medium text-danger">{data.bands.critico} abaixo dos 75%</span>
          </p>
          {data.atRisk.length === 0 ? (
            <p className="text-sm text-neutral-400">Ninguém em risco por enquanto.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
              {data.atRisk.map(({ person, classLabel }) => (
                <li key={`${classLabel}-${person.key}`} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 text-neutral-800">
                    {person.name} <span className="text-xs text-neutral-500">· {classLabel}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${SITUATION[person.progress.situation].className}`}>
                    {SITUATION[person.progress.situation].label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Para resolver">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href="/coordenacao/inscricoes?status=pending" className="font-medium text-brand-blue hover:underline">
                {data.pendingRequests} inscrição(ões) pendente(s) de decisão →
              </Link>
            </li>
            <li>
              <Link href="/coordenacao/acessos?f=sem_conta" className="font-medium text-brand-blue hover:underline">
                {data.approvedWithoutAccount} aprovado(s) que ainda não criaram a conta →
              </Link>
            </li>
            {alerts.withoutTeacher.length > 0 ? (
              <li>
                <span className="font-medium">{alerts.withoutTeacher.length} aula(s) sem professor</span>
                <ul className="mt-0.5 text-neutral-600">
                  {alerts.withoutTeacher.slice(0, 4).map((m) => (
                    <li key={m.meetingId}>
                      <Link href={`/coordenacao/turmas/${m.classId}/escala`} className="text-brand-blue hover:underline">
                        {m.className} · encontro {m.sequence} · {m.date.split("-").reverse().slice(0, 2).join("/")}
                      </Link>
                      {m.past ? <span className="ml-1 font-medium text-danger">(já passou)</span> : null}
                    </li>
                  ))}
                </ul>
              </li>
            ) : null}
            {alerts.reportsMissing > 0 ? (
              <li>
                <Link href="/coordenacao/relatorios" className="font-medium text-brand-blue hover:underline">
                  {alerts.reportsMissing} encontro(s) realizados sem relatório pós-aula →
                </Link>
              </li>
            ) : null}
            {alerts.dataIssues > 0 ? (
              <li>
                <Link href="/coordenacao/qualidade-dados" className="font-medium text-brand-blue hover:underline">
                  {alerts.dataIssues} item(ns) de dados para revisar →
                </Link>
              </li>
            ) : null}
          </ul>
        </Block>
      </div>
    </div>
  );
}
