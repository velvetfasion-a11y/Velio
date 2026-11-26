import { FieldValue } from "firebase-admin/firestore";

const CAPTURED = new Set(["succeeded", "refunded", "partially_refunded", "disputed"]);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function applyBookingChangeForUser(db, uid, jobId, messageId) {
  const ref = db.collection("jobs").doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) fail(404, "Uppdraget finns inte");
  const job = snap.data();
  const offers = await db.collection("offers").where("jobId", "==", jobId).where("status", "==", "accepted").limit(5).get();
  const accepted = offers.docs.find((doc) => doc.data().ownerId === uid);
  const isCustomer = job.ownerId === uid;
  const isWorker = job.workerId === uid || Boolean(accepted);
  if (!isCustomer && !isWorker) fail(403, "Bara kunden eller utföraren kan ändra bokningen");
  if (job.status !== "open" && job.status !== "assigned") fail(409, "Bokningen kan inte ändras");
  if (job.payoutStatus === "paid" || job.payoutStatus === "scheduled" || job.transferId) {
    fail(409, "Utbetalningen har redan startat");
  }
  if (CAPTURED.has(job.paymentStatus)) fail(409, "Betalningen är redan genomförd");

  const chats = await db.collection("chats").where("participantIds", "array-contains", uid).limit(30).get();
  let messageRef = null;
  let message = null;
  for (const chat of chats.docs) {
    const candidate = chat.ref.collection("messages").doc(String(messageId || ""));
    const found = await candidate.get();
    if (found.exists) {
      messageRef = candidate;
      message = found.data();
      break;
    }
  }
  if (!message || message.type !== "booking_change" || message.status !== "pending") fail(404, "Förslaget finns inte");
  if (message.senderId === uid) fail(403, "Du kan inte godkänna ditt eget förslag");

  const when = `${String(message.date || "").slice(0, 40)}, ${String(message.time || "").slice(0, 8)}`.slice(0, 80);
  const schedule = { ...(job.schedule && typeof job.schedule === "object" ? job.schedule : {}), when };
  const patch = { schedule, updatedAt: FieldValue.serverTimestamp() };
  const place = String(message.place || "").trim();
  const description = String(message.description || "").trim();
  if (place) patch.locationLabel = place.slice(0, 200);
  if (description) patch.description = description.slice(0, 2000);
  await ref.set(patch, { merge: true });
  await messageRef.set({ status: "accepted" }, { merge: true });
  return { ok: true };
}
