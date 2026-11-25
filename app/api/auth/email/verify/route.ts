import { verifyChallenge } from "@/lib/velio/otp";
import { accountPublic, loginOrCreateVerifiedEmail, sessionCookie } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  let body: { challengeId?: string; code?: string; name?: string; phone?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  if (!body.challengeId || !body.code) {
    return Response.json({ error: "missing_fields" }, { status: 400, headers: noStore });
  }

  const checked = await verifyChallenge({ id: body.challengeId, kind: "email", code: body.code });
  if (!checked.ok) {
    return Response.json({ error: "invalid_code", message: checked.error }, { status: 400, headers: noStore });
  }

  const nameFromPayload = typeof checked.payload.name === "string" ? checked.payload.name : "";
  const result = await loginOrCreateVerifiedEmail({
    email: checked.target,
    name: body.name || nameFromPayload,
    phone: body.phone,
  });

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
