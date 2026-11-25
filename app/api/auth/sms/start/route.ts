import { createChallenge, normalizePhone, sendSmsCode } from "@/lib/velio/otp";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
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

  try {
    const challenge = await createChallenge({
      kind: "sms",
      target: phone,
      payload: { name: body.name?.trim() || "" },
    });
    const delivery = await sendSmsCode(phone, challenge.code);
    return Response.json(
      {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
        sample: Boolean(delivery.sample),
        sampleCode: delivery.sample ? challenge.code : undefined,
        message: delivery.sample
          ? "SMS-leverans är inte konfigurerad ännu — använd sample-koden som visas."
          : "Vi har skickat en kod via SMS.",
      },
      { headers: noStore },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "sms_send_failed";
    return Response.json({ error: "sms_send_failed", message }, { status: 502, headers: noStore });
  }
}
