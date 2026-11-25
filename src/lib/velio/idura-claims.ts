/**
 * acr_values registered on the Velio Idura TEST application.
 * Same-device BankID, BankID QR on another device, and Swedish Freja eID.
 */
export const IDURA_METHODS = {
  bankid: "urn:grn:authn:se:bankid:same-device",
  "bankid-qr": "urn:grn:authn:se:bankid:another-device:qr",
  freja: "urn:grn:authn:se:frejaid",
} as const;

export type IduraMethod = keyof typeof IDURA_METHODS;

export const IDURA_CALLBACK_PATH = "/api/auth/idura/callback";

const ALLOWED_ACRS = new Set<string>(Object.values(IDURA_METHODS));

export function iduraMethodFromParam(value: string | null): IduraMethod | null {
  if (value === "bankid" || value === "bankid-qr" || value === "freja") return value;
  return null;
}

export function iduraRedirectUriFromBase(base: string): string {
  return `${base.replace(/\/$/, "")}${IDURA_CALLBACK_PATH}`;
}

export type VerifiedEidIdentity = {
  sub: string;
  name: string;
  personalNumber: string | null;
  scheme: "bankid" | "freja";
  identityScheme: string;
  acr: string;
};

type ClaimSet = {
  sub?: string;
  [claim: string]: unknown;
};

function claimString(claims: ClaimSet, key: string): string {
  const value = claims[key];
  return typeof value === "string" ? value.trim() : "";
}

function presentedAcrs(claims: ClaimSet): string[] {
  return ["acr", "authenticationtype", "authentication_type", "authenticationmethod"]
    .map((key) => claimString(claims, key))
    .filter((value) => value.startsWith("urn:grn:authn:"));
}

/**
 * Reads name, sub, and ssn from an ID token claim set that the OIDC library
 * has already signature-checked. Rejects methods outside the registered acr list.
 * Error messages never include the personnummer.
 */
export function parseIduraClaims(claims: ClaimSet, expectedAcr: string): VerifiedEidIdentity {
  if (!ALLOWED_ACRS.has(expectedAcr)) throw new Error("acr_not_allowed");
  const sub = claimString(claims, "sub");
  if (!sub) throw new Error("missing_sub");
  if (!presentedAcrs(claims).includes(expectedAcr)) throw new Error("acr_mismatch");

  const scheme: "bankid" | "freja" = expectedAcr.includes(":freja") ? "freja" : "bankid";
  const identityScheme = claimString(claims, "identityscheme");
  if (identityScheme) {
    const marker = identityScheme.toLowerCase();
    const ok = scheme === "freja" ? marker.includes("freja") : marker.includes("bankid");
    if (!ok) throw new Error("scheme_mismatch");
  }

  const rawSsn = claimString(claims, "ssn");
  let personalNumber: string | null = null;
  if (rawSsn) {
    const digits = rawSsn.replace(/\D/g, "");
    if (digits.length !== 10 && digits.length !== 12) throw new Error("invalid_ssn");
    personalNumber = digits;
  }

  const given = claimString(claims, "given_name") || claimString(claims, "givenname");
  const family = claimString(claims, "family_name") || claimString(claims, "surname");
  const combined = claimString(claims, "name") || [given, family].filter(Boolean).join(" ");
  const name = combined.trim().length >= 2 ? combined.trim() : "Användare";

  return {
    sub,
    name,
    personalNumber,
    scheme,
    identityScheme: identityScheme || (scheme === "freja" ? "sefreja" : "sebankid"),
    acr: expectedAcr,
  };
}
