import { googleConfigured } from "@/lib/velio/auth-config";
import { accountPublic, sessionCookie, upsertGoogleAccount } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

/** Local/sample Google sign-in when OAuth secrets are not configured yet. */
export async function POST(request: Request) {
  if (googleConfigured()) {
    return Response.json(
      { error: "use_oauth", message: "Använd riktig Google-inloggning." },
      { status: 400, headers: noStore },
    );
  }

  let body: { email?: string; name?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const email = (body.email || "demo.google@velio.local").trim().toLowerCase();
  const name = (body.name || "Google Demo").trim();
  const sub = `sample-google-${email}`;

  const result = await upsertGoogleAccount({
    sub,
    email,
    name,
    emailVerified: true,
  });

  return Response.json(
    { authenticated: true, account: accountPublic(result.account), sample: true },
    { headers: { ...noStore, "set-cookie": sessionCookie(result.token) } },
  );
}
