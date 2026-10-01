import type { Metadata } from "next";
import { getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";

export const metadata: Metadata = { title: "Frequência" };

/**
 * Registrar frequência deixou de ser tarefa do professor — a coordenação
 * assume isso (chamada planejada por QR code, aluno marcando a própria
 * presença). A rota continua existindo só para não quebrar um link antigo
 * salvo; nenhuma tela do professor aponta mais para cá.
 */
export default async function FrequenciaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  return (
    <AccessDenied description="Registrar frequência não é mais uma tarefa do professor — a coordenação cuida disso." />
  );
}
