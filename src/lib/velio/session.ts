import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";

export type AuthProvider = "bankid" | "google" | "apple" | "phone";

export type Account = {
  id: string;
  provider: string;
  name: string;
  email: string;
  phone: string;
  providerId: string | null;
  accountMode: "customer" | "business";
};

type AccountRow = {
  id: string;
  provider: string;
  name: string;
  email: string;
  phone: string;
  provider_id: string | null;
  account_mode: string;
};

const COOKIE = "velio_sid";
const DAY_MS = 1000 * 60 * 60 * 24 * 30;

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    email: row.email,
    phone: row.phone,
    providerId: row.provider_id,
    accountMode: row.account_mode === "business" ? "business" : "customer",
  };
}

export function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)velio_sid=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function sessionCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 30): string {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function getAccountBySession(request: Request): Promise<Account | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const rows = await sql<AccountRow>(
    `select a.id, a.provider, a.name, a.email, a.phone, a.provider_id, a.account_mode
     from sessions s
     join accounts a on a.id = s.account_id
     where s.token = $1 and s.expires_at > now()`,
    [token],
  );
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function getAccountByProviderId(providerId: string): Promise<Account | null> {
  const rows = await sql<AccountRow>(
    `select id, provider, name, email, phone, provider_id, account_mode
     from accounts where provider_id = $1 limit 1`,
    [providerId],
  );
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function getAccountById(id: string): Promise<Account | null> {
  const rows = await sql<AccountRow>(
    `select id, provider, name, email, phone, provider_id, account_mode
     from accounts where id = $1`,
    [id],
  );
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function loginWithProvider(provider: AuthProvider): Promise<{ account: Account; token: string }> {
  const rows = await sql<AccountRow>(
    `select id, provider, name, email, phone, provider_id, account_mode
     from accounts where provider = $1 limit 1`,
    [provider],
  );
  const row = rows[0];
  if (!row) {
    throw new Error("unknown_provider");
  }
  const account = mapAccount(row);
  const token = randomUUID();
  const expires = new Date(Date.now() + DAY_MS).toISOString();
  await sql(`insert into sessions (token, account_id, expires_at) values ($1, $2, $3)`, [
    token,
    account.id,
    expires,
  ]);
  return { account, token };
}

export async function destroySession(request: Request): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;
  await sql(`delete from sessions where token = $1`, [token]);
}
