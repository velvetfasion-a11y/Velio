import { getIdentity } from "../../../../cursor/identity";
import { accountPublic, loginOrCreateVerifiedEmail, sessionCookie, updateAccount } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

/** Sign in with the Cursor-hosted app identity (private/team publish). */
export async function POST(request: Request) {
  const identity = await getIdentity(request);
  if (!identity || !identity.verified || identity.kind !== "person") {
    return Response.json(
      {
        error: "identity_required",
        message: "Logga in med Cursor för att fortsätta, eller konfigurera Google/e-post/SMS.",
      },
      { status: 401, headers: noStore },
    );
  }

  const email = identity.email?.trim().toLowerCase();
  if (!email || !identity.emailVerified) {
    return Response.json(
      { error: "email_required", message: "Cursor-kontot behöver en verifierad e-postadress." },
      { status: 400, headers: noStore },
    );
  }

  const name = identity.name?.trim() || email.split("@")[0] || "VELIO-användare";
  const result = await loginOrCreateVerifiedEmail({ email, name });

  // Bind Cursor subject as identity proof for Business (not a substitute for BankID in SE production,
  // but a signed host identity rather than self-attested form fields).
  const updated = await updateAccount(result.account.id, {
    emailVerified: true,
    idVerified: true,
    idMethod: "cursor",
  });

  return Response.json(
    { authenticated: true, account: accountPublic(updated) },
    { headers: { ...noStore, "set-cookie": sessionCookie(result.token) } },
  );
}
