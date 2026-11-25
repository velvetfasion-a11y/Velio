import { googleConfigured } from "@/lib/velio/auth-config";
import { createOAuthState, googleAuthUrl, STATE_COOKIE } from "@/lib/velio/google-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!googleConfigured()) {
    return Response.json(
      {
        error: "google_not_configured",
        message:
          "Google-inloggning är inte aktiverad ännu.",
      },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }

  const state = createOAuthState();
  const url = googleAuthUrl(request, state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "set-cookie": `${STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
      "cache-control": "private, no-store",
    },
  });
}
