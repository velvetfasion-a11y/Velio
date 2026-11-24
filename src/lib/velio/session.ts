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

export async function listAccounts(provider?: AuthProvider): Promise<Account[]> {
  const rows = provider
    ? await sql<AccountRow>(
        `select id, provider, name, email, phone, provider_id, account_mode
         from accounts where provider = $1
         order by created_at asc, name asc`,
        [provider],
      )
    : await sql<AccountRow>(
        `select id, provider, name, email, phone, provider_id, account_mode
         from accounts
         order by created_at asc, name asc`,
      );
  return rows.map(mapAccount);
}

async function createSession(accountId: string): Promise<string> {
  const token = randomUUID();
  const expires = new Date(Date.now() + DAY_MS).toISOString();
  await sql(`insert into sessions (token, account_id, expires_at) values ($1, $2, $3)`, [
    token,
    accountId,
    expires,
  ]);
  return token;
}

export async function loginWithAccountId(accountId: string): Promise<{ account: Account; token: string }> {
  const account = await getAccountById(accountId);
  if (!account) throw new Error("unknown_account");
  const token = await createSession(account.id);
  return { account, token };
}

/** Legacy helper: log into the first account for a provider if exactly one exists. */
export async function loginWithProvider(provider: AuthProvider): Promise<{ account: Account; token: string }> {
  const accounts = await listAccounts(provider);
  if (!accounts.length) throw new Error("unknown_provider");
  return loginWithAccountId(accounts[0]!.id);
}

export async function createAccount(input: {
  provider: AuthProvider;
  name: string;
  email: string;
  phone: string;
  accountMode?: "customer" | "business";
}): Promise<{ account: Account; token: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (name.length < 2) throw new Error("invalid_name");
  if (email.length < 5 || !email.includes("@")) throw new Error("invalid_email");
  if (phone.length < 6) throw new Error("invalid_phone");

  const id = `acc-${randomUUID().slice(0, 8)}`;
  const mode = input.accountMode === "business" ? "business" : "customer";
  await sql(
    `insert into accounts (id, provider, name, email, phone, provider_id, account_mode)
     values ($1, $2, $3, $4, $5, null, $6)`,
    [id, input.provider, name, email, phone, mode],
  );
  return loginWithAccountId(id);
}

export async function updateAccount(
  accountId: string,
  patch: {
    name?: string;
    email?: string;
    phone?: string;
    accountMode?: "customer" | "business";
    providerId?: string | null;
  },
): Promise<Account> {
  const current = await getAccountById(accountId);
  if (!current) throw new Error("unknown_account");
  const name = patch.name?.trim() || current.name;
  const email = patch.email?.trim().toLowerCase() || current.email;
  const phone = patch.phone?.trim() || current.phone;
  const mode = patch.accountMode ?? current.accountMode;
  const providerId = patch.providerId === undefined ? current.providerId : patch.providerId;
  await sql(
    `update accounts
     set name = $2, email = $3, phone = $4, account_mode = $5, provider_id = $6
     where id = $1`,
    [accountId, name, email, phone, mode, providerId],
  );
  const updated = await getAccountById(accountId);
  if (!updated) throw new Error("unknown_account");
  return updated;
}

export async function destroySession(request: Request): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;
  await sql(`delete from sessions where token = $1`, [token]);
}
