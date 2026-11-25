import { appBaseUrl } from "@/lib/velio/auth-config";
import { EID_ONLY_MESSAGE } from "@/lib/velio/eid-policy";
import { exchangeGoogleCode, STATE_COOKIE } from "@/lib/velio/google-oauth";
import { sessionCookie, upsertGoogleAccount } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function GET(request: Request) {
  const base = appBaseUrl(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const expected = readCookie(request, STATE_COOKIE);

  const clearState = `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

  if (err) {
    return Response.redirect(`${base}/?authError=${encodeURIComponent("Google avbröts")}`, 302);
  }
  if (!code || !state || !expected || state !== expected) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${base}/?authError=${encodeURIComponent("Ogiltig Google-session")}`,
        "set-cookie": clearState,
      },
    });
  }

  try {
    const profile = await exchangeGoogleCode(request, code);
    if (!profile.emailVerified) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${base}/?authError=${encodeURIComponent("Google-kontot måste ha verifierad e-post")}`,
          "set-cookie": clearState,
        },
      });
    }
    const { token } = await upsertGoogleAccount({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      emailVerified: true,
    });
    const headers = new Headers({ Location: `${base}/` });
    headers.append("set-cookie", sessionCookie(token));
    headers.append("set-cookie", clearState);
    return new Response(null, { status: 302, headers });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "eid_only"
        ? EID_ONLY_MESSAGE
        : error instanceof Error
          ? error.message
          : "Google-inloggning misslyckades";
    const headers = new Headers({
      Location: `${base}/?authError=${encodeURIComponent(message)}`,
    });
    headers.append("set-cookie", clearState);
    return new Response(null, { status: 302, headers });
  }
}
