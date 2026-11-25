import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";

export type AuthProvider = "bankid" | "google" | "apple" | "phone" | "email";

export type Account = {
  id: string;
  provider: string;
  name: string;
  email: string;
  phone: string;
  providerId: string | null;
  accountMode: "customer" | "business";
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  idMethod: string | null;
  googleSub: string | null;
};

type AccountRow = {
  id: string;
  provider: string;
  name: string;
  email: string;
  phone: string;
  provider_id: string | null;
  account_mode: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  id_verified?: boolean;
  id_method?: string | null;
  google_sub?: string | null;
};

const COOKIE = "velio_sid";
const DAY_MS = 1000 * 60 * 60 * 24 * 30;

const ACCOUNT_SELECT = `id, provider, name, email, phone, provider_id, account_mode,
  coalesce(email_verified, false) as email_verified,
  coalesce(phone_verified, false) as phone_verified,
  coalesce(id_verified, false) as id_verified,
  id_method, google_sub`;

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    email: row.email,
    phone: row.phone,
    providerId: row.provider_id,
    accountMode: row.account_mode === "business" ? "business" : "customer",
    emailVerified: Boolean(row.email_verified),
    phoneVerified: Boolean(row.phone_verified),
    idVerified: Boolean(row.id_verified),
    idMethod: row.id_method ?? null,
    googleSub: row.google_sub ?? null,
  };
}

export function accountPublic(account: Account) {
  return {
    id: account.id,
    provider: account.provider,
    name: account.name,
    email: account.email,
    phone: account.phone,
    providerId: account.providerId,
    accountMode: account.accountMode,
    emailVerified: account.emailVerified,
    phoneVerified: account.phoneVerified,
    idVerified: account.idVerified,
    idMethod: account.idMethod,
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
    `select a.id, a.provider, a.name, a.email, a.phone, a.provider_id, a.account_mode,
            coalesce(a.email_verified, false) as email_verified,
            coalesce(a.phone_verified, false) as phone_verified,
            coalesce(a.id_verified, false) as id_verified,
            a.id_method, a.google_sub
     from sessions s
     join accounts a on a.id = s.account_id
     where s.token = $1 and s.expires_at > now()`,
    [token],
  );
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function getAccountByProviderId(providerId: string): Promise<Account | null> {
  const rows = await sql<AccountRow>(
    `select ${ACCOUNT_SELECT} from accounts where provider_id = $1 limit 1`,
    [providerId],
  );
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function getAccountById(id: string): Promise<Account | null> {
  const rows = await sql<AccountRow>(`select ${ACCOUNT_SELECT} from accounts where id = $1`, [id]);
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function getAccountByGoogleSub(sub: string): Promise<Account | null> {
  const rows = await sql<AccountRow>(`select ${ACCOUNT_SELECT} from accounts where google_sub = $1 limit 1`, [sub]);
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function getAccountByEmail(email: string): Promise<Account | null> {
  const rows = await sql<AccountRow>(
    `select ${ACCOUNT_SELECT} from accounts where lower(email) = lower($1) order by created_at asc limit 1`,
    [email],
  );
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function getAccountByPhone(phone: string): Promise<Account | null> {
  const rows = await sql<AccountRow>(
    `select ${ACCOUNT_SELECT} from accounts where phone = $1 order by created_at asc limit 1`,
    [phone],
  );
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function listAccounts(provider?: AuthProvider): Promise<Account[]> {
  const rows = provider
    ? await sql<AccountRow>(
        `select ${ACCOUNT_SELECT} from accounts where provider = $1 order by created_at asc, name asc`,
        [provider],
      )
    : await sql<AccountRow>(`select ${ACCOUNT_SELECT} from accounts order by created_at asc, name asc`);
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
  emailVerified?: boolean;
  phoneVerified?: boolean;
  idVerified?: boolean;
  idMethod?: string | null;
  googleSub?: string | null;
  providerId?: string | null;
}): Promise<{ account: Account; token: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (name.length < 2) throw new Error("invalid_name");
  if (email && (email.length < 5 || !email.includes("@"))) throw new Error("invalid_email");
  if (!email && input.provider !== "phone" && input.provider !== "bankid") throw new Error("invalid_email");
  if (phone.length < 6 && input.provider === "phone") throw new Error("invalid_phone");

  const wantsBusiness = input.accountMode === "business";
  const idVerified = Boolean(input.idVerified);
  if (wantsBusiness && !idVerified) throw new Error("id_verification_required");

  const id = `acc-${randomUUID().slice(0, 8)}`;
  const mode = wantsBusiness && idVerified ? "business" : "customer";
  await sql(
    `insert into accounts (
       id, provider, name, email, phone, provider_id, account_mode,
       email_verified, phone_verified, id_verified, id_method, google_sub
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      input.provider,
      name,
      email || `${id}@users.velio.local`,
      phone || "",
      input.providerId ?? null,
      mode,
      Boolean(input.emailVerified),
      Boolean(input.phoneVerified),
      idVerified,
      input.idMethod ?? null,
      input.googleSub ?? null,
    ],
  );
  return loginWithAccountId(id);
}

export async function upsertGoogleAccount(input: {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
}): Promise<{ account: Account; token: string }> {
  const existing = await getAccountByGoogleSub(input.sub);
  if (existing) {
    await sql(
      `update accounts set email = $2, name = coalesce(nullif($3,''), name), email_verified = $4, provider = 'google'
       where id = $1`,
      [existing.id, input.email, input.name, input.emailVerified],
    );
    return loginWithAccountId(existing.id);
  }

  const byEmail = await getAccountByEmail(input.email);
  if (byEmail) {
    await sql(
      `update accounts set google_sub = $2, email_verified = true, provider = 'google', name = coalesce(nullif($3,''), name)
       where id = $1`,
      [byEmail.id, input.sub, input.name],
    );
    return loginWithAccountId(byEmail.id);
  }

  return createAccount({
    provider: "google",
    name: input.name,
    email: input.email,
    phone: "",
    emailVerified: input.emailVerified,
    googleSub: input.sub,
  });
}

export async function loginOrCreateVerifiedEmail(input: {
  email: string;
  name?: string;
  phone?: string;
  accountMode?: "customer" | "business";
}): Promise<{ account: Account; token: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  const existing = await getAccountByEmail(email);
  if (existing) {
    await sql(`update accounts set email_verified = true where id = $1`, [existing.id]);
    const result = await loginWithAccountId(existing.id);
    return { ...result, created: false };
  }
  const result = await createAccount({
    provider: "email",
    name: input.name?.trim() || email.split("@")[0] || "VELIO-användare",
    email,
    phone: input.phone?.trim() || "",
    accountMode: "customer",
    emailVerified: true,
  });
  return { ...result, created: true };
}

export async function loginOrCreateVerifiedPhone(input: {
  phone: string;
  name?: string;
  email?: string;
}): Promise<{ account: Account; token: string; created: boolean }> {
  const phone = input.phone.trim();
  const existing = await getAccountByPhone(phone);
  if (existing) {
    await sql(`update accounts set phone_verified = true where id = $1`, [existing.id]);
    const result = await loginWithAccountId(existing.id);
    return { ...result, created: false };
  }
  const result = await createAccount({
    provider: "phone",
    name: input.name?.trim() || `Användare ${phone.slice(-4)}`,
    email: input.email?.trim().toLowerCase() || "",
    phone,
    accountMode: "customer",
    phoneVerified: true,
  });
  return { ...result, created: true };
}

export async function loginOrCreateBankId(input: {
  name?: string;
  personalNumber?: string;
}): Promise<{ account: Account; token: string; created: boolean }> {
  const personal = (input.personalNumber || "").replace(/\D/g, "");
  if (personal && personal.length !== 10 && personal.length !== 12) {
    throw new Error("invalid_personal_number");
  }
  const providerId = personal ? `pn-${personal}` : `bid-${randomUUID().slice(0, 10)}`;
  const existing = personal ? await getAccountByProviderId(providerId) : null;
  if (existing) {
    await sql(
      `update accounts set provider = 'bankid', id_verified = true, id_method = 'bankid',
              name = coalesce(nullif($2,''), name)
       where id = $1`,
      [existing.id, input.name?.trim() || ""],
    );
    const result = await loginWithAccountId(existing.id);
    return { ...result, created: false };
  }
  const result = await createAccount({
    provider: "bankid",
    name: input.name?.trim() || "Användare",
    email: "",
    phone: "",
    providerId,
    idVerified: true,
    idMethod: "bankid",
  });
  return { ...result, created: true };
}

export async function updateAccount(
  accountId: string,
  patch: {
    name?: string;
    email?: string;
    phone?: string;
    accountMode?: "customer" | "business";
    providerId?: string | null;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    idVerified?: boolean;
    idMethod?: string | null;
    passportNumber?: string | null;
    passportCountry?: string | null;
  },
): Promise<Account> {
  const current = await getAccountById(accountId);
  if (!current) throw new Error("unknown_account");
  const name = patch.name?.trim() || current.name;
  const email = patch.email?.trim().toLowerCase() || current.email;
  const phone = patch.phone?.trim() || current.phone;
  const mode = patch.accountMode ?? current.accountMode;
  const providerId = patch.providerId === undefined ? current.providerId : patch.providerId;
  const emailVerified = patch.emailVerified ?? current.emailVerified;
  const phoneVerified = patch.phoneVerified ?? current.phoneVerified;
  const idVerified = patch.idVerified ?? current.idVerified;
  const idMethod = patch.idMethod === undefined ? current.idMethod : patch.idMethod;

  if (mode === "business" && !idVerified) {
    throw new Error("id_verification_required");
  }

  await sql(
    `update accounts
     set name = $2, email = $3, phone = $4, account_mode = $5, provider_id = $6,
         email_verified = $7, phone_verified = $8, id_verified = $9, id_method = $10,
         passport_number = coalesce($11, passport_number),
         passport_country = coalesce($12, passport_country)
     where id = $1`,
    [
      accountId,
      name,
      email,
      phone,
      mode,
      providerId,
      emailVerified,
      phoneVerified,
      idVerified,
      idMethod,
      patch.passportNumber ?? null,
      patch.passportCountry ?? null,
    ],
  );
  const updated = await getAccountById(accountId);
  if (!updated) throw new Error("unknown_account");
  return updated;
}

export async function markIdVerified(
  accountId: string,
  method: "bankid" | "passport",
  extra?: { passportNumber?: string; passportCountry?: string },
): Promise<Account> {
  return updateAccount(accountId, {
    idVerified: true,
    idMethod: method,
    passportNumber: extra?.passportNumber,
    passportCountry: extra?.passportCountry,
  });
}

export async function destroySession(request: Request): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;
  await sql(`delete from sessions where token = $1`, [token]);
}
