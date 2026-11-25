import { FieldValue } from "firebase-admin/firestore";

const hidden = new Set(["nationalId", "personnummer", "password", "token"]);

function clean(payload) {
  if (!payload || typeof payload !== "object") return {};
  const next = {};
  for (const [key, value] of Object.entries(payload)) {
    if (hidden.has(key)) continue;
    if (typeof value === "string") next[key] = value.slice(0, 500);
    else if (typeof value === "number" || typeof value === "boolean" || value == null) next[key] = value;
  }
  return next;
}

export async function writeAudit(db, actorUid, action, targetType, targetId, payload) {
  await db.collection("auditLogs").add({
    actorUid,
    action,
    targetType,
    targetId: String(targetId || ""),
    payload: clean(payload),
    createdAt: FieldValue.serverTimestamp(),
  });
}
