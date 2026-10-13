import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SITUATION } from "@/modules/attendance/situation";
import { groupMeetingsByDate, pluralize, shortPersonName } from "../nextClassDay";
import type { TodayData } from "../today";

const dayLabel = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(
    new Date(`${key}T12:00:00-03:00`),
  );

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue";
const actionLink = `font-medium text-brand-blue hover:underline ${focusRing}`;

function Block({ id, title, href, hrefLabel, children }: { id: string; title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <Card role="region" aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="font-semibold text-neutral-900">
          {title}
        </h2>
        {href ? (
          <Link href={href} className={`text-sm ${actionLink}`}>
            {hrefLabel ?? "Ver"} →
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

/** Início da coordenação (depois do "Próximo dia de aula"): o que pede ação e o que pede atenção. */
export function TodayPanel({ data }: { data: TodayData }) {
  const { alerts } = data;
  const upcomingByDate = groupMeetingsByDate(data.upcoming);
  const highlightedDate = data.nextClassDay?.date ?? null;
  const hasPendingItems =
    data.pendingRequests > 0 ||
    data.pendingAttendanceRequests > 0 ||
    data.approvedWithoutAccount > 0 ||
    alerts.withoutTeacher.length > 0 ||
    alerts.reportsMissing > 0 ||
    alerts.dataIssues > 0;

  return (
    <div className="flex flex-col gap-4">
      <Block id="para-resolver" title="Para resolver">
        {hasPendingItems ? (
          <ul className="flex flex-col gap-2 text-sm">
            {data.pendingRequests > 0 ? (
              <li>
                <Link href="/coordenacao/inscricoes?status=pending" className={actionLink}>
                  {pluralize(data.pendingRequests, "inscrição pendente", "inscrições pendentes")} de decisão →
                </Link>
              </li>
            ) : null}
            {data.pendingAttendanceRequests > 0 ? (
              <li>
                <Link href="/coordenacao/presenca?aba=solicitacoes&status=pending" className={actionLink}>
                  {pluralize(data.pendingAttendanceRequests, "pedido de presença aguardando", "pedidos de presença aguardando")} sua decisão →
                </Link>
              </li>
            ) : null}
            {data.approvedWithoutAccount > 0 ? (
              <li>
                <Link href="/coordenacao/acessos?f=sem_conta" className={actionLink}>
                  {pluralize(data.approvedWithoutAccount, "aprovado que ainda não criou", "aprovados que ainda não criaram")} a conta →
                </Link>
              </li>
            ) : null}
            {alerts.withoutTeacher.length > 0 ? (
              <li>
                <span className="font-medium">{pluralize(alerts.withoutTeacher.length, "aula sem professor", "aulas sem professor")}</span>
                <ul className="mt-0.5 text-neutral-600">
                  {alerts.withoutTeacher.slice(0, 4).map((m) => (
                    <li key={m.meetingId}>
                      <Link href={`/coordenacao/turmas/${m.classId}/escala`} className={`text-brand-blue hover:underline ${focusRing}`}>
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
                <Link href="/coordenacao/relatorios" className={actionLink}>
                  {pluralize(alerts.reportsMissing, "encontro realizado sem relatório pós-aula", "encontros realizados sem relatório pós-aula")} →
                </Link>
              </li>
            ) : null}
            {alerts.dataIssues > 0 ? (
              <li>
                <Link href="/coordenacao/qualidade-dados" className={actionLink}>
                  {pluralize(alerts.dataIssues, "item de dados para revisar", "itens de dados para revisar")} →
                </Link>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-success">Tudo em dia por aqui. Nada pede ação agora.</p>
        )}
      </Block>

      {data.anomalies.length > 0 ? (
        <Card role="region" aria-labelledby="falhas-chamada" className="border-danger/30 bg-danger/5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="falhas-chamada" className="text-sm font-semibold text-danger">
                Possíveis falhas na chamada
              </h2>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-neutral-800">
                {data.anomalies.map((a, i) => (
                  <li key={i} className="break-words">
                    {a.text}
                  </li>
                ))}
              </ul>
              <Link href="/coordenacao/presenca" className={`mt-1 inline-block text-sm ${actionLink}`}>
                Abrir a visão geral da presença →
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Block id="proximos-7-dias" title="Próximos 7 dias" href="/coordenacao/turmas" hrefLabel="Turmas">
          {upcomingByDate.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum encontro nos próximos 7 dias.</p>
          ) : (
            <ol className="flex flex-col gap-3 text-sm">
              {upcomingByDate.map((group) => {
                const featured = group.date === highlightedDate;
                return (
                  <li key={group.date}>
                    <h3 className="flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <time dateTime={group.date}>{dayLabel(group.date)}</time>
                      {group.date === data.todayKey ? <span className="rounded-full bg-brand-blue-light px-2 py-0.5 normal-case tracking-normal text-brand-blue">Hoje</span> : null}
                      {featured ? <span className="font-normal normal-case tracking-normal text-neutral-400">em destaque acima</span> : null}
                    </h3>
                    <ul className={`mt-1 flex flex-col divide-y divide-neutral-100 ${featured ? "text-neutral-500" : "text-neutral-800"}`}>
                      {group.meetings.map((m) => (
                        <li key={m.meetingId} className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2 ${m.timeState === "ended" ? "opacity-60" : ""}`}>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">
                              {m.start} às {m.end}
                              {m.timeState === "ended" ? <span className="ml-2 text-xs font-normal text-neutral-500">encerrada</span> : null}
                            </span>
                            <span className="block break-words text-xs text-neutral-500">
                              {m.className} · encontro {m.sequence}
                              {m.subjects.length > 0 ? ` · ${m.subjects.join(", ")}` : ""}
                            </span>
                          </span>
                          {m.teachers.length > 0 ? (
                            <span className="break-words text-xs text-neutral-600">{m.teachers.map(shortPersonName).join(", ")}</span>
                          ) : (
                            <Link href={`/coordenacao/turmas/${m.classId}/escala`} className={`text-xs font-medium text-danger hover:underline ${focusRing}`}>
                              Sem professor — atribuir
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </Block>

        <Block id="presenca-ultimo-encontro" title="Presença do último encontro" href="/coordenacao/presenca" hrefLabel="Visão geral">
          {data.lastMeetingByClass.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum encontro realizado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.lastMeetingByClass.map((entry) => (
                <li key={entry.label} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 flex-1 text-neutral-700 sm:w-44 sm:flex-none">
                    {entry.label} <span className="text-neutral-500">· E{entry.sequence}</span>
                  </span>
                  <span
                    role="meter"
                    aria-label={`Presença: ${entry.label}, encontro ${entry.sequence}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={entry.pct === null ? undefined : Math.round(entry.pct)}
                    aria-valuetext={entry.pct === null ? "sem dados" : `${Math.round(entry.pct)}%`}
                    className="h-3 min-w-24 flex-1 rounded bg-neutral-100"
                  >
                    <span className="block h-3 rounded bg-brand-blue" style={{ width: `${entry.pct ?? 0}%` }} />
                  </span>
                  <span className="w-10 shrink-0 text-right font-medium text-neutral-800">{entry.pct === null ? "—" : `${Math.round(entry.pct)}%`}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block id="alunos-em-risco" title="Alunos em risco" href="/coordenacao/alunos" hrefLabel="Todos os alunos">
          <p className="text-sm text-neutral-600">
            {data.bands.emDia} em dia · {data.bands.atencao} no limite · <span className="font-medium text-danger">{data.bands.critico} abaixo dos 75%</span>
          </p>
          {data.atRisk.length === 0 ? (
            <p className="text-sm text-neutral-500">Ninguém em risco por enquanto.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
              {data.atRisk.map(({ person, classLabel }) => (
                <li key={`${classLabel}-${person.key}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 break-words text-neutral-800">
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
      </div>
    </div>
  );
}
