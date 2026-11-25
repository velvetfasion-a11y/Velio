import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase.js";
import { stripeClient } from "./stripe.js";
import { workerShareOre } from "./money.js";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function completedMillis(job) {
  const value = job.completedAt;
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

export async function releaseDuePayouts(now = Date.now()) {
  const db = adminDb();
  const stripe = stripeClient();
  const snap = await db.collection("jobs").where("payoutStatus", "==", "scheduled").get();
  const results = [];
  for (const doc of snap.docs) {
    const job = doc.data();
    const at = completedMillis(job);
    if (at == null || now - at < THREE_HOURS_MS) continue;
    if (job.transferId) continue;
    results.push(await transferJob(stripe, db, doc.id, job));
  }
  return results;
}

export async function scheduleOrTransfer(jobId) {
  const db = adminDb();
  const ref = db.collection("jobs").doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) {
    const error = new Error("Uppdraget finns inte");
    error.status = 404;
    throw error;
  }
  const job = snap.data();
  if (job.transferId || job.payoutStatus === "paid") {
    return { jobId, payoutStatus: "paid", transferId: job.transferId || null };
  }
  const at = completedMillis(job);
  if (at == null || Date.now() - at < THREE_HOURS_MS) {
    await ref.set(
      { payoutStatus: "scheduled", updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { jobId, payoutStatus: "scheduled" };
  }
  return transferJob(stripeClient(), db, jobId, job);
}

async function transferJob(stripe, db, jobId, job) {
  const ref = db.collection("jobs").doc(jobId);
  if (!job.paymentIntentId) {
    await ref.set({ payoutStatus: "failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { jobId, payoutStatus: "failed", reason: "missing_payment" };
  }
  const workerId = job.workerId || job.assignedWorkerId;
  const offerId = job.offerId;
  let destination = "";
  if (workerId) {
    const worker = await db.collection("users").doc(workerId).get();
    destination = worker.data()?.stripeAccountId || "";
  }
  if (!destination && offerId) {
    const offer = await db.collection("offers").doc(offerId).get();
    const owner = offer.data()?.ownerId;
    if (owner) {
      const worker = await db.collection("users").doc(owner).get();
      destination = worker.data()?.stripeAccountId || "";
    }
  }
  if (!destination) {
    await ref.set({ payoutStatus: "failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { jobId, payoutStatus: "failed", reason: "missing_account" };
  }
  const intent = await stripe.paymentIntents.retrieve(job.paymentIntentId, { expand: ["latest_charge"] });
  const charge = intent.latest_charge;
  const chargeId = typeof charge === "string" ? charge : charge?.id;
  if (!chargeId || intent.status !== "succeeded") {
    await ref.set({ payoutStatus: "failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { jobId, payoutStatus: "failed", reason: "charge_not_ready" };
  }
  const amount = workerShareOre(intent.amount_received || intent.amount);
  const transfer = await stripe.transfers.create({
    amount,
    currency: "sek",
    destination,
    source_transaction: chargeId,
    transfer_group: jobId,
    metadata: {
      jobId,
      offerId: offerId || "",
      workerId: workerId || "",
      customerId: job.ownerId || "",
    },
  });
  await ref.set(
    {
      payoutStatus: "paid",
      transferId: transfer.id,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { jobId, payoutStatus: "paid", transferId: transfer.id, amount };
}

export function stampNow() {
  return Timestamp.now();
}
