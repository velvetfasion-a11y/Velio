import { sql } from "@/lib/db";
import { verifySignedValue } from "@/lib/velio/auth-secrets";
import { bankIdCollect, bankIdConfigured } from "@/lib/velio/bankid";
import { accountPublic, loginOrCreateBankId, sessionCookie } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
const COOKIE = "velio_bankid_login";

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Poll BankID until the user has signed in the BankID app, then create the session. */
export async function POST(request: Request) {
  if (!bankIdConfigured()) {
    return Response.json({ error: "bankid_not_configured" }, { status: 503, headers: noStore });
  }

  let body: { challengeId?: string; orderRef?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }
  if (!body.challengeId || !body.orderRef) {
    return Response.json({ error: "missing_fields" }, { status: 400, headers: noStore });
  }

  const proof = readCookie(request, COOKIE);
  if (!proof || !verifySignedValue(proof, `${body.challengeId}:${body.orderRef}`)) {
    return Response.json(
      { error: "invalid_proof", message: "BankID-sessionen kunde inte bekräftas." },
      { status: 403, headers: noStore },
    );
  }

  const rows = await sql<{
    target: string;
    consumed_at: string | null;
    expires_at: string;
  }>(
    `select target, consumed_at, expires_at from auth_challenges where id = $1 and kind = 'bankid' limit 1`,
    [body.challengeId],
  );
  const row = rows[0];
  if (!row || row.consumed_at) {
    return Response.json({ error: "invalid_challenge", message: "BankID-sessionen är ogiltig." }, { status: 400, headers: noStore });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return Response.json({ error: "expired", message: "BankID-sessionen har gått ut." }, { status: 400, headers: noStore });
  }
  if (row.target !== body.orderRef) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  }

  try {
    const collected = await bankIdCollect(body.orderRef);
    if (collected.status === "pending") {
      return Response.json(
        { status: "pending", hintCode: collected.hintCode },
        { headers: noStore },
      );
    }
    if (collected.status === "failed") {
      return Response.json(
        {
          status: "failed",
          error: "bankid_failed",
          message: "BankID avbröts eller misslyckades. Försök igen.",
          hintCode: collected.hintCode,
        },
        { status: 400, headers: noStore },
      );
    }

    await sql(`update auth_challenges set consumed_at = now() where id = $1`, [body.challengeId]);
    const { account, token } = await loginOrCreateBankId({
      name: collected.name,
      personalNumber: collected.personalNumber,
    });

    const headers = new Headers({ ...noStore, "content-type": "application/json" });
    headers.append("set-cookie", sessionCookie(token));
    headers.append("set-cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

    return new Response(
      JSON.stringify({
        status: "complete",
        authenticated: true,
        account: accountPublic(account),
      }),
      { status: 200, headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "bankid_collect_failed";
    return Response.json({ error: "bankid_collect_failed", message }, { status: 502, headers: noStore });
  }
}
