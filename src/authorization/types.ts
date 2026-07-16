import type { RoleSlug } from "@/integrations/supabase/types";

export type { RoleSlug };

export type ProfileStatus = "active" | "suspended";

/**
 * Contexto de autorização de uma requisição. Construído inteiramente a
 * partir de dados lidos no servidor (sessão do Supabase Auth + tabelas
 * `profiles`/`user_roles`) — nunca a partir de algo que o cliente possa
 * declarar sem checagem (ver `src/authorization/session.ts`).
 */
export interface AuthContext {
  userId: string;
  fullName: string;
  profileStatus: ProfileStatus;
  /** Perfis globais que o usuário de fato possui (user_roles), não o que ele *diz* ter. */
  roles: RoleSlug[];
  /**
   * Perfil ativo da sessão atual (selecionado em `/selecionar-perfil` ou
   * único perfil possível). `null` se a conta ainda não escolheu um perfil
   * ativo (ex.: tem mais de um perfil e ainda não passou pela seleção).
   */
  activeRole: RoleSlug | null;
}

export type PermissionCheck =
  | { resource: "profile"; action: "read_own"; targetUserId: string }
  | { resource: "profile"; action: "update_own"; targetUserId: string }
  | { resource: "profile"; action: "read_any" }
  | { resource: "profile"; action: "suspend" }
  | { resource: "user_roles"; action: "read_own"; targetUserId: string }
  | { resource: "user_roles"; action: "manage" }
  | { resource: "invitations"; action: "create" }
  | { resource: "invitations"; action: "read" }
  | { resource: "audit_logs"; action: "read" }
  | { resource: "enrollments"; action: "manage" }
  | { resource: "volumes"; action: "manage" }
  | { resource: "seasons"; action: "manage" }
  | { resource: "offerings"; action: "manage" }
  | { resource: "classes"; action: "manage" }
  | { resource: "class_meetings"; action: "manage" }
  | { resource: "teacher_assignments"; action: "manage" }
  | { resource: "prerequisite_exceptions"; action: "create" }
  | { resource: "prerequisite_exceptions"; action: "read" }
  | { resource: "imports"; action: "create" }
  | { resource: "imports"; action: "read" }
  | { resource: "content"; action: "manage" }
  | { resource: "question_bank"; action: "manage" }
  | { resource: "activities"; action: "manage" }
  | { resource: "release_rules"; action: "manage" }
  | { resource: "area"; action: "student" }
  | { resource: "area"; action: "teacher" }
  | { resource: "area"; action: "coordination" }
  | { resource: "area"; action: "admin" }
  | { resource: "area"; action: "content_editor" };
