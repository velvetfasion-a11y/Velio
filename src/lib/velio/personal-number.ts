import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Swedish personnummer / samordningsnummer as digits only (10 or 12).
 * Returns null when the value is missing or not that shape. Never logs the input.
 */
export function normalizePersonalNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 12) return null;
  return digits;
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(`velio-pn-enc:${secret}`).digest();
}

/** AES-256-GCM ciphertext. The lookup hash is separate so we can match without decrypting. */
export function encryptPersonalNumber(personalNumber: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const enc = Buffer.concat([cipher.update(personalNumber, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptPersonalNumber(payload: string, secret: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("invalid_personal_number_enc");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
  const normalized = normalizePersonalNumber(plain);
  if (!normalized) throw new Error("invalid_personal_number_enc");
  return normalized;
}

/** Keyed hash for finding the same person again. Not reversible without the server secret. */
export function personalNumberLookupHash(personalNumber: string, secret: string): string {
  return createHmac("sha256", secret).update(`velio-pn:${personalNumber}`).digest("hex");
}
