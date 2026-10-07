import { canAccessArea, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { SITUATION } from "@/modules/attendance/situation";
import { formatHours } from "@/modules/attendance/progress";
import { loadOverview } from "@/modules/attendance/overviewLoader";

/** CSV dos alunos em risco (no limite ou abaixo dos 75%) — só coordenação/admin. */
export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "coordination")) return new Response("Acesso negado.", { status: 403 });

  const url = new URL(request.url);
  const supabase = await createSupabaseServerClient();

  let seasonId = url.searchParams.get("temporada") ?? "";
  if (!seasonId) {
    const { data: seasons } = await supabase.from("seasons").select("id").order("starts_on", { ascending: false, nullsFirst: false }).limit(1);
    seasonId = seasons?.[0]?.id ?? "";
  }

  const { overview } = await loadOverview(supabase, seasonId, {
    volume: url.searchParams.get("volume") || undefined,
    classId: url.searchParams.get("turma") || undefined,
  });

  const cell = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    // Evita que o Excel interprete fórmulas e escapa aspas.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const rows = [["Aluno", "Turma", "Horas cumpridas", "Horas totais", "% dos encontros realizados", "Encontros sem presença", "Situação", "WhatsApp"]];
  for (const klass of overview.classes) {
    for (const p of klass.people) {
      if (p.progress.situation !== "no_limite" && p.progress.situation !== "reprovado") continue;
      rows.push([
        p.name,
        klass.label,
        formatHours(p.progress.attendedMinutes),
        formatHours(p.progress.totalMinutes),
        p.pctSoFar === null ? "" : `${p.pctSoFar}%`,
        String(p.progress.absences),
        SITUATION[p.progress.situation].label,
        p.phone ?? "",
      ]);
    }
  }

  const csv = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="alunos-em-risco.csv"',
      "Cache-Control": "no-store",
    },
  });
}
