import { getAccountBySession } from "@/lib/velio/session";
import {
  ensureConversationWithAccount,
  ensureConversationWithProvider,
  listConversations,
} from "@/lib/velio/sync-db";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const conversations = await listConversations(account.id);
  return Response.json(
    {
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

export async function POST(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  let body: { providerId?: string; accountId?: string };
  try {
    body = (await request.json()) as { providerId?: string; accountId?: string };
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  const providerId = body.providerId?.trim();
  const accountId = body.accountId?.trim();
  if (!providerId && !accountId) {
    return Response.json({ error: "peer_required" }, { status: 400, headers: noStore });
  }

  const opened = providerId
    ? await ensureConversationWithProvider(account, providerId)
    : await ensureConversationWithAccount(account, accountId!);
  if (!opened) {
    return Response.json({ error: "peer_unavailable" }, { status: 404, headers: noStore });
  }

  const threadKey = opened.peer.providerId || opened.peer.id;

  return Response.json(
    {
      conversationId: opened.conversationId,
      threadKey,
      peer: {
        id: opened.peer.id,
        name: opened.peer.name,
        providerId: opened.peer.providerId,
      },
    },
    { headers: noStore },
  );
}
