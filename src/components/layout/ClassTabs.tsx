"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "", label: "Visão" },
  { slug: "escala", label: "Escala" },
  { slug: "alunos", label: "Alunos" },
  { slug: "presenca", label: "Presença" },
  { slug: "relatorios", label: "Relatórios" },
  { slug: "materiais", label: "Materiais" },
  { slug: "avisos", label: "Avisos" },
];

/** Abas do hub de uma turma. */
export function ClassTabs({ classId }: { classId: string }) {
  const pathname = usePathname();
  const base = `/coordenacao/turmas/${classId}`;
  return (
    <nav aria-label="Abas da turma" className="mb-4 border-b border-neutral-200">
      <ul className="-mb-px flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {TABS.map((tab) => {
          const href = tab.slug ? `${base}/${tab.slug}` : base;
          const active = tab.slug ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base;
          return (
            <li key={tab.slug || "visao"}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
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
