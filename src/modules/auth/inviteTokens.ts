import "server-only";

import { randomBytes, createHash } from "node:crypto";

/**
 * Token do link manual de convite/recuperação. O valor bruto só existe em
 * memória pelo tempo de uma requisição — só o hash (sha256 hex) é
 * persistido em `invitations.token_hash`. Um vazamento do banco nunca
 * expõe um link utilizável.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
