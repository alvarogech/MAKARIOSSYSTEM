import { formatRoom } from "@/lib/room";
import { loadReportActiveByClass } from "@/modules/teaching/reportSettingsLoader";
import { isMeetingOver } from "@/modules/teaching/reportSettings";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin } from "lucide-react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CopyButton } from "@/components/ui/CopyButton";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { formatSaoPauloLongDate, formatSaoPauloTimeRange, saoPauloWallTimeToUtc } from "@/lib/saoPauloDate";
import { buildMapsSearchUrl } from "@/lib/maps";
import { buildGoogleCalendarUrl } from "@/lib/ics";
import { loadMaterials } from "@/modules/teaching/loadMaterials";
import { MaterialsSection } from "@/modules/teaching/components/MaterialsSection";

export const metadata: Metadata = { title: "Preparar aula" };

const BLOCK_STATUS_LABEL: Record<string, string> = {
  scheduled: "Confirmada",
  changed: "Alterada",
  canceled: "Cancelada",
};

export default async function PrepararAulaPage({ params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Professor." />;
  }

  const supabase = await createSupabaseServerClient();

  // RLS de class_meeting_blocks: só quem é o professor do bloco ou tem
  // vínculo (teacher_assignments) com a turma do encontro enxerga esta
  // linha — nenhuma checagem extra de escopo é necessária aqui além dela.
  const { data: block } = await supabase
    .from("class_meeting_blocks")
    .select("id, class_meeting_id, module_id, teacher_id, start_time, end_time, room, status, coordination_notes")
    .eq("id", blockId)
    .maybeSingle();

  if (!block) {
    notFound();
  }

  const { data: meeting } = await supabase
    .from("class_meetings")
    .select("id, class_id, meeting_date, start_time, end_time, status, location, location_id, room")
    .eq("id", block.class_meeting_id)
    .maybeSingle();

  if (!meeting) {
    notFound();
  }

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, location, location_id, season_volume_offering_id")
    .eq("id", meeting.class_id)
    .maybeSingle();

  if (!klass) {
    notFound();
  }

  const { data: offering } = await supabase
    .from("season_volume_offerings")
    .select("volume_id")
    .eq("id", klass.season_volume_offering_id)
    .maybeSingle();

  // O relatório só aparece quando o semestre exige, para quem está escalado neste bloco e depois do término.
  const reportActive = (await loadReportActiveByClass(supabase, [klass.id])).get(klass.id) ?? false;
  const reportOpen = reportActive && block.teacher_id === authContext.userId && isMeetingOver(meeting.meeting_date, meeting.end_time, new Date());

  const [{ data: volume }, { data: moduleRow }, { data: teacherProfile }] = await Promise.all([
    offering ? supabase.from("volumes").select("name").eq("id", offering.volume_id).maybeSingle() : Promise.resolve({ data: null }),
    block.module_id ? supabase.from("modules").select("name").eq("id", block.module_id).maybeSingle() : Promise.resolve({ data: null }),
    block.teacher_id ? supabase.from("profiles").select("full_name").eq("id", block.teacher_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const locationId = meeting.location_id ?? klass.location_id ?? null;
  const { data: location } = locationId
    ? await supabase.from("locations").select("name, address, entry_instructions, parking_instructions, arrival_minutes_before, coordination_contact, resources").eq("id", locationId).maybeSingle()
    : { data: null };

  const legacyLocationText = meeting.location ?? klass.location ?? null;
  const room = block.room ?? meeting.room ?? null;
  const startTime = block.start_time ?? meeting.start_time;
  const endTime = block.end_time ?? meeting.end_time;

  const materials = offering
    ? await loadMaterials(supabase, { volumeId: offering.volume_id, moduleId: block.module_id ?? undefined })
    : { apostilas: [], slides: [] };

  const dateLabel = meeting.meeting_date ? formatSaoPauloLongDate(meeting.meeting_date, { capitalize: true }) : null;
  const timeLabel = formatSaoPauloTimeRange(startTime, endTime);
  const mapsQuery = location ? (location.address ?? location.name) : legacyLocationText;
  const mapsUrl = mapsQuery ? buildMapsSearchUrl(mapsQuery) : null;
  const addressToCopy = location?.address ?? legacyLocationText;

  const canExportCalendar = Boolean(meeting.meeting_date && startTime && endTime);
  const googleCalendarUrl =
    canExportCalendar && meeting.meeting_date && startTime && endTime
      ? buildGoogleCalendarUrl({
          uid: `${block.id}@plataforma-makarios`,
          title: `Makários · ${volume?.name ?? "Aula"} · ${moduleRow?.name ?? "Tema a confirmar"}`,
          description: `Turma ${klass.name}`,
          location: location ? (location.address ? `${location.name} — ${location.address}` : location.name) : (legacyLocationText ?? undefined),
          startUtc: saoPauloWallTimeToUtc(meeting.meeting_date, startTime),
          endUtc: saoPauloWallTimeToUtc(meeting.meeting_date, endTime),
        })
      : null;

  const isMine = block.teacher_id === authContext.userId;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/professor/turmas/${klass.id}`} className="text-sm text-brand-blue hover:underline">
        ← Voltar à turma
      </Link>

      {!isMine ? (
        <Alert variant="info">Esta aula está atribuída a {teacherProfile?.full_name ?? "outro professor"}, não a você.</Alert>
      ) : null}

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
              {volume?.name ?? "Volume"} · {klass.name}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-neutral-900">{moduleRow?.name ?? "Tema a definir"}</h1>
            <p className="mt-1 text-sm text-neutral-600">{dateLabel ?? "Data a confirmar"}{timeLabel ? ` · ${timeLabel}` : " · Horário a confirmar"}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              {location?.name ?? legacyLocationText ?? "Local a confirmar"}
              {formatRoom(room) ? ` · ${formatRoom(room)}` : " · Sala a confirmar"}
            </p>
            {block.status !== "scheduled" ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-warning">
                {BLOCK_STATUS_LABEL[block.status]}
              </p>
            ) : null}
            {meeting.status === "canceled" ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-danger">Encontro cancelado</p>
            ) : null}
          </div>
          <Calendar className="size-8 shrink-0 text-brand-blue" aria-hidden="true" />
        </div>

        {block.coordination_notes ? (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Observações da coordenação</p>
            <p className="mt-1">{block.coordination_notes}</p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Ver localização
            </a>
          ) : null}
          {canExportCalendar ? (
            <>
              <a href={`/api/professor/aulas/${block.id}/ics`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Baixar .ics
              </a>
              {googleCalendarUrl ? (
                <a href={googleCalendarUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Adicionar ao Google Calendar
                </a>
              ) : null}
            </>
          ) : (
            <span className="self-center text-xs text-neutral-400">
              Exportação para o calendário fica disponível quando a coordenação confirmar data e horário.
            </span>
          )}
          {reportOpen ? (
            <Link href={`/professor/turmas/${klass.id}/encontros/${meeting.id}/relatorio`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Relatório
            </Link>
          ) : null}
        </div>
        {canExportCalendar ? (
          <p className="mt-2 text-xs text-neutral-400">
            Isto exporta o evento uma vez — se a coordenação alterar data, horário ou local depois, atualize manualmente no seu calendário pessoal.
          </p>
        ) : null}
      </Card>

      {location ? (
        <Card>
          <h2 className="font-semibold text-neutral-900">Local e sala</h2>
          <div className="mt-2 flex flex-col gap-1.5 text-sm text-neutral-700">
            <p className="font-medium">{location.name}</p>
            {location.address ? <p className="text-neutral-500">{location.address}</p> : null}
            {formatRoom(room) ? <p className="text-neutral-500">{formatRoom(room)}</p> : null}
            {location.entry_instructions ? <p className="text-neutral-500">Entrada: {location.entry_instructions}</p> : null}
            {location.parking_instructions ? <p className="text-neutral-500">Estacionamento: {location.parking_instructions}</p> : null}
            {location.arrival_minutes_before ? (
              <p className="text-neutral-500">Chegue com {location.arrival_minutes_before} min de antecedência.</p>
            ) : null}
            {location.resources && location.resources.length > 0 ? (
              <p className="text-neutral-500">Recursos disponíveis: {location.resources.join(", ")}</p>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Abrir no Google Maps
              </a>
            ) : null}
            {addressToCopy ? <CopyButton value={addressToCopy} label="endereço" /> : null}
            {location.coordination_contact ? (
              <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600">
                Coordenação: {location.coordination_contact}
              </span>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-semibold text-neutral-900">Materiais da aula</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {block.module_id
            ? "Recorte do módulo desta aula. Veja a biblioteca completa da turma na página da turma."
            : "A coordenação ainda não definiu o tema desta aula — os materiais aparecerão aqui assim que houver um módulo associado."}
        </p>
        {block.module_id ? <MaterialsSection materials={materials} showModuleName={false} /> : null}
      </Card>
    </div>
  );
}
