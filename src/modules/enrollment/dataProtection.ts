import "server-only";

import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { getEnrollmentDataKey } from "@/lib/serverEnv";

function getKey(): Buffer {
  const key = Buffer.from(getEnrollmentDataKey(), "base64");
  if (key.length !== 32) {
    throw new Error("ENROLLMENT_DATA_KEY precisa conter exatamente 32 bytes em base64.");
  }
  return key;
}

export function protectCpf(cpf: string): {
  encrypted: string;
  hash: string;
  last4: string;
} {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(cpf, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: [iv, tag, encrypted].map((part) => part.toString("base64url")).join("."),
    hash: createHmac("sha256", key).update(cpf).digest("hex"),
    last4: cpf.slice(-4),
  };
}


/** Mesmo hash gravado em `enrollment_requests.cpf_hash` (só dígitos). */
export function hashCpf(cpf: string): string {
  return createHmac("sha256", getKey()).update(cpf).digest("hex");
}

/**
 * Assinatura do cookie que faz o celular lembrar o aluno na chamada por QR
 * (evita digitar o CPF toda vez). Só o id da inscrição, assinado: não dá
 * para trocar por outro id sem a chave do servidor.
 */
export function signAttendanceDevice(enrollmentRequestId: string): string {
  const mac = createHmac("sha256", getKey()).update(`presenca:${enrollmentRequestId}`).digest("base64url");
  return `${enrollmentRequestId}.${mac}`;
}

export function verifyAttendanceDevice(value: string | undefined): string | null {
  if (!value) return null;
  const [id, mac] = value.split(".");
  if (!id || !mac) return null;
  return signAttendanceDevice(id) === value ? id : null;
}
