import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { buildIcsFeed } from "@/lib/ics";
import { formatRoom } from "@/lib/room";
import { saoPauloWallTimeToUtc } from "@/lib/saoPauloDate";

/**
 * Feed do calendário do professor, para assinar no Google Calendar/iPhone. A credencial é o próprio token
 * secreto do endereço (guardado só como hash); revogar = gerar outro ou desativar na Agenda. Só devolve
 * horário, tema, turma e local — nunca material, alunos ou notas.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Tokens válidos têm ~43 caracteres; recusa lixo cedo e sem consultar o banco.
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("calendar_feed_lessons", { p_token: token });
  if (error) return new NextResponse("Erro ao gerar o calendário.", { status: 500 });
  if (!data || data.length === 0) {
    // Sem aulas ou token inválido/revogado: não distingue (não revela se o token existe).
    return new NextResponse("Not found", { status: 404 });
  }

  const events = data.map((lesson) => {
    const room = formatRoom(lesson.room);
    return {
      uid: `${lesson.block_id}@plataforma-makarios`,
      title: `Makários · ${lesson.volume_name} · ${lesson.module_name ?? "Tema a confirmar"}`,
      description: [lesson.class_name ? `Turma ${lesson.class_name}` : null, room].filter(Boolean).join(" · ") || undefined,
      location: lesson.location_text ?? undefined,
      startUtc: saoPauloWallTimeToUtc(lesson.meeting_date, lesson.start_time),
      endUtc: saoPauloWallTimeToUtc(lesson.meeting_date, lesson.end_time),
    };
  });

  return new NextResponse(buildIcsFeed(events, "Aulas Makários"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}
