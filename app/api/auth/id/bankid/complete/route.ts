import { createHash } from "crypto";
import { sql } from "@/lib/db";
import { accountPublic, getAccountBySession, markIdVerified, updateAccount } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
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

  const rows = await sql<{
    target: string;
    payload: Record<string, unknown> | string;
    consumed_at: string | null;
    expires_at: string;
    code_hash: string;
  }>(
    `select target, payload, consumed_at, expires_at, code_hash
     from auth_challenges where id = $1 and kind = 'bankid' limit 1`,
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

  const payload =
    typeof row.payload === "string" ? (JSON.parse(row.payload) as Record<string, unknown>) : row.payload || {};
  const orderRef = typeof payload.orderRef === "string" ? payload.orderRef : "";
  const code = orderRef.slice(-6);
  const expected = createHash("sha256").update(code).digest("hex");
  if (row.code_hash !== expected) {
    return Response.json({ error: "verify_failed", message: "Kunde inte bekräfta BankID." }, { status: 400, headers: noStore });
  }

  await sql(`update auth_challenges set consumed_at = now() where id = $1`, [body.challengeId]);

  let updated = await markIdVerified(account.id, "bankid");
  if (body.activateBusiness) {
    updated = await updateAccount(account.id, { accountMode: "business", idVerified: true, idMethod: "bankid" });
  }

  return Response.json({ account: accountPublic(updated), verified: true }, { headers: noStore });
}
