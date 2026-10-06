import type { Metadata } from "next";
import { AccessRescueForm } from "@/modules/enrollment/components/AccessRescueForm";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function AcessoPage() {
  return <AccessRescueForm />;
}
