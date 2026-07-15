import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/authorization";
import { SelectRoleForm } from "@/modules/profile/components/SelectRoleForm";
import { SuspendedAccount } from "@/components/feedback/SuspendedAccount";

export const metadata: Metadata = { title: "Selecionar perfil" };

export default async function SelecionarPerfilPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  if (authContext.profileStatus !== "active") {
    return <SuspendedAccount />;
  }

  if (authContext.roles.length === 0) {
    redirect("/acesso-negado");
  }

  // Já resolvido (cookie válido ou perfil único) — nada para escolher.
  if (authContext.activeRole) {
    redirect("/dashboard");
  }

  return <SelectRoleForm roles={authContext.roles} />;
}
