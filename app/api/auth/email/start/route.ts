import { createChallenge, normalizeEmail, sendEmailCode } from "@/lib/velio/otp";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  let body: { email?: string; name?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  const email = normalizeEmail(body.email ?? "");
  if (!email.includes("@") || email.length < 5) {
    return Response.json({ error: "invalid_email", message: "Ange en giltig e-postadress." }, { status: 400, headers: noStore });
  }

  try {
    const challenge = await createChallenge({
      kind: "email",
      target: email,
      payload: { name: body.name?.trim() || "" },
    });
    const delivery = await sendEmailCode(email, challenge.code);
    return Response.json(
      {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
        sample: Boolean(delivery.sample),
        sampleCode: delivery.sample ? challenge.code : undefined,
        message: delivery.sample
          ? "E-postleverans är inte konfigurerad ännu — använd sample-koden som visas."
          : "Vi har skickat en verifieringskod till din e-post.",
      },
      { headers: noStore },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "email_send_failed";
    return Response.json({ error: "email_send_failed", message }, { status: 502, headers: noStore });
  }
}
