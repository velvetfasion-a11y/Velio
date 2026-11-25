import type { ServiceId } from "@/lib/velio/data";
import type { ChatCard } from "@/lib/velio/store";
import { encodeCardMessage } from "@/lib/velio/chat-codec";

export type AuthProvider = "bankid" | "google" | "apple" | "phone" | "email";

export type AccountDto = {
  id: string;
  provider: string;
  name: string;
  email: string;
  phone: string;
  providerId: string | null;
  accountMode: "customer" | "business";
  emailVerified?: boolean;
  phoneVerified?: boolean;
  idVerified?: boolean;
  idMethod?: string | null;
};

export type JobDto = {
  id: string;
  ownerId: string;
  ownerName: string;
  serviceId: string;
  text: string;
  when: string;
  address: string;
  rate: "hour" | "fixed";
  price: number;
  status: string;
  createdAt: string;
};

export type ConversationDto = {
  id: string;
  peerId: string;
  peerName: string;
  providerId: string | null;
  lastMessage: string;
  lastAt: string;
};

export type ChatDto = {
  id: string;
  from: "me" | "them";
  text: string;
  time?: string;
  createdAt?: string;
};

export type MeResponse =
  | {
      authenticated: true;
      account: AccountDto;
      jobs: JobDto[];
      conversations: ConversationDto[];
    }
  | { authenticated: false };

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function apiPath(path: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  return `${base}${path}`;
}

export async function fetchMe(): Promise<MeResponse> {
  const response = await fetch(apiPath("/api/me"), { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return { authenticated: false };
  return json<MeResponse>(response);
}

export async function fetchAuthCapabilities(): Promise<{
  google: boolean;
  email: boolean;
  sms: boolean;
  bankid: boolean;
  sampleFallback: boolean;
}> {
  const response = await fetch(apiPath("/api/auth/capabilities"), { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return { google: false, email: false, sms: false, bankid: false, sampleFallback: false };
  return json(response);
}

export async function listAccountsRemote(_provider?: AuthProvider): Promise<AccountDto[]> {
  const response = await fetch(apiPath("/api/auth/accounts"), {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) return [];
  const data = await json<{ accounts: AccountDto[]; account?: AccountDto }>(response);
  return data.accounts ?? (data.account ? [data.account] : []);
}

export async function loginWithAccount(_provider: AuthProvider, _accountId: string): Promise<MeResponse> {
  return { authenticated: false };
}

export async function createAccountRemote(_input: {
  provider: AuthProvider;
  name: string;
  email: string;
  phone: string;
  accountMode?: "customer" | "business";
}): Promise<MeResponse> {
  return { authenticated: false };
}

export async function startEmailOtp(email: string, name?: string) {
  const response = await fetch(apiPath("/api/auth/email/start"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
  const data = await json<{ challengeId?: string; message?: string; error?: string }>(response);
  if (!response.ok) throw new Error(data.message || data.error || "Kunde inte skicka e-postkod");
  return data as { challengeId: string; message?: string };
}

export async function verifyEmailOtp(input: {
  challengeId: string;
  code: string;
  name?: string;
  phone?: string;
}): Promise<MeResponse> {
  const response = await fetch(apiPath("/api/auth/email/verify"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const data = await json<{ message?: string }>(response);
    throw new Error(data.message || "Fel verifieringskod");
  }
  return fetchMe();
}

export async function startSmsOtp(phone: string, name?: string) {
  const response = await fetch(apiPath("/api/auth/sms/start"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, name }),
  });
  const data = await json<{ challengeId?: string; message?: string; error?: string }>(response);
  if (!response.ok) throw new Error(data.message || data.error || "Kunde inte skicka SMS");
  return data as { challengeId: string; message?: string };
}

export async function loginWithCursor(): Promise<MeResponse> {
  const response = await fetch(apiPath("/api/auth/cursor"), {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) {
    const data = await json<{ message?: string }>(response);
    throw new Error(data.message || "Cursor-inloggning misslyckades");
  }
  return fetchMe();
}

export async function verifySmsOtp(input: {
  challengeId: string;
  code: string;
  name?: string;
  email?: string;
}): Promise<MeResponse> {
  const response = await fetch(apiPath("/api/auth/sms/verify"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const data = await json<{ message?: string }>(response);
    throw new Error(data.message || "Fel SMS-kod");
  }
  return fetchMe();
}

export async function startBankIdLogin(personalNumber?: string) {
  const response = await fetch(apiPath("/api/auth/bankid/start"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ personalNumber }),
  });
  const data = await json<{
    challengeId?: string;
    orderRef?: string;
    autoStartToken?: string;
    launchUrl?: string;
    message?: string;
    error?: string;
  }>(response);
  if (!response.ok) throw new Error(data.message || data.error || "Kunde inte starta BankID");
  return data as {
    challengeId: string;
    orderRef: string;
    autoStartToken: string;
    launchUrl: string;
    message?: string;
  };
}

export async function collectBankIdLogin(input: {
  challengeId: string;
  orderRef: string;
}): Promise<
  | { status: "pending"; hintCode?: string }
  | { status: "failed"; message?: string }
  | { status: "complete"; authenticated: true }
> {
  const response = await fetch(apiPath("/api/auth/bankid/collect"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await json<{
    status?: string;
    message?: string;
    error?: string;
    hintCode?: string;
    authenticated?: boolean;
  }>(response);
  if (data.status === "pending") return { status: "pending", hintCode: data.hintCode };
  if (data.status === "failed" || !response.ok) {
    return { status: "failed", message: data.message || data.error || "BankID misslyckades" };
  }
  return { status: "complete", authenticated: true };
}

export async function startBankIdVerification(personalNumber?: string) {
  const response = await fetch(apiPath("/api/auth/id/bankid/start"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ personalNumber }),
  });
  const data = await json<{
    challengeId?: string;
    orderRef?: string;
    message?: string;
    error?: string;
  }>(response);
  if (!response.ok) throw new Error(data.message || data.error || "Kunde inte starta BankID");
  return data as { challengeId: string; orderRef: string; message?: string };
}

export async function completeBankIdVerification(challengeId: string, activateBusiness = true) {
  const response = await fetch(apiPath("/api/auth/id/bankid/complete"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeId, activateBusiness }),
  });
  const data = await json<{ account?: AccountDto; message?: string; error?: string }>(response);
  if (!response.ok) throw new Error(data.message || data.error || "BankID misslyckades");
  return data.account!;
}

export async function submitPassportVerification(input: {
  passportNumber: string;
  country: string;
  fullName: string;
  expiry: string;
}) {
  const response = await fetch(apiPath("/api/auth/id/passport"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await json<{
    account?: AccountDto;
    message?: string;
    error?: string;
    pending?: boolean;
    verified?: boolean;
  }>(response);
  if (!response.ok) throw new Error(data.message || data.error || "Passverifiering misslyckades");
  return data as { account: AccountDto; pending?: boolean; verified?: boolean; message?: string };
}

export async function loginWithProvider(provider: AuthProvider): Promise<MeResponse> {
  const accounts = await listAccountsRemote(provider);
  if (!accounts[0]) return { authenticated: false };
  return loginWithAccount(provider, accounts[0].id);
}

export async function updateProfileRemote(input: {
  name?: string;
  email?: string;
  phone?: string;
  accountMode?: "customer" | "business";
}): Promise<AccountDto | null> {
  const response = await fetch(apiPath("/api/me"), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    if (response.status === 403) {
      const data = await json<{ error?: string }>(response);
      if (data.error === "id_verification_required") throw new Error("id_verification_required");
    }
    return null;
  }
  const data = await json<{ account: AccountDto }>(response);
  return data.account ?? null;
}

export async function logoutRemote(): Promise<void> {
  await fetch(apiPath("/api/auth/logout"), { method: "POST", credentials: "same-origin" });
}

export async function fetchJobs(): Promise<JobDto[]> {
  const response = await fetch(apiPath("/api/jobs"), { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return [];
  const data = await json<{ jobs: JobDto[] }>(response);
  return data.jobs ?? [];
}

export async function createJobRemote(input: {
  serviceId: ServiceId;
  text: string;
  when: string;
  address: string;
  rate: "hour" | "fixed";
  price: number;
}): Promise<JobDto[]> {
  const response = await fetch(apiPath("/api/jobs"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return fetchJobs();
  const data = await json<{ jobs: JobDto[] }>(response);
  return data.jobs ?? [];
}

export async function openConversation(peer: {
  providerId?: string;
  accountId?: string;
}): Promise<{ conversationId: string; threadKey: string; peer: { id: string; name: string; providerId: string | null } } | null> {
  const response = await fetch(apiPath("/api/conversations"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(peer),
  });
  if (!response.ok) return null;
  return json(response);
}

export async function fetchConversations(): Promise<ConversationDto[]> {
  const response = await fetch(apiPath("/api/conversations"), { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return [];
  const data = await json<{ conversations: ConversationDto[] }>(response);
  return data.conversations ?? [];
}

export async function fetchMessages(conversationId: string): Promise<ChatDto[]> {
  const response = await fetch(apiPath(`/api/conversations/${conversationId}/messages`), {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) return [];
  const data = await json<{ messages: ChatDto[] }>(response);
  return data.messages ?? [];
}

export async function sendMessageRemote(
  conversationId: string,
  text: string,
  card?: ChatCard,
): Promise<ChatDto | null> {
  const bodyText = card ? encodeCardMessage(card, text || "Bokningsförfrågan") : text;
  const response = await fetch(apiPath(`/api/conversations/${conversationId}/messages`), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: bodyText }),
  });
  if (!response.ok) return null;
  const data = await json<{ message: ChatDto }>(response);
  return data.message ?? null;
}
