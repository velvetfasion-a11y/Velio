import { createHash, randomBytes } from "crypto";
import { appBaseUrl, env, googleConfigured } from "@/lib/velio/auth-config";

const STATE_COOKIE = "velio_oauth_state";

export { STATE_COOKIE };

export function googleAuthUrl(request: Request, state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: `${appBaseUrl(request)}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function createOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export async function exchangeGoogleCode(
  request: Request,
  code: string
): Promise<{
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}> {
  if (!googleConfigured()) {
    throw new Error("Google OAuth är inte konfigurerat.");
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: `${appBaseUrl(request)}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    throw new Error(`Google token-byte misslyckades: ${detail.slice(0, 200)}`);
  }
  const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string };
  if (!tokens.access_token) throw new Error("Saknar access_token från Google.");

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) {
    const detail = await profileRes.text();
    throw new Error(`Kunde inte hämta Google-profil: ${detail.slice(0, 200)}`);
  }
  const profile = (await profileRes.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!profile.sub || !profile.email) {
    throw new Error("Google returnerade ofullständig profil.");
  }
  return {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified: Boolean(profile.email_verified),
    name: profile.name || profile.email.split("@")[0] || "Google-användare",
    picture: profile.picture,
  };
}

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
