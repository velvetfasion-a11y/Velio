import { smsConfigured } from "@/lib/velio/auth-config";
import { createChallenge, normalizePhone, sendSmsCode } from "@/lib/velio/otp";
import { assertRateLimit, clientKey } from "@/lib/velio/rate-limit";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  if (!smsConfigured()) {
    return Response.json(
      {
        error: "sms_not_configured",
        message: "SMS-inloggning kräver Twilio-uppgifter.",
      },
      { status: 503, headers: noStore },
    );
  }

  let body: { phone?: string; name?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  const phone = normalizePhone(body.phone ?? "");
  if (phone.replace(/\D/g, "").length < 8) {
    return Response.json({ error: "invalid_phone", message: "Ange ett giltigt mobilnummer." }, { status: 400, headers: noStore });
  }

  const limited = await assertRateLimit({
    key: clientKey(request, `sms:${phone}`),
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return Response.json(
      { error: "rate_limited", message: `För många försök. Vänta ${limited.retryAfterSec}s.` },
      { status: 429, headers: noStore },
    );
  }

  try {
    const challenge = await createChallenge({
      kind: "sms",
      target: phone,
      payload: { name: body.name?.trim() || "" },
    });
    await sendSmsCode(phone, challenge.code);
    return Response.json(
      {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
        message: "Vi har skickat en kod via SMS.",
      },
      { headers: noStore },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "sms_send_failed";
    return Response.json({ error: "sms_send_failed", message }, { status: 502, headers: noStore });
  }
}
