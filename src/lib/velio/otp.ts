import { createHash, randomBytes, randomInt } from "crypto";
import { sql } from "@/lib/db";
import { emailConfigured, env, smsConfigured } from "@/lib/velio/auth-config";

export type ChallengeKind = "email" | "sms" | "bankid" | "passport";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("07") && digits.length === 10) return `+46${digits.slice(1)}`;
  if (digits.startsWith("46") && !digits.startsWith("+")) return `+${digits}`;
  return digits;
}

export async function createChallenge(input: {
  kind: ChallengeKind;
  target: string;
  code?: string;
  payload?: Record<string, unknown>;
  ttlMinutes?: number;
}): Promise<{ id: string; code: string; expiresAt: string }> {
  const id = `chal_${randomBytes(12).toString("hex")}`;
  const code = input.code ?? String(randomInt(100000, 999999));
  const ttl = input.ttlMinutes ?? 10;
  const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();
  await sql(
    `insert into auth_challenges (id, kind, target, code_hash, payload, expires_at)
     values ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)`,
    [id, input.kind, input.target, hashCode(code), JSON.stringify(input.payload ?? {}), expiresAt],
  );
  return { id, code, expiresAt };
}

export async function verifyChallenge(input: {
  id: string;
  kind: ChallengeKind;
  code: string;
}): Promise<{ ok: true; target: string; payload: Record<string, unknown> } | { ok: false; error: string }> {
  const rows = await sql<{
    id: string;
    kind: string;
    target: string;
    code_hash: string;
    payload: Record<string, unknown> | string;
    attempts: number;
    expires_at: string;
    consumed_at: string | null;
  }>(
    `select id, kind, target, code_hash, payload, attempts, expires_at, consumed_at
     from auth_challenges
     where id = $1 and kind = $2
     limit 1`,
    [input.id, input.kind],
  );
  const row = rows[0];
  if (!row) return { ok: false, error: "Ogiltig verifieringskod." };
  if (row.consumed_at) return { ok: false, error: "Koden har redan använts." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Koden har gått ut. Begär en ny." };
  }
  if (row.attempts >= 5) return { ok: false, error: "För många försök. Begär en ny kod." };

  await sql(`update auth_challenges set attempts = attempts + 1 where id = $1`, [row.id]);

  if (row.code_hash !== hashCode(input.code.trim())) {
    return { ok: false, error: "Fel kod. Försök igen." };
  }

  await sql(`update auth_challenges set consumed_at = now() where id = $1`, [row.id]);
  const payload =
    typeof row.payload === "string" ? (JSON.parse(row.payload) as Record<string, unknown>) : row.payload || {};
  return { ok: true, target: row.target, payload };
}

export async function sendEmailCode(to: string, code: string): Promise<{ delivered: boolean }> {
  if (!emailConfigured()) {
    throw new Error("E-postleverans är inte konfigurerad.");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env("EMAIL_FROM"),
      to: [to],
      subject: "Din VELIO-verifieringskod",
      text: `Din kod är ${code}. Den gäller i 10 minuter.\n\nOm du inte begärde koden kan du ignorera detta meddelande.`,
      html: `<p>Din VELIO-verifieringskod är <strong style="font-size:20px;letter-spacing:2px">${code}</strong>.</p><p>Koden gäller i 10 minuter.</p>`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Kunde inte skicka e-post (${res.status}): ${detail.slice(0, 200)}`);
  }
  return { delivered: true };
}

export async function sendSmsCode(to: string, code: string): Promise<{ delivered: boolean }> {
  if (!smsConfigured()) {
    throw new Error("SMS-leverans är inte konfigurerad.");
  }
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM_NUMBER");
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: `VELIO: Din kod är ${code}. Gäller 10 minuter.`,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Kunde inte skicka SMS (${res.status}): ${detail.slice(0, 200)}`);
  }
  return { delivered: true };
}
