import { EID_ONLY_MESSAGE } from "@/lib/velio/eid-policy";
import { verifyChallenge } from "@/lib/velio/otp";
import { accountPublic, loginOrCreateVerifiedPhone, sessionCookie } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  let body: { challengeId?: string; code?: string; name?: string; email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  if (!body.challengeId || !body.code) {
    return Response.json({ error: "missing_fields" }, { status: 400, headers: noStore });
  }

  const checked = await verifyChallenge({ id: body.challengeId, kind: "sms", code: body.code });
  if (!checked.ok) {
    return Response.json({ error: "invalid_code", message: checked.error }, { status: 400, headers: noStore });
  }

  const nameFromPayload = typeof checked.payload.name === "string" ? checked.payload.name : "";
  let result;
  try {
    result = await loginOrCreateVerifiedPhone({
      phone: checked.target,
      name: body.name || nameFromPayload,
      email: body.email,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "eid_only") {
      return Response.json({ error: "eid_only", message: EID_ONLY_MESSAGE }, { status: 403, headers: noStore });
    }
    throw error;
  }

  return Response.json(
    {
      authenticated: true,
      created: result.created,
      account: accountPublic(result.account),
    },
    {
      headers: {
        ...noStore,
        "set-cookie": sessionCookie(result.token),
      },
    },
  );
}
