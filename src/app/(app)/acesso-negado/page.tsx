import type { Metadata } from "next";
import { AccessDenied } from "@/components/feedback/AccessDenied";

export const metadata: Metadata = { title: "Acesso não permitido" };

export default function AcessoNegadoPage() {
  return <AccessDenied />;
}
