import Image from "next/image";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="flex items-center justify-center bg-brand-blue px-8 py-12 md:w-2/5">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/brand/logo-makarios-oficial.png"
            alt="Makários — Escola Makários, Igreja Emaús"
            width={280}
            height={90}
            priority
          />
          <p className="max-w-xs text-sm text-brand-cream/80">
            Plataforma de Ensino da Escola Makários
          </p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center bg-neutral-50 px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
