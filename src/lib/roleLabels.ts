import type { RoleSlug } from "@/authorization";

export const ROLE_LABELS: Record<RoleSlug, string> = {
  student: "Aluno",
  teacher: "Professor",
  coordinator: "Coordenação",
  admin: "Administrador",
  content_editor: "Editor de conteúdo",
};

export const ROLE_DESCRIPTIONS: Record<RoleSlug, string> = {
  student: "Acompanhar meus volumes, aulas e atividades.",
  teacher: "Gerenciar minhas turmas e registrar frequência.",
  coordinator: "Gestão acadêmica da Escola Makários.",
  admin: "Administração completa da plataforma.",
  content_editor: "Criar e editar conteúdos e avaliações.",
};
