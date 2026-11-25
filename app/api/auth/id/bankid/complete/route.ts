import { sql } from "@/lib/db";
import { verifySignedValue } from "@/lib/velio/auth-secrets";
import { accountPublic, getAccountBySession, markIdVerified, updateAccount } from "@/lib/velio/session";
import { env } from "@/lib/velio/auth-config";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
const COOKIE = "velio_bankid";

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function POST(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  if (!env("BANKID_API_URL") || !env("BANKID_API_KEY")) {
    return Response.json({ error: "bankid_not_configured" }, { status: 503, headers: noStore });
  }

  let body: { challengeId?: string; activateBusiness?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  if (!body.challengeId) {
    return Response.json({ error: "missing_challenge" }, { status: 400, headers: noStore });
  }

  const proof = readCookie(request, COOKIE);
  if (!proof || !verifySignedValue(proof, `${body.challengeId}:${account.id}`)) {
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
  if (row.target !== account.id) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  }

  // Production: poll BankID collect until complete before marking verified.
  await sql(`update auth_challenges set consumed_at = now() where id = $1`, [body.challengeId]);

  let updated = await markIdVerified(account.id, "bankid");
  if (body.activateBusiness) {
    updated = await updateAccount(account.id, { accountMode: "business", idVerified: true, idMethod: "bankid" });
  }

  const headers = new Headers({ ...noStore, "content-type": "application/json" });
  headers.append("set-cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return new Response(JSON.stringify({ account: accountPublic(updated), verified: true }), {
    status: 200,
    headers,
  });
}
