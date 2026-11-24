import type { StoredAppState, StoredProfile } from "@/lib/velio/sync-types";

export type MeResponse =
  | {
      authenticated: true;
      simulated: boolean;
      stage: "production" | "preview";
      viewer: { name: string; email: string };
      profile: { name: string; phone: string; email: string };
      accountMode: "customer" | "business";
      state: StoredAppState;
    }
  | {
      authenticated: false;
      reason?: string;
    };

export async function fetchMe(): Promise<MeResponse> {
  const response = await fetch("/api/me", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    return { authenticated: false, reason: "http_error" };
  }
  return (await response.json()) as MeResponse;
}

export async function saveRemoteState(input: {
  profile: StoredProfile;
  state: StoredAppState;
}): Promise<boolean> {
  const response = await fetch("/api/state", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.ok;
}
