import type { Metadata, Viewport } from "next";
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
    "Ambiente digital de apoio ao ensino e à gestão acadêmica da Escola Makários, Igreja Emaús.",
  // manifest.ts (gerado em /manifest.webmanifest) + os ícones abaixo são o
  // que permite "Adicionar à tela de início"/instalar como app no celular
  // (Android via o manifest; iOS Safari via apple-touch-icon +
  // apple-mobile-web-app-* no viewport/meta abaixo).
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Makários",
  },
};

export const viewport: Viewport = {
  themeColor: "#2e7fbf",
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
