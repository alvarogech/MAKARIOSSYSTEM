import type { Metadata } from "next";
import Image from "next/image";
import { HelpRequestForm } from "@/modules/support/components/HelpRequestForm";

export const metadata: Metadata = { title: "Ajuda", robots: { index: false } };

export default function AjudaPage() {
  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="flex justify-center bg-brand-blue px-4 py-5">
        <Image src="/brand/logo-makarios-oficial.png" alt="Escola Makarios, Igreja Emaús" width={160} height={51} priority />
      </header>
      <main className="mx-auto max-w-md px-4 py-6">
        <HelpRequestForm />
      </main>
    </div>
  );
}
