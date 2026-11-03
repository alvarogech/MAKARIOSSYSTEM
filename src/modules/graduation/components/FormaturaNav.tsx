"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/coordenacao/formatura", label: "Visão geral", exact: true },
  { href: "/coordenacao/formatura/regularizacao", label: "Regularização" },
  { href: "/coordenacao/formatura/cerimonia", label: "Cerimônia" },
  { href: "/coordenacao/formatura/relatorios", label: "Relatórios" },
] as const;

/** Abas da Central de Formatura. Mantêm a edição escolhida (?edicao=) ao trocar de aba. */
export function FormaturaNav() {
  const pathname = usePathname();
  const edition = useSearchParams().get("edicao");
  const suffix = edition ? `?edicao=${encodeURIComponent(edition)}` : "";

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-neutral-200 px-1" aria-label="Seções da Central de Formatura">
      {TABS.map((tab) => {
        const active = "exact" in tab ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={`${tab.href}${suffix}`}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "border-brand-blue text-brand-blue" : "border-transparent text-neutral-600 hover:text-brand-blue"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
