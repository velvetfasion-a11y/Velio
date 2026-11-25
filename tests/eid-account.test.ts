import assert from "node:assert/strict";
import test from "node:test";

delete process.env.DATABASE_URL;
process.env.AUTH_SECRET = "integration-secret-integration-secret";

const SSN = "196802020575";

test("Idura identity is stored without exposing personnummer, and blocks email login", async () => {
  const { sql } = await import("@/lib/db.ts");
  const {
    accountPublic,
    getAccountById,
    loginOrCreateEidAccount,
    loginOrCreateVerifiedEmail,
    upsertGoogleAccount,
  } = await import("@/lib/velio/session.ts");

  await sql(
    `insert into accounts (id, provider, name, email, phone, provider_id, account_mode)
     values ('acc-legacy-pn', 'bankid', 'Legacy', 'legacy@velio.se', '', $1, 'customer')`,
    [`pn-${SSN}`],
  );

  const first = await loginOrCreateEidAccount({
    sub: "{bankid-sub}",
    name: "Terne Paulsen",
    personalNumber: "19680202-0575",
    scheme: "bankid",
    identityScheme: "sebankid",
    acr: "urn:grn:authn:se:bankid:same-device",
  });
  assert.equal(first.created, false);
  assert.equal(first.account.id, "acc-legacy-pn");
  assert.equal(accountPublic(first.account).providerId, null);
  assert.equal(JSON.stringify(accountPublic(first.account)).includes(SSN), false);

  const stored = await sql<{
    provider_id: string | null;
    eid_sub: string | null;
    personal_number_enc: string | null;
    personal_number_hash: string | null;
  }>(
    `select provider_id, eid_sub, personal_number_enc, personal_number_hash from accounts where id = $1`,
    [first.account.id],
  );
  assert.equal(stored[0]?.provider_id, null);
  assert.equal(stored[0]?.eid_sub, "{bankid-sub}");
  assert.equal(stored[0]?.personal_number_enc?.includes(SSN), false);
  assert.equal(stored[0]?.personal_number_hash?.includes(SSN), false);

  const again = await loginOrCreateEidAccount({
    sub: "freja-sub",
    name: "Terne Paulsen",
    personalNumber: SSN,
    scheme: "freja",
    identityScheme: "sefreja",
    acr: "urn:grn:authn:se:frejaid",
  });
  assert.equal(again.account.id, first.account.id);
  assert.equal(again.account.provider, "freja");
  const kept = await getAccountById(first.account.id);
  assert.ok(kept);
  const subRow = await sql<{ eid_sub: string }>(`select eid_sub from accounts where id = $1`, [first.account.id]);
  assert.equal(subRow[0]?.eid_sub, "{bankid-sub}");

  await assert.rejects(
    () => loginOrCreateVerifiedEmail({ email: "legacy@velio.se", name: "Legacy" }),
    (error: unknown) => error instanceof Error && error.message === "eid_only",
  );
  await assert.rejects(
    () =>
      upsertGoogleAccount({
        sub: "google-sub",
        email: "legacy@velio.se",
        name: "Legacy",
        emailVerified: true,
      }),
    (error: unknown) => error instanceof Error && error.message === "eid_only",
  );
});
