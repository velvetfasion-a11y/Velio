import { randomBytes } from "crypto";
import { createChallenge } from "@/lib/velio/otp";
import { getAccountBySession } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

/** Starts a BankID identity session for upgrading to VELIO Business. */
export async function POST(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
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
  const autoStartToken = randomBytes(16).toString("hex");
  const challenge = await createChallenge({
    kind: "bankid",
    target: account.id,
    code: orderRef.slice(-6),
    payload: {
      orderRef,
      autoStartToken,
      personalNumber: personalNumber || null,
      accountId: account.id,
    },
    ttlMinutes: 5,
  });

  return Response.json(
    {
      challengeId: challenge.id,
      orderRef,
      autoStartToken,
      qrHint: "Öppna BankID-appen och slutför identifieringen.",
      sample: true,
      message:
        "BankID-verifiering startad. I produktion anropas BankID Relying Party API. Här slutför du med knappen när du identifierat dig.",
    },
    { headers: noStore },
  );
}
