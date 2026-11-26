import { FieldValue } from "firebase-admin/firestore";
import { stripeClient } from "./stripe.js";

const RELEASABLE = new Set(["requires_payment_method", "requires_confirmation", "requires_action", "requires_capture", "processing"]);
const CAPTURED = new Set(["succeeded", "refunded", "partially_refunded", "disputed"]);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function cancelJobForUser(db, uid, jobId, reason) {
  const ref = db.collection("jobs").doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) fail(404, "Uppdraget finns inte");
  const job = snap.data();
  const offers = await db.collection("offers").where("jobId", "==", jobId).where("status", "==", "accepted").limit(5).get();
  const accepted = offers.docs.find((doc) => doc.data().ownerId === uid);
  const isCustomer = job.ownerId === uid;
  const isWorker = job.workerId === uid || Boolean(accepted);
  if (!isCustomer && !isWorker) fail(403, "Bara kunden eller utföraren kan avboka");
  if (job.status !== "open" && job.status !== "assigned") fail(409, "Uppdraget kan inte avbokas");
  if (job.payoutStatus === "paid" || job.payoutStatus === "scheduled" || job.transferId) {
    fail(409, "Utbetalningen har redan startat");
  }
  if (CAPTURED.has(job.paymentStatus)) fail(409, "Betalningen är redan genomförd");

  let released = false;
  if (job.paymentIntentId) {
    const stripe = stripeClient();
    const intent = await stripe.paymentIntents.retrieve(job.paymentIntentId);
    if (intent.status === "succeeded") fail(409, "Betalningen är redan genomförd");
    if (RELEASABLE.has(intent.status)) {
      await stripe.paymentIntents.cancel(job.paymentIntentId);
      released = true;
    }
  }

  const note = String(reason || "").trim().slice(0, 500);
  await ref.set(
    {
      status: "cancelled",
      cancelledBy: uid,
      cancelReason: note,
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(released ? { paymentStatus: "canceled" } : {}),
    },
    { merge: true },
  );

  const other = isCustomer ? job.workerId || accepted?.data()?.ownerId || offers.docs[0]?.data()?.ownerId : job.ownerId;
  if (other && other !== uid) {
    const chats = await db.collection("chats").where("participantIds", "array-contains", uid).limit(30).get();
    const found = chats.docs.find((doc) => (doc.data().participantIds || []).includes(other));
    const chatRef = found
      ? found.ref
      : await db.collection("chats").add({
          participantIds: [uid, other],
          jobId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
    await chatRef.collection("messages").add({
      senderId: uid,
      type: "cancelled",
      text: "Uppdraget är avbokat.",
      createdAt: FieldValue.serverTimestamp(),
    });
    await chatRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  return { ok: true, released };
}
