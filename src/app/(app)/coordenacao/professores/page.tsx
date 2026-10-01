import type { Metadata } from "next";
import { canAccessArea, can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadTeacherProvisioningData } from "@/modules/auth/teacherProvisioningList";
import { loadAssignableLessons } from "@/modules/auth/assignableLessons";
import { CreateTeacherInvitationForm } from "@/modules/auth/components/CreateTeacherInvitationForm";
import { TeacherProvisioningTable } from "@/modules/auth/components/TeacherProvisioningTable";

export const metadata: Metadata = { title: "Professores" };

export default async function ProfessoresPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (
    !canAccessArea(authContext, "coordination") ||
    !can(authContext, { resource: "teacher_provisioning", action: "manage" })
  ) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const supabase = await createSupabaseServerClient();
  const [{ rows }, lessons] = await Promise.all([
    loadTeacherProvisioningData(supabase),
    loadAssignableLessons(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Professores</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cadastre o primeiro acesso de um professor e envie o link manualmente pelo
          WhatsApp — sem depender de e-mail. Para designar um professor já ativo a mais
          turmas, use a tela de Turmas.
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Cadastrar professor</h2>
        <div className="mt-4">
          <CreateTeacherInvitationForm lessons={lessons} />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Professores e convites ({rows.length})</h2>
        <TeacherProvisioningTable rows={rows} lessons={lessons} />
      </Card>
    </div>
  );
}
