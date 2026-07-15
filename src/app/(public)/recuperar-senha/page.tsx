import type { Metadata } from "next";
import { RequestPasswordResetForm } from "@/modules/auth/components/RequestPasswordResetForm";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return <RequestPasswordResetForm />;
}
