import { Poppins } from "next/font/google";

/**
 * Substituta temporária de Heuvel Grotesk (fonte da marca, sem licença de
 * uso web confirmada) — ver docs/design-system.md. Auto-hospedada pelo
 * Next.js via next/font/google; nenhum arquivo de fonte de terceiros é
 * redistribuído neste repositório.
 */
export const brandFont = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-brand",
  display: "swap",
});
