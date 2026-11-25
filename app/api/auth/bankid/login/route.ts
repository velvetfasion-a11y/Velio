import { accountPublic, loginOrCreateBankId, sessionCookie } from "@/lib/velio/session";
import { assertRateLimit, clientKey } from "@/lib/velio/rate-limit";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

/** Sign in (or create) an account after a BankID approval on the client. */
export async function POST(request: Request) {
  const limited = await assertRateLimit({
    key: clientKey(request, "bankid-login"),
    limit: 20,
    windowMs: 15 * 60_000,
  });
  if (!limited.ok) {
    return Response.json(
      { error: "rate_limited", message: "För många försök. Försök igen senare." },
      { status: 429, headers: noStore },
    );
  }

  let body: { name?: string; personalNumber?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const { account, token } = await loginOrCreateBankId({
      name: body.name,
      personalNumber: body.personalNumber,
    });
    return new Response(JSON.stringify({ authenticated: true, account: accountPublic(account) }), {
      status: 200,
      headers: {
        ...noStore,
        "content-type": "application/json",
        "set-cookie": sessionCookie(token),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "bankid_failed";
    if (message === "invalid_personal_number") {
      return Response.json(
        { error: message, message: "Ange personnummer som ÅÅÅÅMMDDXXXX." },
        { status: 400, headers: noStore },
      );
    }
    return Response.json(
      { error: "bankid_failed", message: "BankID-inloggning misslyckades." },
      { status: 400, headers: noStore },
    );
  }
}
