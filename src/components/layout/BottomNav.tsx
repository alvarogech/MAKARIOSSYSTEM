"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Users, type LucideIcon } from "lucide-react";
import type { NavLink } from "./AppShell";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": Home,
  "/professor/agenda": CalendarDays,
  "/professor/turmas": Users,
};

/** Barra inferior fixa no celular (alvos de toque de 56px). Só aparece abaixo de md; o menu do topo cobre telas maiores. */
export function BottomNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const items = links.filter((l) => ICONS[l.href]);
  if (items.length === 0) return null;

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((link) => {
          const Icon = ICONS[link.href]!;
          const active = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-brand-blue ${
                  active ? "text-brand-blue" : "text-neutral-500"
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
