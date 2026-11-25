import { accountPublic, getAccountBySession, updateAccount } from "@/lib/velio/session";
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
      account: accountPublic(account),
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
    if (body.accountMode === "business" && !account.idVerified) {
      return Response.json(
        {
          error: "id_verification_required",
          message: "Verifiera dig med BankID eller pass innan du aktiverar VELIO Business.",
        },
        { status: 403, headers: noStore },
      );
    }

    const updated = await updateAccount(account.id, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      accountMode: body.accountMode,
    });
    return Response.json({ account: accountPublic(updated) }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "update_failed";
    const status = message === "id_verification_required" ? 403 : 400;
    return Response.json({ error: message }, { status, headers: noStore });
  }
}
