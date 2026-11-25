import { createHmac, timingSafeEqual } from "node:crypto";
import type { IduraMethod } from "@/lib/velio/idura-claims";

export type IduraTransaction = {
  state: string;
  nonce: string;
  codeVerifier: string;
  acr: string;
  method: IduraMethod;
};

const TTL_MS = 10 * 60 * 1000;

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** HttpOnly cookie payload. Holds PKCE/state/nonce only — never the client secret or personnummer. */
export function sealIduraTransaction(tx: IduraTransaction, secret: string, now = Date.now()): string {
  const body = Buffer.from(
    JSON.stringify({
      state: tx.state,
      nonce: tx.nonce,
      codeVerifier: tx.codeVerifier,
      acr: tx.acr,
      method: tx.method,
      exp: now + TTL_MS,
    }),
  ).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function openIduraTransaction(sealed: string, secret: string, now = Date.now()): IduraTransaction {
  const dot = sealed.lastIndexOf(".");
  if (dot <= 0) throw new Error("invalid_tx");
  const body = sealed.slice(0, dot);
  const sig = sealed.slice(dot + 1);
  if (!safeEqual(sig, sign(body, secret))) throw new Error("invalid_tx");
  let parsed: {
    state?: unknown;
    nonce?: unknown;
    codeVerifier?: unknown;
    acr?: unknown;
    method?: unknown;
    exp?: unknown;
  };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as typeof parsed;
  } catch {
    throw new Error("invalid_tx");
  }
  if (typeof parsed.exp !== "number" || parsed.exp < now) throw new Error("expired_tx");
  if (
    typeof parsed.state !== "string" ||
    typeof parsed.nonce !== "string" ||
    typeof parsed.codeVerifier !== "string" ||
    typeof parsed.acr !== "string" ||
    (parsed.method !== "bankid" && parsed.method !== "bankid-qr" && parsed.method !== "freja")
  ) {
    throw new Error("invalid_tx");
  }
  return {
    state: parsed.state,
    nonce: parsed.nonce,
    codeVerifier: parsed.codeVerifier,
    acr: parsed.acr,
    method: parsed.method,
  };
}
