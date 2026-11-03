import "server-only";

import { can, getAuthContext, type AuthContext } from "@/authorization";

export interface GraduationState {
  error?: string;
  success?: string;
}

export type GraduationAction = "view" | "contact" | "validate_history" | "configure" | "record_rsvp" | "export";

const DENIED: Record<GraduationAction, string> = {
  view: "Você não tem permissão para ver a Central de Formatura.",
  contact: "Você não tem permissão para registrar contatos de formatura.",
  validate_history: "Apenas o administrador pode validar ou revogar histórico acadêmico.",
  configure: "Você não tem permissão para configurar a formatura.",
  record_rsvp: "Você não tem permissão para registrar respostas ou comparecimento.",
  export: "Você não tem permissão para exportar listas de formatura.",
};

/** A checagem de permissão no SERVIDOR: toda ação da Central passa por aqui antes de tocar no banco. */
export async function requireGraduation(action: GraduationAction): Promise<{ auth: AuthContext } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Sessão expirada. Entre de novo." };
  if (!can(auth, { resource: "graduation", action })) return { error: DENIED[action] };
  return { auth };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
