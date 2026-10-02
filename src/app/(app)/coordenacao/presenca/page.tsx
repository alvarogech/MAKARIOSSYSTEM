import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { GenerateQrCodesForm } from "@/modules/attendance/components/AttendanceForms";

export const metadata: Metadata = { title: "Presença por QR Code" };

const SCHEDULE: Record<string, string> = { terca_quinta: "Terça/quinta", sabado: "Sábado" };
const LOCATION: Record<string, string> = { dentro: "", impreciso: "GPS impreciso", sem_local_cadastrado: "" };

function time(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export default async function PresencaCoordenacaoPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const { dia } = await searchParams;
  const day = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : getSaoPauloDateKey(new Date());
  const supabase = await createSupabaseServerClient();

  const [{ data: codes }, { data: volumes }, { data: meetings }] = await Promise.all([
    supabase.from("attendance_qr_codes").select("volume_id"),
    supabase.from("volumes").select("id"),
    supabase
      .from("class_meetings")
      .select(
        "id, sequence, start_time, classes!inner(class_templates!inner(slug), season_volume_offerings!inner(volumes!inner(name)))",
      )
      .eq("meeting_date", day)
      .order("start_time"),
  ]);
  const missingCodes = (volumes?.length ?? 0) > (codes?.length ?? 0);

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const { data: scans } = meetingIds.length
    ? await supabase
        .from("attendance_scans")
        .select(
          "id, meeting_id, block, scanned_at, lessons_credited, lessons_total, location_status, makeup_for_meeting_id, identified_by, enrollment_requests(full_name), student_id",
        )
        .in("meeting_id", meetingIds)
        .order("scanned_at")
    : { data: [] };

  const studentIds = (scans ?? []).filter((s) => !s.enrollment_requests && s.student_id).map((s) => s.student_id!);
  const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] };
  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const prevDay = new Date(`${day}T12:00:00Z`);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
  const nextDay = new Date(`${day}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Presença por QR Code</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Um QR Code permanente por volume, que serve para as turmas de terça/quinta e de sábado. O aluno escaneia na entrada e na volta do intervalo.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold text-neutral-900">QR Codes dos volumes</h2>
        {missingCodes ? <GenerateQrCodesForm /> : null}
        {(codes?.length ?? 0) > 0 ? (
          <Link
            href="/presenca/imprimir"
            target="_blank"
            className="self-start text-sm font-medium text-brand-blue hover:underline"
          >
            Abrir para imprimir
          </Link>
        ) : null}
        <p className="text-xs text-neutral-500">
          A checagem de localização usa as coordenadas cadastradas em{" "}
          <Link href="/coordenacao/locais" className="underline">
            Locais
          </Link>
          . Sem nenhuma coordenada, a presença é aceita de qualquer lugar. Pode imprimir várias cópias do mesmo QR para as mesas.
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-neutral-900">Quem marcou presença em {day.split("-").reverse().join("/")}</h2>
          <div className="flex gap-3 text-sm">
            <Link href={`?dia=${prevDay.toISOString().slice(0, 10)}`} className="text-brand-blue hover:underline">
              Dia anterior
            </Link>
            <Link href={`?dia=${nextDay.toISOString().slice(0, 10)}`} className="text-brand-blue hover:underline">
              Próximo dia
            </Link>
          </div>
        </div>

        {(meetings ?? []).length === 0 ? <p className="text-sm text-neutral-400">Nenhum encontro neste dia.</p> : null}

        {(meetings ?? []).map((meeting) => {
          const rows = (scans ?? []).filter((s) => s.meeting_id === meeting.id);
          return (
            <section key={meeting.id} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-neutral-800">
                {meeting.classes.season_volume_offerings.volumes.name}, {SCHEDULE[meeting.classes.class_templates.slug] ?? ""},
                encontro {meeting.sequence} · {rows.length} escaneamento{rows.length === 1 ? "" : "s"}
              </h3>
              {rows.length === 0 ? (
                <p className="text-sm text-neutral-400">Ninguém escaneou ainda.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
                  {rows.map((s) => (
                    <li key={s.id} className="flex flex-wrap justify-between gap-x-4 py-2">
                      <span className="font-medium text-neutral-800">
                        {s.enrollment_requests?.full_name ?? profileName.get(s.student_id ?? "") ?? "Sem nome"}
                      </span>
                      <span className="text-neutral-500">
                        {s.block === 1 ? "Antes do intervalo" : "Depois do intervalo"}, {time(s.scanned_at)}, {s.lessons_credited}/
                        {s.lessons_total} aulas
                        {s.makeup_for_meeting_id ? ", reposição" : ""}
                        {LOCATION[s.location_status] ? `, ${LOCATION[s.location_status]}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </Card>
    </div>
  );
}
