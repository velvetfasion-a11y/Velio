import type { IdentityStage } from "../../../cursor/identity";
import { sql } from "@/lib/db";
import type { StoredAppState, StoredProfile } from "@/lib/velio/sync-types";

export type { StoredAppState, StoredProfile };

type ProfileRow = {
  owner: string;
  stage: string;
  name: string;
  phone: string;
  email: string;
  account_mode: string;
  app_state: StoredAppState | string;
};

function parseState(value: ProfileRow["app_state"]): StoredAppState {
  if (value && typeof value === "object") return value as StoredAppState;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as StoredAppState;
    } catch {
      return {};
    }
  }
  return {};
}

export async function getOrCreateProfile(input: {
  owner: string;
  stage: IdentityStage;
  name: string;
  email: string;
}) {
  const existing = await sql<ProfileRow>(
    `select owner, stage, name, phone, email, account_mode, app_state
     from profiles where owner = $1 and stage = $2`,
    [input.owner, input.stage],
  );

  if (existing[0]) {
    const row = existing[0];
    const name = row.name || input.name;
    const email = row.email || input.email;
    if ((!row.name && input.name) || (!row.email && input.email)) {
      await sql(
        `update profiles set name = $3, email = $4, updated_at = now()
         where owner = $1 and stage = $2`,
        [input.owner, input.stage, name, email],
      );
    }
    return {
      profile: {
        name,
        phone: row.phone,
        email,
        accountMode: (row.account_mode === "business" ? "business" : "customer") as
          | "customer"
          | "business",
      },
      state: parseState(row.app_state),
    };
  }

  const name = input.name || "VELIO-kund";
  const email = input.email || "";
  await sql(
    `insert into profiles (owner, stage, name, phone, email, account_mode, app_state)
     values ($1, $2, $3, '', $4, 'customer', '{}'::jsonb)`,
    [input.owner, input.stage, name, email],
  );

  return {
    profile: { name, phone: "", email, accountMode: "customer" as const },
    state: {} as StoredAppState,
  };
}

export async function saveProfileState(input: {
  owner: string;
  stage: IdentityStage;
  profile: StoredProfile;
  state: StoredAppState;
}) {
  await sql(
    `insert into profiles (owner, stage, name, phone, email, account_mode, app_state, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
     on conflict (owner, stage) do update set
       name = excluded.name,
       phone = excluded.phone,
       email = excluded.email,
       account_mode = excluded.account_mode,
       app_state = excluded.app_state,
       updated_at = now()`,
    [
      input.owner,
      input.stage,
      input.profile.name,
      input.profile.phone,
      input.profile.email,
      input.profile.accountMode,
      JSON.stringify(input.state),
    ],
  );
}
