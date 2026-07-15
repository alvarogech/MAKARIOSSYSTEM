import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/authorization";
import { AppShell } from "@/components/layout/AppShell";
import { SuspendedAccount } from "@/components/feedback/SuspendedAccount";

/**
 * Portão de acesso da área autenticada. Roda em todo Server Component sob
 * `(app)` — não é o único lugar em que a autorização é checada (cada
 * Server Action/Route Handler repete a checagem, e o Postgres reforça via
 * RLS), mas evita que uma página inteira seja renderizada para quem não
 * deveria nem chegar perto dela.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  if (authContext.profileStatus !== "active") {
    return <SuspendedAccount />;
  }

  if (!authContext.activeRole) {
    redirect("/selecionar-perfil");
  }

  return (
    <AppShell
      fullName={authContext.fullName}
      activeRole={authContext.activeRole}
      hasMultipleRoles={authContext.roles.length > 1}
    >
      {children}
    </AppShell>
  );
}
