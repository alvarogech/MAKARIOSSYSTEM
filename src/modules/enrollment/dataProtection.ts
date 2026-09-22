import "server-only";

import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { getEnrollmentDataKey } from "@/lib/env";

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

