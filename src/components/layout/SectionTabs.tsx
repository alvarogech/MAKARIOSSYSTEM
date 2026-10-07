"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  href: string;
  label: string;
}

/** Cada seção do menu da coordenação e as telas que moram nela (a ordem é a das abas). */
const SECTIONS: { name: string; match: string[]; tabs: Tab[] }[] = [
  {
    name: "Alunos",
    match: ["/coordenacao/alunos", "/coordenacao/inscricoes", "/coordenacao/matriculas", "/coordenacao/acessos", "/coordenacao/qualidade-dados"],
    tabs: [
      { href: "/coordenacao/alunos", label: "Todos os alunos" },
      { href: "/coordenacao/inscricoes", label: "Inscrições" },
      { href: "/coordenacao/matriculas", label: "Matrículas" },
      { href: "/coordenacao/acessos", label: "Acesso à plataforma" },
      { href: "/coordenacao/qualidade-dados", label: "Qualidade dos dados" },
    ],
  },
  {
    name: "Turmas",
    match: ["/coordenacao/turmas", "/coordenacao/presenca", "/coordenacao/relatorios", "/coordenacao/avisos"],
    tabs: [
      { href: "/coordenacao/turmas", label: "Turmas" },
      { href: "/coordenacao/presenca", label: "Presença" },
      { href: "/coordenacao/relatorios", label: "Relatórios pós-aula" },
      { href: "/coordenacao/avisos", label: "Avisos" },
    ],
  },
  {
    name: "Professores",
    match: ["/coordenacao/professores"],
    tabs: [
      { href: "/coordenacao/professores", label: "Equipe" },
      { href: "/coordenacao/professores/escala", label: "Escala consolidada" },
    ],
  },
  {
    name: "Configurações",
    match: ["/coordenacao/configuracoes", "/coordenacao/temporadas", "/coordenacao/locais", "/coordenacao/importar"],
    tabs: [
      { href: "/coordenacao/configuracoes", label: "Visão geral" },
      { href: "/coordenacao/temporadas", label: "Temporadas e ofertas" },
      { href: "/coordenacao/locais", label: "Locais" },
      { href: "/coordenacao/importar", label: "Importar alunos" },
    ],
  },
];

/** Abas da seção atual — fica no topo de todas as telas de /coordenacao. */
export function SectionTabs() {
  const pathname = usePathname();
  // O hub de uma turma tem as próprias abas (layout de [classId]); aqui só a lista de turmas.
  const section = SECTIONS.find((s) => s.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)));
  if (!section) return null;

  const active = [...section.tabs]
    .sort((a, b) => b.href.length - a.href.length)
    .find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));

  return (
    <nav aria-label={`Seção ${section.name}`} className="mb-5 border-b border-neutral-200">
      <p className="mb-1 text-xs font-semibold tracking-wide text-neutral-400 uppercase">{section.name}</p>
      <ul className="-mb-px flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {section.tabs.map((tab) => {
          const isActive = active?.href === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "inline-block border-b-2 border-brand-blue pb-2 font-semibold text-brand-blue"
                    : "inline-block pb-2 text-neutral-500 hover:text-neutral-800"
                }
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
