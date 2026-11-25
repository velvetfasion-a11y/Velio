/** Client-side Google Identity Services (used when server OAuth is unavailable). */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; width?: number; text?: string; shape?: string },
          ) => void;
        };
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

export function publicGoogleClientId(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
}

export function googleGisAvailable(): boolean {
  return Boolean(publicGoogleClientId());
}

function loadGisScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Ingen webbläsare"));
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Kunde inte ladda Google")));
      if (window.google?.accounts?.id) resolve();
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Kunde inte ladda Google"));
    document.head.appendChild(script);
  });
}

function decodeJwtPayload(credential: string): {
  iss?: string;
  aud?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  sub?: string;
} {
  const parts = credential.split(".");
  if (parts.length < 2) throw new Error("Ogiltig Google-token");
  const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as ReturnType<typeof decodeJwtPayload>;
}

export type GoogleGisProfile = {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

/** Opens Google One Tap / account chooser and resolves a verified profile. */
export async function signInWithGoogleGis(): Promise<GoogleGisProfile> {
  const clientId = publicGoogleClientId();
  if (!clientId) {
    throw new Error("Google-inloggning är inte aktiverad ännu.");
  }
  await loadGisScript();
  if (!window.google?.accounts?.id) {
    throw new Error("Google-inloggning kunde inte startas.");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    window.google!.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        try {
          const payload = decodeJwtPayload(response.credential);
          const audOk = payload.aud === clientId;
          const issOk = payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";
          const expOk = typeof payload.exp === "number" && payload.exp * 1000 > Date.now() - 60_000;
          if (!audOk || !issOk || !expOk) throw new Error("Google-token kunde inte verifieras.");
          if (!payload.email || !payload.sub) throw new Error("Google returnerade ofullständig profil.");
          if (payload.email_verified === false) throw new Error("Google-kontot har inte verifierad e-post.");
          finish(() =>
            resolve({
              sub: payload.sub!,
              email: payload.email!.toLowerCase(),
              name: payload.name || payload.email!.split("@")[0] || "Google-användare",
              emailVerified: true,
            }),
          );
        } catch (error) {
          finish(() => reject(error instanceof Error ? error : new Error("Google-inloggning misslyckades")));
        }
      },
    });

    window.google!.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        finish(() => reject(new Error("Google-inloggningen avbröts.")));
      }
    });

    window.setTimeout(() => {
      finish(() => reject(new Error("Google-inloggningen tog för lång tid.")));
    }, 120_000);
  });
}
