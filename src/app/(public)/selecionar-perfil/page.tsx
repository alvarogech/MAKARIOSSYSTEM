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

  // Só um perfil possível — nada para escolher, mesmo que "Trocar perfil"
  // tenha sido clicado explicitamente. Com 2+ perfis, sempre mostra a
  // seleção (mesmo já havendo um perfil ativo via cookie), para que
  // "Trocar perfil" funcione.
  if (authContext.roles.length === 1) {
    redirect("/dashboard");
  }

  return <SelectRoleForm roles={authContext.roles} />;
}
