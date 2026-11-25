import assert from "node:assert/strict";
import test from "node:test";
import { redactProviderId } from "../src/lib/velio/eid-policy.ts";
import {
  IDURA_CALLBACK_PATH,
  IDURA_METHODS,
  iduraMethodFromParam,
  iduraRedirectUriFromBase,
  parseIduraClaims,
} from "../src/lib/velio/idura-claims.ts";
import { openIduraTransaction, sealIduraTransaction } from "../src/lib/velio/idura-tx.ts";
import {
  decryptPersonalNumber,
  encryptPersonalNumber,
  normalizePersonalNumber,
  personalNumberLookupHash,
} from "../src/lib/velio/personal-number.ts";

const SECRET = "test-secret-test-secret-test-secret";
const SSN = "196802020575";

test("normalizes Swedish personnummer and rejects other shapes", () => {
  assert.equal(normalizePersonalNumber("19680202-0575"), SSN);
  assert.equal(normalizePersonalNumber("680202-0575"), "6802020575");
  assert.equal(normalizePersonalNumber(""), null);
  assert.equal(normalizePersonalNumber("123"), null);
  assert.equal(normalizePersonalNumber("not-a-number"), null);
});

test("encrypts personnummer so the stored value is not the number", () => {
  const enc = encryptPersonalNumber(SSN, SECRET);
  assert.equal(enc.startsWith("v1."), true);
  assert.equal(enc.includes(SSN), false);
  assert.equal(decryptPersonalNumber(enc, SECRET), SSN);
  assert.throws(() => decryptPersonalNumber(enc, "other-secret-other-secret-other"));
  const parts = enc.split(".");
  parts[3] = parts[3]?.startsWith("A") ? `B${parts[3].slice(1)}` : `A${parts[3]?.slice(1) ?? ""}`;
  assert.throws(() => decryptPersonalNumber(parts.join("."), SECRET));
});

test("lookup hash is stable, keyed, and not the personnummer", () => {
  const hash = personalNumberLookupHash(SSN, SECRET);
  assert.equal(hash, personalNumberLookupHash(SSN, SECRET));
  assert.notEqual(hash, personalNumberLookupHash(SSN, "other-secret-other-secret-other"));
  assert.equal(hash.includes(SSN), false);
  assert.equal(hash.length, 64);
});

test("redirect URI is the app callback, not /callback on port 3000", () => {
  assert.equal(IDURA_CALLBACK_PATH, "/api/auth/idura/callback");
  assert.equal(
    iduraRedirectUriFromBase("http://localhost:8080/"),
    "http://localhost:8080/api/auth/idura/callback",
  );
  assert.equal(iduraMethodFromParam("bankid"), "bankid");
  assert.equal(iduraMethodFromParam("bankid-qr"), "bankid-qr");
  assert.equal(iduraMethodFromParam("freja"), "freja");
  assert.equal(iduraMethodFromParam("password"), null);
  assert.deepEqual(Object.values(IDURA_METHODS), [
    "urn:grn:authn:se:bankid:same-device",
    "urn:grn:authn:se:bankid:another-device:qr",
    "urn:grn:authn:se:frejaid",
  ]);
});

test("parses a BankID id_token claim set", () => {
  const identity = parseIduraClaims(
    {
      sub: "{1373c272-b61a-4cb5-88b2-9c44883fe62f}",
      identityscheme: "sebankid",
      acr: IDURA_METHODS.bankid,
      ssn: "19680202-0575",
      name: "Terne Paulsen",
      given_name: "Terne",
      family_name: "Paulsen",
    },
    IDURA_METHODS.bankid,
  );
  assert.equal(identity.scheme, "bankid");
  assert.equal(identity.personalNumber, SSN);
  assert.equal(identity.name, "Terne Paulsen");
  assert.equal(identity.sub.startsWith("{"), true);
});

test("parses Freja and builds a name from given and family names", () => {
  const identity = parseIduraClaims(
    {
      sub: "freja-subject",
      identityscheme: "sefreja",
      authenticationtype: IDURA_METHODS.freja,
      givenname: "Ada",
      surname: "Lov",
    },
    IDURA_METHODS.freja,
  );
  assert.equal(identity.scheme, "freja");
  assert.equal(identity.name, "Ada Lov");
  assert.equal(identity.personalNumber, null);
});

test("rejects a weaker or unexpected authentication method without echoing ssn", () => {
  assert.throws(
    () =>
      parseIduraClaims(
        { sub: "abc", acr: "urn:grn:authn:se:bankid:same-device", ssn: SSN, identityscheme: "sebankid" },
        "urn:example:password",
      ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "acr_not_allowed");
      assert.equal(error.message.includes(SSN), false);
      return true;
    },
  );
  assert.throws(
    () => parseIduraClaims({ sub: "abc", acr: IDURA_METHODS.freja, identityscheme: "sefreja" }, IDURA_METHODS.bankid),
    (error: unknown) => error instanceof Error && error.message === "acr_mismatch",
  );
  assert.throws(
    () =>
      parseIduraClaims(
        { sub: "abc", acr: IDURA_METHODS.bankid, ssn: "12345", identityscheme: "sebankid", name: "Terne Paulsen" },
        IDURA_METHODS.bankid,
      ),
    (error: unknown) => error instanceof Error && error.message === "invalid_ssn" && !error.message.includes("12345"),
  );
  assert.throws(
    () => parseIduraClaims({ acr: IDURA_METHODS.bankid, name: "Terne Paulsen" }, IDURA_METHODS.bankid),
    (error: unknown) => error instanceof Error && error.message === "missing_sub",
  );
});

test("seals the OIDC transaction and rejects tampering", () => {
  const tx = {
    state: "state-value",
    nonce: "nonce-value",
    codeVerifier: "verifier-value-verifier-value-verifier-value",
    acr: IDURA_METHODS.bankid,
    method: "bankid" as const,
  };
  const sealed = sealIduraTransaction(tx, SECRET, 1_000);
  assert.deepEqual(openIduraTransaction(sealed, SECRET, 1_000), tx);
  assert.throws(() => openIduraTransaction(sealed, "nope", 1_000));
  assert.throws(() => openIduraTransaction(`${sealed}x`, SECRET, 1_000));
  assert.throws(() => openIduraTransaction(sealed, SECRET, 1_000 + 11 * 60 * 1000));
  assert.equal(sealed.includes("verifier-value"), false);
});

test("does not publish a personnummer stored as a legacy provider id", () => {
  assert.equal(redactProviderId(`pn-${SSN}`), null);
  assert.equal(redactProviderId("el-erik"), "el-erik");
  assert.equal(redactProviderId(null), null);
});
