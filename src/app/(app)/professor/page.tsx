import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export const metadata: Metadata = { title: "Área do professor" };

export default async function ProfessorAreaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return (
      <AccessDenied description="Esta área é exclusiva do perfil Professor." />
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("class_id")
    .eq("teacher_id", authContext.userId);

  const classCount = new Set((assignments ?? []).map((a) => a.class_id)).size;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h1 className="text-lg font-semibold text-neutral-900">
          Olá, {authContext.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Você está atribuído a {classCount} turma{classCount === 1 ? "" : "s"}.
        </p>
        <div className="mt-4 flex gap-3">
          <Link href="/professor/turmas" className={buttonVariants({ variant: "primary" })}>
            Minhas turmas
          </Link>
          <Link href="/professor/agenda" className={buttonVariants({ variant: "secondary" })}>
            Agenda
          </Link>
        </div>
      </Card>
    </div>
  );
}
