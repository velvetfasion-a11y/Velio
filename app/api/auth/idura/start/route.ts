import { appBaseUrl, iduraConfigured } from "@/lib/velio/auth-config";
import { iduraMethodFromParam } from "@/lib/velio/idura-claims";
import { beginIduraLogin, IDURA_TX_COOKIE } from "@/lib/velio/idura";
import { assertRateLimit, clientKey } from "@/lib/velio/rate-limit";

export const dynamic = "force-dynamic";

function cookieFlags(request: Request): string {
  const secure = appBaseUrl(request).startsWith("https://") ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function fail(request: Request, message: string, status = 302): Response {
  const location = `${appBaseUrl(request)}/?authError=${encodeURIComponent(message)}`;
  return new Response(null, {
    status,
    headers: {
      Location: location,
      "cache-control": "private, no-store",
    },
  });
}

/** Start Swedish BankID or Freja eID. The client secret stays on the server. */
export async function GET(request: Request) {
  const method = iduraMethodFromParam(new URL(request.url).searchParams.get("method"));
  if (!method) return fail(request, "Ogiltig inloggningsmetod.");
  if (!iduraConfigured()) {
    return fail(request, "BankID och Freja eID är inte aktiverade ännu.");
  }

  const limited = await assertRateLimit({
    key: clientKey(request, "idura-start"),
    limit: 20,
    windowMs: 15 * 60_000,
  });
  if (!limited.ok) return fail(request, "För många försök. Försök igen senare.");

  try {
    const started = await beginIduraLogin(request, method);
    const headers = new Headers({
      Location: started.redirectTo,
      "cache-control": "private, no-store",
    });
    headers.append(
      "set-cookie",
      `${IDURA_TX_COOKIE}=${encodeURIComponent(started.sealed)}; ${cookieFlags(request)}; Max-Age=600`,
    );
    return new Response(null, { status: 302, headers });
  } catch {
    return fail(request, "Kunde inte starta inloggningen hos Idura. Försök igen.");
  }
}
