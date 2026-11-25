import { FieldValue } from "firebase-admin/firestore";

const HOUR = 60 * 60 * 1000;

export function millisOf(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function stuckReason(job, now = Date.now()) {
  const updated = millisOf(job.updatedAt) || millisOf(job.createdAt) || now;
  const age = now - updated;
  if (job.status === "assigned" && (!job.paymentStatus || job.paymentStatus === "requires_payment" || job.paymentStatus === "failed") && age > 24 * HOUR) {
    return "Tilldelat utan betalning i mer än ett dygn";
  }
  if (job.paymentStatus === "processing" && age > HOUR) return "Betalningen har stått och väntat i mer än en timme";
  const completed = millisOf(job.completedAt);
  if (job.status === "completed" && job.payoutStatus === "scheduled" && completed && now - completed > 27 * HOUR) {
    return "Utbetalningen har inte gått efter väntetiden";
  }
  if (job.status === "completed" && job.payoutStatus === "failed") return "Utbetalningen misslyckades";
  const paid = millisOf(job.paidAt);
  if (job.paymentStatus === "succeeded" && job.status === "assigned" && !job.completedAt && paid && now - paid > 48 * HOUR) {
    return "Betalt men inte markerat klart på två dygn";
  }
  return "";
}

export async function upsertAlert(db, alert) {
  const id = String(alert.key).replace(/[/\s]/g, "_").slice(0, 200);
  const ref = db.collection("alerts").doc(id);
  const snap = await ref.get();
  if (snap.exists && snap.data().status === "resolved") return;
  await ref.set(
    {
      ...alert,
      status: snap.exists ? snap.data().status : "open",
      createdAt: snap.exists ? snap.data().createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function scanStuckJobs(db, now = Date.now()) {
  const snap = await db.collection("jobs").limit(200).get();
  let count = 0;
  for (const doc of snap.docs) {
    const reason = stuckReason(doc.data(), now);
    if (!reason) continue;
    count += 1;
    await upsertAlert(db, {
      key: `booking_stuck:${doc.id}`,
      type: "booking_stuck",
      severity: "warning",
      title: "Uppdrag som fastnat",
      body: reason,
      jobId: doc.id,
      userId: doc.data().ownerId || "",
    });
  }
  return count;
}
