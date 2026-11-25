import { appBaseUrl } from "@/lib/velio/auth-config";
import { EID_ONLY_MESSAGE } from "@/lib/velio/eid-policy";
import {
  completeIduraLogin,
  iduraCallbackUrl,
  IDURA_TX_COOKIE,
  readIduraTransaction,
  redactIduraError,
} from "@/lib/velio/idura";
import { loginOrCreateEidAccount, sessionCookie } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function clearTxCookie(request: Request): string {
  const secure = appBaseUrl(request).startsWith("https://") ? "; Secure" : "";
  return `${IDURA_TX_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function fail(request: Request, message: string): Response {
  const headers = new Headers({
    Location: `${appBaseUrl(request)}/?authError=${encodeURIComponent(message)}`,
    "cache-control": "private, no-store",
  });
  headers.append("set-cookie", clearTxCookie(request));
  return new Response(null, { status: 302, headers });
}

async function finish(request: Request): Promise<Response> {
  const sealed = readCookie(request, IDURA_TX_COOKIE);
  if (!sealed) {
    return fail(request, "Inloggningen kunde inte kopplas till den här webbläsaren. Försök igen.");
  }

  let tx;
  try {
    tx = readIduraTransaction(sealed);
  } catch {
    return fail(request, "Inloggningssessionen har gått ut. Försök igen.");
  }

  const callbackUrl = await iduraCallbackUrl(request);
  const oauthError = callbackUrl.searchParams.get("error");
  if (oauthError) {
    return fail(request, oauthError === "access_denied" ? "Inloggningen avbröts." : "Inloggningen misslyckades.");
  }

  try {
    const identity = await completeIduraLogin(callbackUrl, tx);
    const { token } = await loginOrCreateEidAccount({
      sub: identity.sub,
      name: identity.name,
      personalNumber: identity.personalNumber,
      scheme: identity.scheme,
      identityScheme: identity.identityScheme,
      acr: identity.acr,
    });
    const headers = new Headers({
      Location: `${appBaseUrl(request)}/`,
      "cache-control": "private, no-store",
    });
    headers.append("set-cookie", sessionCookie(token));
    headers.append("set-cookie", clearTxCookie(request));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "eid_only") {
      return fail(request, EID_ONLY_MESSAGE);
    }
    console.error("idura callback failed:", redactIduraError(error));
    return fail(request, "BankID- eller Freja-inloggningen kunde inte slutföras. Försök igen.");
  }
}

export async function GET(request: Request) {
  return finish(request);
}

export async function POST(request: Request) {
  return finish(request);
}
