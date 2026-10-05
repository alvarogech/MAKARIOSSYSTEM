import "server-only";

import { randomBytes, createHash, createHmac } from "node:crypto";
import { getCronSecret } from "@/lib/serverEnv";

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

/**
 * Token estável do convite de aluno: HMAC(segredo, id do convite). Como o
 * valor bruto não é guardado, um token aleatório só podia ir num e-mail — cada
 * lembrete trocava o token e matava o link dos e-mails anteriores ("link não
 * é válido"). Derivando do id, todo e-mail (inicial, lembrete, reenvio) leva
 * o MESMO link, e o banco continua guardando só o hash.
 */
export function deriveStudentInviteToken(invitationId: string): string {
  return createHmac("sha256", getCronSecret()).update(`student-invite:${invitationId}`).digest("base64url");
}
