import type { AuthContext, PermissionCheck, RoleSlug } from "./types";

/**
 * Camada de políticas tipada — única fonte de decisão de autorização do
 * lado da aplicação (chamada em toda Server Action/Route Handler antes de
 * qualquer leitura/escrita sensível). Reforçada por RLS no Postgres, nunca
 * substituída por ela: RLS protege contra acesso direto à API; esta
 * camada expressa regras de negócio (ex.: "admin herda o que coordenação
 * pode", "usuário suspenso perde acesso") que fazem mais sentido perto do
 * domínio do que espalhadas em policies SQL.
 *
 * Zod não participa desta camada — ele valida formato de dado em outro
 * lugar (Server Actions), nunca decide permissão.
 */

/**
 * Perfis cujo `activeRole` satisfaz cada verificação de área/recurso.
 * `admin` é incluído explicitamente onde a documentação de perfis afirma
 * que o administrador "possui todas as permissões da coordenação" — não é
 * uma regra genérica de hierarquia, é caso a caso, espelhando
 * PLANO_TECNICO.md seção 3.
 */
const ALLOWED_ACTIVE_ROLES: Record<string, RoleSlug[]> = {
  "profile:read_any": ["coordinator", "admin"],
  "profile:suspend": ["admin"],
  "user_roles:manage": ["admin"],
  "invitations:create": ["coordinator", "admin"],
  "invitations:read": ["coordinator", "admin"],
  "audit_logs:read": ["admin"],
  "enrollments:manage": ["coordinator", "admin"],
  "volumes:manage": ["coordinator", "admin"],
  "seasons:manage": ["coordinator", "admin"],
  "offerings:manage": ["coordinator", "admin"],
  "classes:manage": ["coordinator", "admin"],
  "class_meetings:manage": ["coordinator", "admin"],
  "teacher_assignments:manage": ["coordinator", "admin"],
  "prerequisite_exceptions:create": ["coordinator", "admin"],
  "prerequisite_exceptions:read": ["coordinator", "admin"],
  "imports:create": ["coordinator", "admin"],
  "imports:read": ["coordinator", "admin"],
  "area:student": ["student"],
  "area:teacher": ["teacher"],
  "area:coordination": ["coordinator", "admin"],
  "area:admin": ["admin"],
  "area:content_editor": ["content_editor"],
};

function checkKey(check: PermissionCheck): string {
  return `${check.resource}:${check.action}`;
}

/**
 * Verdadeiro se `activeRole` está entre os perfis que o usuário
 * efetivamente possui (`roles`). Uma sessão nunca deve conseguir agir como
 * um perfil que a conta não tem — se isso acontecer, é sinal de estado
 * inconsistente (cookie adulterado, perfil removido após a seleção), e a
 * resposta correta é negar, não tentar "corrigir" silenciosamente.
 */
function hasActiveRoleAssigned(context: AuthContext): boolean {
  return context.activeRole !== null && context.roles.includes(context.activeRole);
}

export function can(context: AuthContext, check: PermissionCheck): boolean {
  // Conta suspensa: nenhuma ação é permitida pela camada de aplicação,
  // independentemente do perfil. A tela de "conta suspensa" não passa por
  // esta função — ela é o destino quando `can()` nega o acesso.
  if (context.profileStatus !== "active") {
    return false;
  }

  // Nunca confiar em um `activeRole` que a conta não possui de fato.
  if (context.activeRole !== null && !hasActiveRoleAssigned(context)) {
    return false;
  }

  switch (check.resource) {
    case "profile": {
      if (check.action === "read_own" || check.action === "update_own") {
        return check.targetUserId === context.userId;
      }
      break;
    }
    case "user_roles": {
      if (check.action === "read_own") {
        return check.targetUserId === context.userId;
      }
      break;
    }
  }

  const allowedRoles = ALLOWED_ACTIVE_ROLES[checkKey(check)];
  if (!allowedRoles) {
    // Verificação desconhecida: nega por padrão (fail closed).
    return false;
  }

  return context.activeRole !== null && allowedRoles.includes(context.activeRole);
}

/**
 * Atalho para checagens de "esta rota/área pode ser acessada pelo perfil
 * ativo?" — usado pelos layouts de cada área protegida
 * (`src/app/(app)/...`).
 */
export function canAccessArea(
  context: AuthContext,
  area: "student" | "teacher" | "coordination" | "admin" | "content_editor",
): boolean {
  return can(context, { resource: "area", action: area });
}
