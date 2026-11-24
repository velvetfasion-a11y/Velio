import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { getAccountById, getAccountByProviderId, type Account } from "@/lib/velio/session";

export type JobRow = {
  id: string;
  owner_id: string;
  service_id: string;
  text: string;
  when_label: string;
  address: string;
  rate: string;
  price: number;
  status: string;
  created_at: string;
  owner_name?: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

export type ConversationSummary = {
  id: string;
  peer: Account;
  providerId: string | null;
  lastMessage: string;
  lastAt: string;
};

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function listJobs(): Promise<
  {
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
  }[]
> {
  const rows = await sql<JobRow & { owner_name: string }>(
    `select j.*, a.name as owner_name
     from jobs j
     join accounts a on a.id = j.owner_id
     where j.status = 'open'
     order by j.created_at desc
     limit 100`,
  );
  return rows.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    serviceId: row.service_id,
    text: row.text,
    when: row.when_label,
    address: row.address,
    rate: row.rate === "fixed" ? "fixed" : "hour",
    price: row.price,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function createJob(input: {
  ownerId: string;
  serviceId: string;
  text: string;
  when: string;
  address: string;
  rate: "hour" | "fixed";
  price: number;
}) {
  const id = randomUUID();
  await sql(
    `insert into jobs (id, owner_id, service_id, text, when_label, address, rate, price, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'open')`,
    [id, input.ownerId, input.serviceId, input.text, input.when, input.address, input.rate, input.price],
  );
  return id;
}

export async function ensureConversation(accountA: string, accountB: string): Promise<string> {
  if (accountA === accountB) throw new Error("same_account");
  const [left, right] = orderedPair(accountA, accountB);
  const existing = await sql<{ id: string }>(
    `select id from conversations where account_a = $1 and account_b = $2`,
    [left, right],
  );
  if (existing[0]) return existing[0].id;
  const id = randomUUID();
  await sql(`insert into conversations (id, account_a, account_b) values ($1, $2, $3)`, [id, left, right]);
  return id;
}

export async function ensureConversationWithProvider(me: Account, providerId: string): Promise<{
  conversationId: string;
  peer: Account;
} | null> {
  const peer = await getAccountByProviderId(providerId);
  if (!peer) return null;
  if (peer.id === me.id) return null;
  const conversationId = await ensureConversation(me.id, peer.id);
  return { conversationId, peer };
}

export async function ensureConversationWithAccount(me: Account, accountId: string): Promise<{
  conversationId: string;
  peer: Account;
} | null> {
  if (!accountId || accountId === me.id) return null;
  const peer = await getAccountById(accountId);
  if (!peer) return null;
  const conversationId = await ensureConversation(me.id, peer.id);
  return { conversationId, peer };
}

export async function listConversations(accountId: string): Promise<ConversationSummary[]> {
  const rows = await sql<{
    id: string;
    account_a: string;
    account_b: string;
    updated_at: string;
    last_text: string | null;
  }>(
    `select c.id, c.account_a, c.account_b, c.updated_at,
            (select m.text from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_text
     from conversations c
     where c.account_a = $1 or c.account_b = $1
     order by c.updated_at desc`,
    [accountId],
  );

  const out: ConversationSummary[] = [];
  for (const row of rows) {
    const peerId = row.account_a === accountId ? row.account_b : row.account_a;
    const peer = await getAccountById(peerId);
    if (!peer) continue;
    out.push({
      id: row.id,
      peer,
      providerId: peer.providerId,
      lastMessage: row.last_text ?? "",
      lastAt: row.updated_at,
    });
  }
  return out;
}

export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  return sql<MessageRow>(
    `select id, conversation_id, sender_id, text, created_at
     from messages where conversation_id = $1
     order by created_at asc`,
    [conversationId],
  );
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  text: string;
}): Promise<MessageRow> {
  const id = randomUUID();
  const rows = await sql<MessageRow>(
    `insert into messages (id, conversation_id, sender_id, text)
     values ($1, $2, $3, $4)
     returning id, conversation_id, sender_id, text, created_at`,
    [id, input.conversationId, input.senderId, input.text],
  );
  await sql(`update conversations set updated_at = now() where id = $1`, [input.conversationId]);
  return rows[0]!;
}

export async function conversationIncludes(conversationId: string, accountId: string): Promise<boolean> {
  const rows = await sql<{ id: string }>(
    `select id from conversations
     where id = $1 and (account_a = $2 or account_b = $2)`,
    [conversationId, accountId],
  );
  return Boolean(rows[0]);
}
