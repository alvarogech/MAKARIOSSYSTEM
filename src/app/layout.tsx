import type { Metadata } from "next";
import { brandFont } from "@/lib/fonts";
import "./globals.css";

// Toda a aplicação depende de uma sessão do Supabase Auth lida a cada
// requisição (cookies) — não faz sentido nem é seguro pré-renderizar
// nenhuma rota estaticamente em build. Forçar aqui, na raiz, evita
// depender de detecção implícita por rota.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Plataforma Makários",
    template: "%s | Plataforma Makários",
  },
  description:
    "Ambiente digital de apoio ao ensino e à gestão acadêmica da Escola Makários — Igreja Emaús.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={brandFont.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
