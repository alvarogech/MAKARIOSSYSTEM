import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import type { RoleSlug } from "@/authorization";
import { signOut } from "@/modules/auth/actions/signOut";
import { buttonVariants } from "@/components/ui/Button";
import { ROLE_LABELS } from "@/lib/roleLabels";

export interface NavLink {
  href: string;
  label: string;
}

export function AppShell({
  fullName,
  activeRole,
  hasMultipleRoles,
  navLinks,
  children,
}: {
  fullName: string;
  activeRole: RoleSlug | null;
  hasMultipleRoles: boolean;
  navLinks: NavLink[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/brand/logo-makarios-oficial-azul.png"
              alt="Makários"
              width={40}
              height={13}
              className="h-6 w-auto rounded-sm bg-brand-blue px-1.5 py-1"
            />
          </Link>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-900">{fullName}</p>
              {activeRole ? (
                <p className="text-xs text-neutral-500">
                  {ROLE_LABELS[activeRole]}
                </p>
              ) : null}
            </div>

            {hasMultipleRoles ? (
              <Link
                href="/selecionar-perfil"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Trocar perfil
              </Link>
            ) : null}

            <form action={signOut}>
              <button
                type="submit"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        {navLinks.length > 0 ? (
          <nav className="border-t border-neutral-100 bg-neutral-50">
            <div className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-1 px-4 py-2 text-sm sm:px-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-neutral-600 hover:text-brand-blue hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
