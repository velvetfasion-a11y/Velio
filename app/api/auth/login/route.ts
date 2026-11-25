import { accountPublic, getAccountBySession } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

/**
 * Session probe / refresh only. New sessions are created exclusively by
 * Google OAuth, verified email OTP, or verified SMS OTP.
 */
export async function POST(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json(
      {
        error: "use_verified_login",
        message: "Logga in med Google, e-postkod eller SMS-kod.",
      },
      { status: 401, headers: noStore },
    );
  }

  return Response.json({ authenticated: true, account: accountPublic(account) }, { headers: noStore });
}
