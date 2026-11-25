import { randomBytes } from "crypto";
import { env } from "@/lib/velio/auth-config";
import { createChallenge } from "@/lib/velio/otp";
import { signValue } from "@/lib/velio/auth-secrets";
import { getAccountBySession } from "@/lib/velio/session";
import { bankIdAuth, bankIdConfigured, bankIdLaunchUrl, clientIpFromRequest } from "@/lib/velio/bankid";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
const COOKIE = "velio_bankid";

/** Starts a real BankID identity session. Does nothing if the RP is not configured. */
export async function POST(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  if (!bankIdConfigured() || !env("BANKID_API_URL") || !env("BANKID_API_KEY")) {
    return Response.json(
      {
        error: "bankid_not_configured",
        message: "BankID är inte kopplat. Ingen identitet har verifierats.",
      },
      { status: 503, headers: noStore },
    );
  }

  try {
    const started = await bankIdAuth({ endUserIp: clientIpFromRequest(request) });
    const challenge = await createChallenge({
      kind: "bankid",
      target: account.id,
      code: randomBytes(16).toString("hex"),
      payload: {
        orderRef: started.orderRef,
        autoStartToken: started.autoStartToken,
        accountId: account.id,
      },
      ttlMinutes: 5,
    });

    const proof = signValue(`${challenge.id}:${account.id}`, 300);
    const headers = new Headers({ ...noStore, "content-type": "application/json" });
    headers.append(
      "set-cookie",
      `${COOKIE}=${encodeURIComponent(proof)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300`,
    );

    return new Response(
      JSON.stringify({
        challengeId: challenge.id,
        orderRef: started.orderRef,
        launchUrl: bankIdLaunchUrl(started.autoStartToken),
        message: "Öppna BankID-appen och identifiera dig. VELIO väntar på svar från BankID.",
      }),
      { status: 200, headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "bankid_start_failed";
    return Response.json({ error: "bankid_start_failed", message }, { status: 502, headers: noStore });
  }
}
