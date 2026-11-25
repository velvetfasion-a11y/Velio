import { accountPublic, getAccountBySession } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

/** Returns only the signed-in account. Never lists other users. */
export async function GET(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  return Response.json({ account: accountPublic(account), accounts: [accountPublic(account)] }, { headers: noStore });
}
