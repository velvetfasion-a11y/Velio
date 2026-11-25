import { createHmac, randomBytes } from "crypto";
import { env } from "@/lib/velio/auth-config";

export function serverSecret(): string {
  const fromEnv = env("AUTH_SECRET") || env("SESSION_SECRET");
  if (fromEnv) return fromEnv;
  // Ephemeral per process — BankID cookies won't survive restarts, which is fine for local.
  const g = globalThis as typeof globalThis & { __velioAuthSecret?: string };
  g.__velioAuthSecret ??= randomBytes(32).toString("hex");
  return g.__velioAuthSecret;
}

export function signValue(value: string, ttlSec = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const body = `${value}.${exp}`;
  const sig = createHmac("sha256", serverSecret()).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function verifySignedValue(token: string, expectedValue?: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [value, expStr, sig] = parts;
  if (!value || !expStr || !sig) return false;
  if (expectedValue && value !== expectedValue) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const body = `${value}.${expStr}`;
  const expected = createHmac("sha256", serverSecret()).update(body).digest("hex");
  if (expected.length !== sig.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) ok |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return ok === 0;
}
