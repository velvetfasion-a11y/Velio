import { getAccountBySession } from "@/lib/velio/session";
import { listConversations, listJobs } from "@/lib/velio/sync-db";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ authenticated: false }, { status: 200, headers: noStore });
  }

  const [jobs, conversations] = await Promise.all([listJobs(), listConversations(account.id)]);

  return Response.json(
    {
      authenticated: true,
      account: {
        id: account.id,
        provider: account.provider,
        name: account.name,
        email: account.email,
        phone: account.phone,
        providerId: account.providerId,
        accountMode: account.accountMode,
      },
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
