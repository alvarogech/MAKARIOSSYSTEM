import { Suspense, type ReactNode } from "react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { FormaturaNav } from "@/modules/graduation/components/FormaturaNav";

export default async function FormaturaLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-brand-blue-dark">Formatura</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Acompanhe a conclusão acadêmica dos alunos, regularize pendências e organize a cerimônia de formatura.
        </p>
      </div>
      <Suspense fallback={<div className="h-11 border-b border-neutral-200" />}>
        <FormaturaNav />
      </Suspense>
      {children}
    </div>
  );
}
