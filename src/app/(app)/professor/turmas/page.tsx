import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadTeacherHomeSummary } from "@/modules/teaching/teacherHome";
import { TeacherClassCardView } from "@/modules/teaching/components/TeacherClassCardView";

export const metadata: Metadata = { title: "Minhas turmas" };

export default async function ProfessorTurmasPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Professor." />;
  }

  const supabase = await createSupabaseServerClient();
  const summary = await loadTeacherHomeSummary(supabase, authContext.userId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Minhas turmas</h1>
        <p className="mt-1 text-sm text-neutral-500">Dias, horários, local e alunos de cada turma vinculada a você.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {summary.classes.map((klass) => (
          <TeacherClassCardView key={klass.classId} klass={klass} />
        ))}
        {summary.classes.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhuma turma atribuída ainda.</p>
        ) : null}
      </div>
    </div>
  );
}
