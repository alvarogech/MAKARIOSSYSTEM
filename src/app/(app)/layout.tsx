import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { can, canAccessArea, getAuthContext, type AuthContext } from "@/authorization";
import { AppShell, type NavLink } from "@/components/layout/AppShell";
import { SuspendedAccount } from "@/components/feedback/SuspendedAccount";

/**
 * Links de navegação visíveis no cabeçalho, filtrados pelo que o perfil
 * ativo da sessão realmente pode acessar — a mesma checagem (`can`/
 * `canAccessArea`) que cada página já faz por conta própria. Nenhum link
 * aqui é decorativo: se aparece, a rota realmente autoriza.
 */
function buildNavLinks(authContext: AuthContext): NavLink[] {
  const links: NavLink[] = [{ href: "/dashboard", label: "Início" }];

  if (authContext.activeRole === "student") {
    links.push({ href: "/meus-volumes", label: "Meus volumes" });
    links.push({ href: "/meu-aprendizado", label: "Meu aprendizado" });
    links.push({ href: "/minha-frequencia", label: "Minha frequência" });
    links.push({ href: "/agenda", label: "Agenda" });
  }

  const isStaff = canAccessArea(authContext, "coordination");

  if (canAccessArea(authContext, "teacher")) {
    if (isStaff) {
      // Quem coordena e também leciona vê um atalho só; a área do professor completa vem ao trocar de perfil.
      links.push({ href: "/professor", label: "Área do professor" });
    } else {
      links.push({ href: "/professor", label: "Área do professor" });
      links.push({ href: "/professor/agenda", label: "Agenda" });
      links.push({ href: "/professor/turmas", label: "Minhas turmas" });
    }
  }

  if (isStaff) {
    // Menu por tarefa: o que fazer, não qual ferramenta abrir.
    links.splice(
      1,
      0,
      { href: "/coordenacao/alunos", label: "Alunos" },
      { href: "/coordenacao/turmas", label: "Turmas" },
      { href: "/coordenacao/professores", label: "Professores" },
    );
  }

  if (can(authContext, { resource: "content", action: "manage" })) {
    links.push({ href: "/conteudo/arvore", label: "Conteúdo" });
  }

  if (isStaff) {
    links.push({ href: "/coordenacao/configuracoes", label: "Configurações" });
  }

  return links;
}

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
      navLinks={buildNavLinks(authContext)}
    >
      {children}
    </AppShell>
  );
}
