import { env } from "@/lib/velio/auth-config";

export function bankIdConfigured(): boolean {
  return Boolean(env("BANKID_API_URL") && env("BANKID_API_KEY"));
}

function bankIdBase(): string {
  return env("BANKID_API_URL").replace(/\/$/, "");
}

function bankIdHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env("BANKID_API_KEY")}`,
  };
}

export type BankIdAuthStart = {
  orderRef: string;
  autoStartToken: string;
  qrStartToken?: string;
  qrStartSecret?: string;
};

export type BankIdCollect =
  | {
      status: "pending";
      hintCode?: string;
    }
  | {
      status: "failed";
      hintCode?: string;
    }
  | {
      status: "complete";
      personalNumber: string;
      name: string;
      givenName?: string;
      surname?: string;
    };

/** Start a BankID auth order via the configured RP API. */
export async function bankIdAuth(input: {
  endUserIp: string;
  personalNumber?: string;
}): Promise<BankIdAuthStart> {
  if (!bankIdConfigured()) throw new Error("bankid_not_configured");
  const body: Record<string, unknown> = { endUserIp: input.endUserIp };
  if (input.personalNumber) body.personalNumber = input.personalNumber;

  const res = await fetch(`${bankIdBase()}/auth`, {
    method: "POST",
    headers: bankIdHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`BankID auth misslyckades (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as BankIdAuthStart;
  if (!data.orderRef || !data.autoStartToken) {
    throw new Error("BankID returnerade ofullständigt svar.");
  }
  return data;
}

/** Poll BankID collect until pending/failed/complete. */
export async function bankIdCollect(orderRef: string): Promise<BankIdCollect> {
  if (!bankIdConfigured()) throw new Error("bankid_not_configured");
  const res = await fetch(`${bankIdBase()}/collect`, {
    method: "POST",
    headers: bankIdHeaders(),
    body: JSON.stringify({ orderRef }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`BankID collect misslyckades (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    status?: string;
    hintCode?: string;
    completionData?: {
      user?: { personalNumber?: string; name?: string; givenName?: string; surname?: string };
    };
  };
  if (data.status === "complete") {
    const user = data.completionData?.user;
    const personalNumber = user?.personalNumber || "";
    const name = user?.name || [user?.givenName, user?.surname].filter(Boolean).join(" ") || "BankID-användare";
    if (!personalNumber && !user?.name) {
      throw new Error("BankID returnerade ingen användaridentitet.");
    }
    return {
      status: "complete",
      personalNumber,
      name,
      givenName: user?.givenName,
      surname: user?.surname,
    };
  }
  if (data.status === "failed") {
    return { status: "failed", hintCode: data.hintCode };
  }
  return { status: "pending", hintCode: data.hintCode };
}

/** Deep link that opens the BankID app on the device. */
export function bankIdLaunchUrl(autoStartToken: string): string {
  const token = encodeURIComponent(autoStartToken);
  // Universal / app link used by BankID on mobile and desktop.
  return `https://app.bankid.com/?autostarttoken=${token}&redirect=null`;
}

export function clientIpFromRequest(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || request.headers.get("x-real-ip") || "127.0.0.1";
}
