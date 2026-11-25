/** Client-only auth fallback when the app is served as a static site (no API routes). */

export type LocalAccount = {
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
  passwordHash?: string;
};

const ACCOUNTS_KEY = "velio_local_accounts_v2";
const SESSION_KEY = "velio_local_session_v2";
const OTP_KEY = "velio_local_otp_v2";
const OTP_ATTEMPTS_KEY = "velio_local_otp_attempts_v2";

function readAccounts(): LocalAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]") as LocalAccount[];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: LocalAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function uid() {
  return `loc-${crypto.randomUUID().slice(0, 8)}`;
}

async function hash(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isStaticHost(): boolean {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_STATIC === "1";
  return process.env.NEXT_PUBLIC_STATIC === "1" || window.location.hostname.endsWith("github.io");
}

export function getLocalSessionAccount(): LocalAccount | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return readAccounts().find((a) => a.id === id) ?? null;
}

export function clearLocalSession() {
  localStorage.removeItem(SESSION_KEY);
}

function readAttempts(challengeId: string): number {
  try {
    const raw = JSON.parse(localStorage.getItem(OTP_ATTEMPTS_KEY) || "{}") as Record<string, number>;
    return raw[challengeId] || 0;
  } catch {
    return 0;
  }
}

function bumpAttempts(challengeId: string): number {
  let raw: Record<string, number> = {};
  try {
    raw = JSON.parse(localStorage.getItem(OTP_ATTEMPTS_KEY) || "{}") as Record<string, number>;
  } catch {
    raw = {};
  }
  raw[challengeId] = (raw[challengeId] || 0) + 1;
  localStorage.setItem(OTP_ATTEMPTS_KEY, JSON.stringify(raw));
  return raw[challengeId];
}

function clearAttempts(challengeId: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(OTP_ATTEMPTS_KEY) || "{}") as Record<string, number>;
    delete raw[challengeId];
    localStorage.setItem(OTP_ATTEMPTS_KEY, JSON.stringify(raw));
  } catch {
    /* ignore */
  }
}

export async function localStartEmailOtp(email: string, name?: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const challengeId = uid();
  const codeHash = await hash(code);
  localStorage.setItem(
    OTP_KEY,
    JSON.stringify({
      challengeId,
      kind: "email",
      target: email.trim().toLowerCase(),
      name: name?.trim() || "",
      codeHash,
      expiresAt: Date.now() + 10 * 60_000,
    }),
  );
  sessionStorage.setItem(`velio_secure_code_${challengeId}`, code);
  return {
    challengeId,
    message: "Engångskod skapad. Ange koden inom 10 minuter för att logga in.",
    deliveryCode: code,
  };
}

export async function localVerifyEmailOtp(input: {
  challengeId: string;
  code: string;
  name?: string;
}): Promise<LocalAccount> {
  const raw = localStorage.getItem(OTP_KEY);
  if (!raw) throw new Error("Ingen aktiv kod");
  const otp = JSON.parse(raw) as {
    challengeId: string;
    kind: string;
    target: string;
    name: string;
    codeHash: string;
    expiresAt: number;
  };
  if (otp.challengeId !== input.challengeId || otp.kind !== "email") throw new Error("Ogiltig kod");
  if (otp.expiresAt < Date.now()) throw new Error("Koden har gått ut");
  if (readAttempts(input.challengeId) >= 5) throw new Error("För många försök. Begär en ny kod.");
  if ((await hash(input.code.trim())) !== otp.codeHash) {
    bumpAttempts(input.challengeId);
    throw new Error("Fel kod");
  }
  localStorage.removeItem(OTP_KEY);
  clearAttempts(input.challengeId);
  sessionStorage.removeItem(`velio_secure_code_${input.challengeId}`);

  const accounts = readAccounts();
  let account = accounts.find((a) => a.email === otp.target);
  if (!account) {
    account = {
      id: uid(),
      provider: "email",
      name: input.name?.trim() || otp.name || otp.target.split("@")[0] || "VELIO",
      email: otp.target,
      phone: "",
      providerId: null,
      accountMode: "customer",
      emailVerified: true,
      phoneVerified: false,
      idVerified: false,
      idMethod: null,
    };
    accounts.push(account);
  } else {
    account = { ...account, emailVerified: true, name: input.name?.trim() || account.name };
    const idx = accounts.findIndex((a) => a.id === account!.id);
    accounts[idx] = account;
  }
  writeAccounts(accounts);
  localStorage.setItem(SESSION_KEY, account.id);
  return account;
}

export async function localStartSmsOtp(phone: string, name?: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const challengeId = uid();
  const codeHash = await hash(code);
  localStorage.setItem(
    OTP_KEY,
    JSON.stringify({
      challengeId,
      kind: "sms",
      target: phone.trim(),
      name: name?.trim() || "",
      codeHash,
      expiresAt: Date.now() + 10 * 60_000,
    }),
  );
  sessionStorage.setItem(`velio_secure_code_${challengeId}`, code);
  return {
    challengeId,
    message: "Engångskod skapad. Ange koden inom 10 minuter för att logga in.",
    deliveryCode: code,
  };
}

export async function localVerifySmsOtp(input: {
  challengeId: string;
  code: string;
  name?: string;
}): Promise<LocalAccount> {
  const raw = localStorage.getItem(OTP_KEY);
  if (!raw) throw new Error("Ingen aktiv kod");
  const otp = JSON.parse(raw) as {
    challengeId: string;
    kind: string;
    target: string;
    name: string;
    codeHash: string;
    expiresAt: number;
  };
  if (otp.challengeId !== input.challengeId || otp.kind !== "sms") throw new Error("Ogiltig kod");
  if (otp.expiresAt < Date.now()) throw new Error("Koden har gått ut");
  if (readAttempts(input.challengeId) >= 5) throw new Error("För många försök. Begär en ny kod.");
  if ((await hash(input.code.trim())) !== otp.codeHash) {
    bumpAttempts(input.challengeId);
    throw new Error("Fel kod");
  }
  localStorage.removeItem(OTP_KEY);
  clearAttempts(input.challengeId);
  sessionStorage.removeItem(`velio_secure_code_${input.challengeId}`);

  const accounts = readAccounts();
  let account = accounts.find((a) => a.phone === otp.target);
  if (!account) {
    account = {
      id: uid(),
      provider: "phone",
      name: input.name?.trim() || otp.name || `Användare ${otp.target.slice(-4)}`,
      email: `${uid()}@users.velio.local`,
      phone: otp.target,
      providerId: null,
      accountMode: "customer",
      emailVerified: false,
      phoneVerified: true,
      idVerified: false,
      idMethod: null,
    };
    accounts.push(account);
  } else {
    account = { ...account, phoneVerified: true, name: input.name?.trim() || account.name };
    const idx = accounts.findIndex((a) => a.id === account!.id);
    accounts[idx] = account;
  }
  writeAccounts(accounts);
  localStorage.setItem(SESSION_KEY, account.id);
  return account;
}

export function localBankIdSignIn(input?: { name?: string; personalNumber?: string }): LocalAccount {
  const personal = (input?.personalNumber || "").replace(/\D/g, "");
  const name = input?.name?.trim() || "Användare";
  const providerId = personal ? `pn-${personal}` : `bid-${uid()}`;
  const accounts = readAccounts();
  let account = accounts.find((a) => a.provider === "bankid" && a.providerId === providerId);
  if (!account && personal) {
    account = accounts.find((a) => a.provider === "bankid" && a.providerId === `pn-${personal}`);
  }
  if (!account) {
    account = {
      id: uid(),
      provider: "bankid",
      name,
      email: `${uid()}@bankid.velio.local`,
      phone: "",
      providerId,
      accountMode: "customer",
      emailVerified: false,
      phoneVerified: false,
      idVerified: true,
      idMethod: "bankid",
    };
    accounts.push(account);
  } else {
    account = {
      ...account,
      name: name || account.name,
      idVerified: true,
      idMethod: "bankid",
    };
    const idx = accounts.findIndex((a) => a.id === account!.id);
    accounts[idx] = account;
  }
  writeAccounts(accounts);
  localStorage.setItem(SESSION_KEY, account.id);
  return account;
}

export function localGoogleSignIn(email: string, name: string, providerId?: string): LocalAccount {
  const accounts = readAccounts();
  let account = accounts.find((a) => a.email === email.toLowerCase());
  if (!account) {
    account = {
      id: uid(),
      provider: "google",
      name,
      email: email.toLowerCase(),
      phone: "",
      providerId: providerId || null,
      accountMode: "customer",
      emailVerified: true,
      phoneVerified: false,
      idVerified: false,
      idMethod: null,
    };
    accounts.push(account);
  } else {
    account = {
      ...account,
      provider: "google",
      name: name || account.name,
      providerId: providerId || account.providerId,
      emailVerified: true,
    };
    const idx = accounts.findIndex((a) => a.id === account!.id);
    accounts[idx] = account;
  }
  writeAccounts(accounts);
  localStorage.setItem(SESSION_KEY, account.id);
  return account;
}

export function localVerifyId(method: "bankid" | "passport"): LocalAccount {
  const account = getLocalSessionAccount();
  if (!account) throw new Error("Inte inloggad");
  const accounts = readAccounts();
  const next: LocalAccount = {
    ...account,
    idVerified: true,
    idMethod: method,
    accountMode: "business",
  };
  const idx = accounts.findIndex((a) => a.id === account.id);
  accounts[idx] = next;
  writeAccounts(accounts);
  return next;
}

export function localMePayload(account: LocalAccount) {
  return {
    authenticated: true as const,
    account: {
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
    },
    jobs: [],
    conversations: [],
  };
}
