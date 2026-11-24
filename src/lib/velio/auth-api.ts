import type { ServiceId } from "@/lib/velio/data";
import type { ChatCard } from "@/lib/velio/store";
import { encodeCardMessage } from "@/lib/velio/chat-codec";

export type AuthProvider = "bankid" | "google" | "apple" | "phone";

export type AccountDto = {
  id: string;
  provider: string;
  name: string;
  email: string;
  phone: string;
  providerId: string | null;
  accountMode: "customer" | "business";
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

export async function fetchMe(): Promise<MeResponse> {
  const response = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return { authenticated: false };
  return json<MeResponse>(response);
}

export async function loginWithProvider(provider: AuthProvider): Promise<MeResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  if (!response.ok) return { authenticated: false };
  return fetchMe();
}

export async function logoutRemote(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
}

export async function fetchJobs(): Promise<JobDto[]> {
  const response = await fetch("/api/jobs", { credentials: "same-origin", cache: "no-store" });
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
  const response = await fetch("/api/jobs", {
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
  const response = await fetch("/api/conversations", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(peer),
  });
  if (!response.ok) return null;
  return json<{
    conversationId: string;
    threadKey: string;
    peer: { id: string; name: string; providerId: string | null };
  }>(response);
}

export async function fetchConversations(): Promise<ConversationDto[]> {
  const response = await fetch("/api/conversations", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return [];
  const data = await json<{ conversations: ConversationDto[] }>(response);
  return data.conversations ?? [];
}

export async function fetchMessages(conversationId: string): Promise<ChatDto[]> {
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
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
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: bodyText }),
  });
  if (!response.ok) return null;
  const data = await json<{ message: ChatDto }>(response);
  return data.message ?? null;
}
