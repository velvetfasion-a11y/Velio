import { randomBytes } from "crypto";
import { createChallenge } from "@/lib/velio/otp";
import { assertRateLimit, clientKey } from "@/lib/velio/rate-limit";
import { bankIdAuth, bankIdConfigured, bankIdLaunchUrl, clientIpFromRequest } from "@/lib/velio/bankid";
import { signValue } from "@/lib/velio/auth-secrets";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
const COOKIE = "velio_bankid_login";

/** Start BankID login — returns autoStartToken so the client can open the BankID app. */
export async function POST(request: Request) {
  if (!bankIdConfigured()) {
    return Response.json(
      {
        error: "bankid_not_configured",
        message: "BankID är inte aktiverat ännu. Lägg till BankID RP-uppgifter för att öppna BankID-appen.",
      },
      { status: 503, headers: noStore },
    );
  }

  const limited = await assertRateLimit({
    key: clientKey(request, "bankid-start"),
    limit: 15,
    windowMs: 15 * 60_000,
  });
  if (!limited.ok) {
    return Response.json(
      { error: "rate_limited", message: "För många försök. Försök igen senare." },
      { status: 429, headers: noStore },
    );
  }

  let body: { personalNumber?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const personalNumber = (body.personalNumber ?? "").replace(/\D/g, "");
  if (personalNumber && personalNumber.length !== 10 && personalNumber.length !== 12) {
    return Response.json(
      { error: "invalid_personal_number", message: "Ange personnummer som ÅÅÅÅMMDDXXXX." },
      { status: 400, headers: noStore },
    );
  }

  try {
    const started = await bankIdAuth({
      endUserIp: clientIpFromRequest(request),
      personalNumber: personalNumber || undefined,
    });
    const challenge = await createChallenge({
      kind: "bankid",
      target: started.orderRef,
      code: randomBytes(16).toString("hex"),
      payload: {
        orderRef: started.orderRef,
        autoStartToken: started.autoStartToken,
        personalNumber: personalNumber || null,
      },
      ttlMinutes: 5,
    });

    const proof = signValue(`${challenge.id}:${started.orderRef}`, 300);
    const headers = new Headers({ ...noStore, "content-type": "application/json" });
    headers.append(
      "set-cookie",
      `${COOKIE}=${encodeURIComponent(proof)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300`,
    );

    return new Response(
      JSON.stringify({
        challengeId: challenge.id,
        orderRef: started.orderRef,
        autoStartToken: started.autoStartToken,
        launchUrl: bankIdLaunchUrl(started.autoStartToken),
        message: "Öppna BankID-appen och identifiera dig.",
      }),
      { status: 200, headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "bankid_start_failed";
    return Response.json({ error: "bankid_start_failed", message }, { status: 502, headers: noStore });
  }
}
