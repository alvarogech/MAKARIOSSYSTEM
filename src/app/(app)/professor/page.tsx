import { redirect } from "next/navigation";

/** O painel do professor agora é o Início (/dashboard). A rota fica só para links antigos. */
export default function ProfessorHomeRedirect() {
  redirect("/dashboard");
}
