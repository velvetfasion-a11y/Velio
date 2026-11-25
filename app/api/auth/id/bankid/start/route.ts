import { randomBytes } from "crypto";
import { env } from "@/lib/velio/auth-config";
import { createChallenge } from "@/lib/velio/otp";
import { signValue } from "@/lib/velio/auth-secrets";
import { getAccountBySession } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
const COOKIE = "velio_bankid";

function bankIdConfigured(): boolean {
  return Boolean(env("BANKID_API_URL") && env("BANKID_API_KEY"));
}

/** Starts a BankID identity session for upgrading to VELIO Business. */
export async function POST(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  if (!bankIdConfigured()) {
    return Response.json(
      {
        error: "bankid_not_configured",
        message:
          "BankID kräver BANKID_API_URL och BANKID_API_KEY. Använd Cursor-identitet eller skicka pass för granskning.",
      },
      { status: 503, headers: noStore },
    );
  }

  let body: { personalNumber?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const personalNumber = (body.personalNumber ?? "").replace(/\D/g, "");
  if (personalNumber && personalNumber.length !== 12 && personalNumber.length !== 10) {
    return Response.json(
      { error: "invalid_personal_number", message: "Ange personnummer som ÅÅÅÅMMDDXXXX." },
      { status: 400, headers: noStore },
    );
  }

  const orderRef = `bid_${randomBytes(10).toString("hex")}`;
  const challenge = await createChallenge({
    kind: "bankid",
    target: account.id,
    code: randomBytes(16).toString("hex"),
    payload: {
      orderRef,
      personalNumber: personalNumber || null,
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

  // Production: call BankID RP auth/sign here with BANKID_API_URL + key, return QR/autoStartToken from RP.
  return new Response(
    JSON.stringify({
      challengeId: challenge.id,
      orderRef,
      message: "BankID-session startad. Slutför i BankID-appen, sedan bekräfta här.",
    }),
    { status: 200, headers },
  );
}
