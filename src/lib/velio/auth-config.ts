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
    sampleFallback: false,
  };
}
