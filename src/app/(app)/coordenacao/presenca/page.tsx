import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { GenerateQrCodesForm, RequireLocationSwitch } from "@/modules/attendance/components/AttendanceForms";
import { computeProgress, formatHours, type Situation } from "@/modules/attendance/progress";
import { loadAttendanceData, type ScanRow } from "@/modules/attendance/report";

export const metadata: Metadata = { title: "Presença por QR Code" };

const SCHEDULE: Record<string, string> = { terca_quinta: "Terça/quinta", sabado: "Sábado" };
const LOCATION: Record<string, string> = {
  impreciso: "GPS impreciso",
  sem_localizacao: "sem localização",
  longe: "longe do local",
};
const SITUATION: Record<Situation, { label: string; className: string }> = {
  em_dia: { label: "Em dia", className: "bg-green-50 text-green-700" },
  atencao: { label: "Atenção", className: "bg-amber-50 text-amber-700" },
  no_limite: { label: "No limite", className: "bg-orange-50 text-orange-700" },
  reprovado: { label: "Reprovado por frequência", className: "bg-red-50 text-red-700" },
};

function time(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

function br(dateKey: string) {
  return dateKey.split("-").reverse().join("/");
}

function nowMinuteSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

function scanDetail(s: ScanRow) {
  const extra = LOCATION[s.locationStatus] ? `, ${LOCATION[s.locationStatus]}` : "";
  return `${s.block === 1 ? "Antes do intervalo" : "Depois do intervalo"} às ${time(s.scannedAt)}, ${s.lessonsCredited}/${s.lessonsTotal} aulas${extra}`;
}

export default async function PresencaCoordenacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; aba?: string; temporada?: string }>;
}) {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const { dia, aba, temporada } = await searchParams;
  const today = getSaoPauloDateKey(new Date());
  const day = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : today;
  const general = aba === "geral";
  const supabase = await createSupabaseServerClient();
  // Uma turma por semestre: o relatório mostra uma temporada por vez, a mais
  // recente por padrão.
  const { data: seasons } = await supabase.from("seasons").select("id, name").order("starts_on", { ascending: false, nullsFirst: false });
  const season = (seasons ?? []).find((s) => s.id === temporada) ?? seasons?.[0];

  const [{ data: codes }, { data: volumes }, { data: settings }, data] = await Promise.all([
    supabase.from("attendance_qr_codes").select("volume_id, token, volumes(name)").order("created_at"),
    supabase.from("volumes").select("id"),
    supabase.from("attendance_settings").select("require_location").maybeSingle(),
    loadAttendanceData(supabase, today, nowMinuteSaoPaulo(), season?.id ?? ""),
  ]);
  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const missingCodes = (volumes?.length ?? 0) > (codes?.length ?? 0);
  const nameOf = (key: string) => data.names.get(key) ?? "Sem nome";

  const tab = (active: boolean) =>
    active ? "border-b-2 border-brand-blue pb-1 font-semibold text-brand-blue" : "pb-1 text-neutral-500 hover:text-neutral-800";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Presença por QR Code</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Um QR Code permanente por volume, que serve para as turmas de terça/quinta e de sábado. O aluno escaneia na entrada e
          na volta do intervalo.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold text-neutral-900">QR Codes dos volumes</h2>
        {missingCodes ? <GenerateQrCodesForm /> : null}
        {(codes ?? []).length > 0 ? (
          <Link href="/presenca/imprimir" target="_blank" className="self-start text-sm font-medium text-brand-blue hover:underline">
            Abrir para imprimir
          </Link>
        ) : null}
        {(codes ?? []).length > 0 ? (
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-[var(--radius-sm)] border border-neutral-100 text-sm">
            {(codes ?? []).map((code) => {
              const url = `${base}/presenca/${code.token}`;
              return (
                <li key={code.token} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-800">{code.volumes?.name}</p>
                    <p className="truncate text-xs text-neutral-500">{url}</p>
                  </div>
                  <CopyButton value={url} label="link" />
                </li>
              );
            })}
          </ul>
        ) : null}
        <RequireLocationSwitch initial={settings?.require_location ?? true} />
        <p className="text-xs text-neutral-500">
          A checagem de localização usa as coordenadas cadastradas em{" "}
          <Link href="/coordenacao/locais" className="underline">
            Locais
          </Link>
          . Pode imprimir várias cópias do mesmo QR para as mesas.
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-5 text-sm">
            <Link href={`?aba=dia&dia=${day}&temporada=${season?.id ?? ""}`} className={tab(!general)}>
              Relatório do dia
            </Link>
            <Link href={`?aba=geral&dia=${day}&temporada=${season?.id ?? ""}`} className={tab(general)}>
              Relatório geral
            </Link>
          </div>
          <form method="get" className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="hidden" name="aba" value={general ? "geral" : "dia"} />
            <input type="hidden" name="dia" value={day} />
            <label htmlFor="temporada">Temporada</label>
            <select
              id="temporada"
              name="temporada"
              defaultValue={season?.id}
              className="rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-1 text-neutral-800"
            >
              {(seasons ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className="text-brand-blue hover:underline">
              Trocar
            </button>
          </form>
        </div>

        {!general ? (
          <>
            <form className="flex flex-wrap items-end gap-2" method="get">
              <input type="hidden" name="aba" value="dia" />
              <input type="hidden" name="temporada" value={season?.id ?? ""} />
              <label className="flex flex-col gap-1 text-sm text-neutral-600">
                Data
                <input
                  type="date"
                  name="dia"
                  defaultValue={day}
                  className="rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-3 py-2 text-neutral-800"
                />
              </label>
              <button type="submit" className="rounded-[var(--radius-sm)] bg-brand-blue px-4 py-2 text-sm font-medium text-white">
                Ver
              </button>
            </form>

            {data.classes.every((c) => !c.meetings.some((m) => m.date === day)) ? (
              <p className="text-sm text-neutral-400">Nenhum encontro em {br(day)}.</p>
            ) : null}

            {data.classes.flatMap((c) =>
              c.meetings
                .filter((m) => m.date === day)
                .map((m) => {
                  const scans = data.scans.filter((s) => s.meetingId === m.id);
                  const rosterKeys = new Set(c.roster.map((p) => p.key));
                  const byPerson = new Map<string, ScanRow[]>();
                  for (const s of scans) byPerson.set(s.personKey, [...(byPerson.get(s.personKey) ?? []), s]);
                  const came = [...byPerson.entries()].filter(([k, list]) => rosterKeys.has(k) && !list.some((s) => s.makeupFor));
                  const makeup = [...byPerson.entries()].filter(([k, list]) => !rosterKeys.has(k) || list.some((s) => s.makeupFor));
                  const missing = m.started ? c.roster.filter((p) => !byPerson.has(p.key)) : [];
                  return (
                    <section key={m.id} className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-neutral-100 p-3">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        {c.volumeName}, {SCHEDULE[c.schedule] ?? c.schedule}, encontro {m.sequence} ({m.start} às {m.end})
                      </h3>
                      <p className="text-xs text-neutral-500">
                        {c.roster.length} inscritos · {came.length} vieram · {makeup.length} de reposição ·{" "}
                        {m.started ? `${missing.length} faltaram` : "ainda não começou"}
                      </p>

                      <div>
                        <p className="text-xs font-semibold tracking-wide text-green-700 uppercase">Vieram</p>
                        {came.length === 0 ? <p className="text-sm text-neutral-400">Ninguém.</p> : null}
                        <ul className="divide-y divide-neutral-100 text-sm">
                          {came.map(([k, list]) => (
                            <li key={k} className="py-1.5">
                              <span className="font-medium text-neutral-800">{nameOf(k)}</span>
                              <span className="block text-xs text-neutral-500">{list.map(scanDetail).join(" · ")}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {makeup.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-brand-blue uppercase">Reposição</p>
                          <ul className="divide-y divide-neutral-100 text-sm">
                            {makeup.map(([k, list]) => (
                              <li key={k} className="py-1.5">
                                <span className="font-medium text-neutral-800">{nameOf(k)}</span>
                                <span className="block text-xs text-neutral-500">{list.map(scanDetail).join(" · ")}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {m.started ? (
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-red-700 uppercase">Faltaram</p>
                          {missing.length === 0 ? <p className="text-sm text-neutral-400">Ninguém.</p> : null}
                          <ul className="grid gap-x-4 text-sm text-neutral-700 sm:grid-cols-2">
                            {missing.map((p) => (
                              <li key={p.key} className="py-0.5">
                                {p.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  );
                }),
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-neutral-500">
              Mínimo de 75% das 16 horas (12 horas). No sábado cabe 1 falta; na terça/quinta, 2. Atraso desconta as aulas
              perdidas, e reposição em outra turma devolve as horas.
            </p>
            {data.classes.map((c) => {
              const meetings = c.meetings.map((m) => ({ id: m.id, minutes: m.minutes, past: m.past }));
              const rows = c.roster.map((p) => ({
                person: p,
                progress: computeProgress(
                  meetings,
                  data.scans
                    .filter((s) => s.personKey === p.key)
                    .map((s) => ({ meetingId: s.meetingId, makeupForMeetingId: s.makeupFor, minutes: s.minutes })),
                ),
              }));
              const failing = rows.filter((r) => r.progress.situation === "reprovado").length;
              const done = c.meetings.filter((m) => m.past).length;
              return (
                <details key={c.id} className="rounded-[var(--radius-sm)] border border-neutral-100 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
                    {c.volumeName}, {SCHEDULE[c.schedule] ?? c.schedule} · {c.roster.length} alunos · {done} de{" "}
                    {c.meetings.length} encontros realizados{failing > 0 ? ` · ${failing} reprovado(s)` : ""}
                  </summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="text-xs text-neutral-500">
                        <tr>
                          <th className="py-1 font-medium">Aluno</th>
                          <th className="py-1 font-medium">Presença</th>
                          <th className="py-1 font-medium">Faltas</th>
                          <th className="py-1 font-medium">Pode perder ainda</th>
                          <th className="py-1 font-medium">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {rows.map(({ person, progress }) => (
                          <tr key={person.key}>
                            <td className="py-1.5 text-neutral-800">{person.name}</td>
                            <td className="py-1.5 text-neutral-600">
                              {formatHours(progress.attendedMinutes)} de {formatHours(progress.totalMinutes)} (
                              {progress.totalMinutes ? Math.round((progress.attendedMinutes / progress.totalMinutes) * 100) : 0}%)
                            </td>
                            <td className="py-1.5 text-neutral-600">{progress.absences}</td>
                            <td className="py-1.5 text-neutral-600">{formatHours(progress.slackMinutes)}</td>
                            <td className="py-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SITUATION[progress.situation].className}`}>
                                {SITUATION[progress.situation].label}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
