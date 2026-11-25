import { buffer } from "node:stream/consumers";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../lib/firebase.js";
import { stripeClient } from "../../lib/stripe.js";

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  return Buffer.from(await buffer(req));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const stripe = stripeClient();
  const signature = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(await rawBody(req), signature, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (error) {
    return res.status(400).json({ error: error.message || "Invalid signature" });
  }
  const db = adminDb();
  try {
    if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      const status = event.type === "payment_intent.succeeded" ? "succeeded" : "failed";
      const patch = {
        paymentIntentId: intent.id,
        paymentStatus: status,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (status === "succeeded") patch.paidAt = FieldValue.serverTimestamp();
      const jobId = intent.metadata?.jobId;
      const offerId = intent.metadata?.offerId;
      if (jobId) {
        const jobPatch = { ...patch };
        if (offerId) jobPatch.offerId = offerId;
        if (intent.metadata?.workerId) jobPatch.workerId = intent.metadata.workerId;
        await db.collection("jobs").doc(jobId).set(jobPatch, { merge: true });
      }
      if (offerId) await db.collection("offers").doc(offerId).set(patch, { merge: true });
    }
    if (event.type === "account.updated") {
      const account = event.data.object;
      const uid = account.metadata?.velioUid;
      const transfers = account.capabilities?.transfers === "active";
      const status = transfers ? "complete" : "pending";
      if (uid) {
        await db.collection("users").doc(uid).set(
          {
            stripeAccountId: account.id,
            stripeOnboardingStatus: status,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }
    if (event.type === "transfer.created" || event.type === "transfer.updated") {
      const transfer = event.data.object;
      const jobId = transfer.metadata?.jobId || transfer.transfer_group;
      if (jobId) {
        await db.collection("jobs").doc(jobId).set(
          {
            transferId: transfer.id,
            payoutStatus: transfer.reversed ? "failed" : "paid",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Webhook failed" });
  }
}
