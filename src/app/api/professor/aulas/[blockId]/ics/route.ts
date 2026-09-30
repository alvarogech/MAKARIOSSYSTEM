import { NextResponse } from "next/server";
import { canAccessArea, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { buildIcsCalendar } from "@/lib/ics";
import { saoPauloWallTimeToUtc } from "@/lib/saoPauloDate";

/**
 * Exporta uma única aula (bloco) como .ics. Só habilita quando data e
 * horários (do bloco ou, na ausência, do encontro) estão completos — nunca
 * inventa horário. Nunca inclui link de material/gabarito na descrição.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
  const authContext = await getAuthContext();
  if (!authContext || !canAccessArea(authContext, "teacher")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();

  // RLS de class_meeting_blocks já garante que só quem tem vínculo com a
  // turma (ou a própria aula) recebe uma linha aqui.
  const { data: block } = await supabase
    .from("class_meeting_blocks")
    .select("id, class_meeting_id, module_id, start_time, end_time")
    .eq("id", blockId)
    .maybeSingle();

  if (!block) {
    return NextResponse.json({ error: "Aula não encontrada." }, { status: 404 });
  }

  const { data: meeting } = await supabase
    .from("class_meetings")
    .select("id, class_id, meeting_date, start_time, end_time, location, location_id, room")
    .eq("id", block.class_meeting_id)
    .maybeSingle();

  if (!meeting) {
    return NextResponse.json({ error: "Encontro não encontrado." }, { status: 404 });
  }

  const startTime = block.start_time ?? meeting.start_time;
  const endTime = block.end_time ?? meeting.end_time;

  if (!meeting.meeting_date || !startTime || !endTime) {
    return NextResponse.json(
      { error: "Data e horário desta aula ainda não foram confirmados pela coordenação." },
      { status: 422 },
    );
  }

  const { data: klass } = await supabase
    .from("classes")
    .select("name, location, location_id, season_volume_offering_id")
    .eq("id", meeting.class_id)
    .maybeSingle();

  const { data: offering } = klass
    ? await supabase.from("season_volume_offerings").select("volume_id").eq("id", klass.season_volume_offering_id).maybeSingle()
    : { data: null };
  const { data: volume } = offering
    ? await supabase.from("volumes").select("name").eq("id", offering.volume_id).maybeSingle()
    : { data: null };
  const { data: moduleRow } = block.module_id
    ? await supabase.from("modules").select("name").eq("id", block.module_id).maybeSingle()
    : { data: null };

  const locationId = meeting.location_id ?? klass?.location_id ?? null;
  const { data: location } = locationId
    ? await supabase.from("locations").select("name, address").eq("id", locationId).maybeSingle()
    : { data: null };
  const locationText = location
    ? location.address
      ? `${location.name} — ${location.address}`
      : location.name
    : (meeting.location ?? klass?.location ?? undefined);

  const ics = buildIcsCalendar({
    uid: `${block.id}@plataforma-makarios`,
    title: `Makários · ${volume?.name ?? "Aula"} · ${moduleRow?.name ?? "Tema a confirmar"}`,
    description: klass?.name ? `Turma ${klass.name}` : undefined,
    location: locationText,
    startUtc: saoPauloWallTimeToUtc(meeting.meeting_date, startTime),
    endUtc: saoPauloWallTimeToUtc(meeting.meeting_date, endTime),
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="aula-${block.id}.ics"`,
    },
  });
}
