import { getIdentity } from "../../../cursor/identity";
import { getOrCreateProfile } from "@/lib/velio/user-store";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  const identity = await getIdentity(request);
  if (!identity.verified) {
    return Response.json(
      { authenticated: false, reason: identity.reason },
      { status: 200, headers: noStore },
    );
  }

  if (identity.kind === "key") {
    return Response.json(
      { authenticated: false, reason: "api_key" },
      { status: 200, headers: noStore },
    );
  }

  const { profile, state } = await getOrCreateProfile({
    owner: identity.sub,
    stage: identity.stage,
    name: identity.name,
    email: identity.email,
  });

  return Response.json(
    {
      authenticated: true,
      simulated: identity.simulated,
      stage: identity.stage,
      viewer: {
        name: identity.name || profile.name,
        email: identity.email || profile.email,
      },
      profile: {
        name: profile.name || identity.name,
        phone: profile.phone,
        email: profile.email || identity.email,
      },
      accountMode: state.accountMode ?? profile.accountMode,
      state,
    },
    { headers: noStore },
  );
}
