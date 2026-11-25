/** Pick the name shown in the app. A name the person typed beats the mailbox prefix. */

function trimName(value: string | null | undefined, max = 80) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function mailboxLabel(email: string | null | undefined) {
  return trimName(email?.split("@")[0] ?? "");
}

export function isMailboxLabel(value: string | null | undefined, email: string | null | undefined) {
  const label = trimName(value).toLowerCase();
  const local = mailboxLabel(email).toLowerCase();
  if (!label || !local) return false;
  return label === local;
}

export function chooseDisplayName(input: {
  typed?: string | null;
  authName?: string | null;
  email?: string | null;
  stored?: string | null;
}) {
  const typed = trimName(input.typed);
  const authName = trimName(input.authName);
  const stored = trimName(input.stored);
  const local = mailboxLabel(input.email);
  const fromAuth = authName && !isMailboxLabel(authName, input.email) ? authName : "";
  const better = typed || fromAuth;
  if (better && (!stored || isMailboxLabel(stored, input.email))) return better;
  if (stored) return stored;
  return better || authName || local || "VELIO";
}
