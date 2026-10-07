import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { classContext } from "@/modules/academic/classHub";
import { formatHours } from "@/modules/attendance/progress";
import { SITUATION } from "@/modules/attendance/situation";
import { loadOverview } from "@/modules/attendance/overviewLoader";
import { isValidBrazilianPhone } from "@/services/phone";
import { buildWhatsAppLink } from "@/services/whatsapp";

export const metadata: Metadata = { title: "Alunos da turma" };

export default async function TurmaAlunosPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  const ctx = await classContext(supabase, classId);
  if (!ctx) notFound();

  const [{ overview }, { data: roster }] = await Promise.all([
    loadOverview(supabase, ctx.seasonId, { classId }),
    supabase.rpc("class_roster", { p_class_id: classId }),
  ]);
  const stats = new Map((overview.classes[0]?.people ?? []).map((p) => [p.key, p]));
  const people = roster ?? [];

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-semibold text-neutral-900">Alunos ({people.length})</h2>
      <p className="text-xs text-neutral-500">
        Matriculados e aprovados que ainda vão criar a conta. Clique no nome para abrir a ficha completa.
      </p>
      <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
        {people.map((person) => {
          const stat = stats.get(person.person_key);
          const situation = stat ? SITUATION[stat.progress.situation] : null;
          return (
            <li key={person.person_key} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                {person.request_id ? (
                  <Link href={`/coordenacao/alunos/${person.request_id}`} className="font-medium text-neutral-900 hover:text-brand-blue hover:underline">
                    {person.full_name}
                  </Link>
                ) : (
                  <span className="font-medium text-neutral-900">{person.full_name}</span>
                )}
                {person.stage === "aguardando_acesso" ? (
                  <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">aguardando acesso</span>
                ) : null}
                <p className="text-xs text-neutral-500">
                  {stat ? `${formatHours(stat.progress.attendedMinutes)} de ${formatHours(stat.progress.totalMinutes)}${stat.pctSoFar !== null ? ` · ${stat.pctSoFar}% dos encontros realizados` : ""}` : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {situation ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${situation.className}`}>{situation.label}</span> : null}
                {person.phone && isValidBrazilianPhone(person.phone) ? (
                  <a
                    href={buildWhatsAppLink(person.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20"
                  >
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
        {people.length === 0 ? <li className="py-3 text-neutral-400">Nenhum aluno nesta turma ainda.</li> : null}
      </ul>
    </Card>
  );
}
