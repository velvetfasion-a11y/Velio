export function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function googleConfigured(): boolean {
  return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
}

export function emailConfigured(): boolean {
  return Boolean(env("RESEND_API_KEY") && env("EMAIL_FROM"));
}

export function smsConfigured(): boolean {
  return Boolean(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_FROM_NUMBER"));
}

export function bankIdConfigured(): boolean {
  return Boolean(env("BANKID_API_URL") && env("BANKID_API_KEY"));
}

export const IDURA_DEFAULT_ISSUER = "https://velio.test.idura.broker";
export const IDURA_DEFAULT_CLIENT_ID = "urn:my:application:identifier:289054";

export function iduraIssuer(): string {
  return env("IDURA_ISSUER") || IDURA_DEFAULT_ISSUER;
}

export function iduraClientId(): string {
  return env("IDURA_CLIENT_ID") || IDURA_DEFAULT_CLIENT_ID;
}

/** True only when the server holds the client secret. The secret is never sent to the app. */
export function iduraConfigured(): boolean {
  return Boolean(env("IDURA_CLIENT_SECRET") && iduraIssuer() && iduraClientId());
}

export function appBaseUrl(request?: Request): string {
  const fromEnv = env("APP_BASE_URL").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (request) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "http";
    if (host) return `${proto}://${host}`;
  }
  return "http://127.0.0.1:8080";
}

export function authCapabilities() {
  return {
    google: googleConfigured(),
    email: emailConfigured(),
    sms: smsConfigured(),
    bankid: bankIdConfigured(),
    idura: iduraConfigured(),
    freja: iduraConfigured(),
    sampleFallback: false,
  };
}
