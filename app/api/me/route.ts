import { getAccountBySession, updateAccount } from "@/lib/velio/session";
import { listConversations, listJobs } from "@/lib/velio/sync-db";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

function accountPayload(account: {
  id: string;
  provider: string;
  name: string;
  email: string;
  phone: string;
  providerId: string | null;
  accountMode: "customer" | "business";
}) {
  return {
    id: account.id,
    provider: account.provider,
    name: account.name,
    email: account.email,
    phone: account.phone,
    providerId: account.providerId,
    accountMode: account.accountMode,
  };
}

export async function GET(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ authenticated: false }, { status: 200, headers: noStore });
  }

  const [jobs, conversations] = await Promise.all([listJobs(), listConversations(account.id)]);

  return Response.json(
    {
      authenticated: true,
      account: accountPayload(account),
      jobs,
      conversations: conversations.map((item) => ({
        id: item.id,
        peerId: item.peer.id,
        peerName: item.peer.name,
        providerId: item.providerId,
        lastMessage: item.lastMessage,
        lastAt: item.lastAt,
      })),
    },
    { headers: noStore },
  );
}

export async function PATCH(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    accountMode?: "customer" | "business";
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  try {
    const updated = await updateAccount(account.id, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      accountMode: body.accountMode,
    });
    return Response.json({ account: accountPayload(updated) }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "update_failed";
    return Response.json({ error: message }, { status: 400, headers: noStore });
  }
}
