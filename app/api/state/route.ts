import { requireIdentity } from "../../../cursor/identity";
import type { StoredAppState, StoredProfile } from "@/lib/velio/sync-types";
import { saveProfileState } from "@/lib/velio/user-store";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

type Body = {
  profile?: StoredProfile;
  state?: StoredAppState;
};

export async function PUT(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  if (identity.kind === "key") {
    return Response.json({ error: "person_required" }, { status: 403, headers: noStore });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  const profile: StoredProfile = {
    name: body.profile?.name?.trim() || identity.name || "VELIO-kund",
    phone: body.profile?.phone?.trim() || "",
    email: body.profile?.email?.trim() || identity.email || "",
    accountMode: body.profile?.accountMode === "business" ? "business" : "customer",
  };

  const state: StoredAppState = body.state ?? {};

  await saveProfileState({
    owner: identity.sub,
    stage: identity.stage,
    profile,
    state: {
      ...state,
      profile,
      accountMode: profile.accountMode,
    },
  });

  return Response.json({ ok: true }, { headers: noStore });
}
