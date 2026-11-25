/**
 * BankID relying-party rule: an account identified with BankID (or Freja eID)
 * must not also be reachable with a weaker login such as email, SMS, or Google.
 * Business "ID verified" flags are not enough on their own — seed data marks
 * some non-BankID accounts that way. The login provider is the source of truth.
 */
export const EID_ONLY_MESSAGE =
  "Det här kontot är identifierat med BankID eller Freja eID och kan bara loggas in med BankID eller Freja eID.";

export function isEidOnlyProvider(provider: string | null | undefined): boolean {
  return provider === "bankid" || provider === "freja";
}

/** Hide a stored personnummer if an older row put it in provider_id. */
export function redactProviderId(providerId: string | null): string | null {
  if (!providerId) return null;
  if (/^pn-\d{10,12}$/.test(providerId)) return null;
  return providerId;
}
