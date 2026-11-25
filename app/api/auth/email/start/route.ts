import { emailConfigured } from "@/lib/velio/auth-config";
import { createChallenge, normalizeEmail, sendEmailCode } from "@/lib/velio/otp";
import { assertRateLimit, clientKey } from "@/lib/velio/rate-limit";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  if (!emailConfigured()) {
    return Response.json(
      {
        error: "email_not_configured",
        message: "E-postinloggning kräver RESEND_API_KEY och EMAIL_FROM.",
      },
      { status: 503, headers: noStore },
    );
  }

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

  const limited = await assertRateLimit({
    key: clientKey(request, `email:${email}`),
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
      kind: "email",
      target: email,
      payload: { name: body.name?.trim() || "" },
    });
    await sendEmailCode(email, challenge.code);
    return Response.json(
      {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
        message: "Vi har skickat en verifieringskod till din e-post.",
      },
      { headers: noStore },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "email_send_failed";
    return Response.json({ error: "email_send_failed", message }, { status: 502, headers: noStore });
  }
}
