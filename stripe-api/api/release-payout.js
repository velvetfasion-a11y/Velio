import { FieldValue } from "firebase-admin/firestore";
import { applyCors } from "../lib/cors.js";
import { adminDb, userFromRequest } from "../lib/firebase.js";
import { scheduleOrTransfer } from "../lib/payouts.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await userFromRequest(req);
    const jobId = String(req.body?.jobId || "");
    if (!jobId) return res.status(400).json({ error: "jobId saknas" });
    const ref = adminDb().collection("jobs").doc(jobId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Uppdraget finns inte" });
    if (snap.data().ownerId !== user.uid) return res.status(403).json({ error: "Bara kunden kan avsluta uppdraget" });
    if (!snap.data().completedAt) {
      await ref.set(
        {
          status: "completed",
          completedAt: FieldValue.serverTimestamp(),
          payoutStatus: snap.data().payoutStatus || "scheduled",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    const result = await scheduleOrTransfer(jobId);
    return res.status(200).json(result);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Utbetalningen kunde inte planeras" });
  }
}
