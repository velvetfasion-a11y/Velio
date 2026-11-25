import { buffer } from "node:stream/consumers";
import { FieldValue } from "firebase-admin/firestore";
import { upsertAlert } from "../../lib/alerts.js";
import { adminDb } from "../../lib/firebase.js";
import { stripeClient } from "../../lib/stripe.js";

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  // Read the stream before anything touches req.body, so the signature is
  // checked against the exact bytes Stripe sent.
  if (req.readable !== false && !req.readableEnded) {
    const raw = Buffer.from(await buffer(req));
    if (raw.length) return raw;
  }
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  return Buffer.alloc(0);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const stripe = stripeClient();
  const signature = req.headers["stripe-signature"];
  let event;
  const body = await rawBody(req);
  // Platform events and connected-account (Connect) events use two endpoints
  // with separate signing secrets.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean);
  let lastError;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!event) return res.status(400).json({ error: lastError?.message || "Invalid signature" });
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
      if (status === "succeeded") {
        patch.paidAt = FieldValue.serverTimestamp();
        const totalOre = intent.amount_received || intent.amount || 0;
        patch.amountOre = totalOre;
        patch.feeOre = Math.round(totalOre * 0.1);
        patch.workOre = totalOre - patch.feeOre;
        patch.currency = "sek";
      }
      if (status === "failed" && intent.metadata?.jobId) {
        await upsertAlert(db, {
          key: `payment_failed:${intent.metadata.jobId}`,
          type: "payment_failed",
          severity: "critical",
          title: "Betalning misslyckades",
          body: intent.last_payment_error?.message || "Betalningen gick inte igenom",
          jobId: intent.metadata.jobId,
          userId: intent.metadata.customerId || "",
          paymentIntentId: intent.id,
        });
      }
      const jobId = intent.metadata?.jobId;
      const offerId = intent.metadata?.offerId;
      if (jobId) {
        const jobPatch = { ...patch };
        if (offerId) jobPatch.offerId = offerId;
        if (intent.metadata?.workerId) jobPatch.workerId = intent.metadata.workerId;
        await db.collection("jobs").doc(jobId).set(jobPatch, { merge: true });
      }
      if (offerId) await db.collection("offers").doc(offerId).set(patch, { merge: true });
      if (status === "succeeded") {
        const { createInvoiceForIntent } = await import("../../lib/invoice.js");
        await createInvoiceForIntent(db, stripe, intent);
      }
    }
    if (event.type === "account.updated") {
      const account = event.data.object;
      const uid = account.metadata?.velioUid;
      const transfers =
        account.capabilities?.transfers === "active" ||
        account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
      const status = transfers ? "complete" : "pending";
      if (uid) {
        const due = account.requirements?.currently_due || [];
        const state = account.requirements?.disabled_reason
          ? "rejected"
          : transfers
            ? "enabled"
            : due.length
              ? "restricted"
              : "pending";
        await db.collection("users").doc(uid).set(
          {
            stripeAccountId: account.id,
            stripeOnboardingStatus: status,
            stripeAccountState: state,
            stripeRequirements: due.slice(0, 20),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        if (state === "restricted" || state === "rejected") {
          await upsertAlert(db, {
            key: `connect_requirements:${uid}`,
            type: "connect_requirements",
            severity: state === "rejected" ? "critical" : "warning",
            title: "Kontot behöver åtgärdas",
            body: due.slice(0, 3).join(", ") || state,
            userId: uid,
          });
        }
      }
    }
    if (event.type === "charge.dispute.created" || event.type === "charge.dispute.updated" || event.type === "charge.dispute.closed") {
      const dispute = event.data.object;
      const paymentIntentId = dispute.payment_intent;
      if (paymentIntentId) {
        const jobs = await db.collection("jobs").where("paymentIntentId", "==", paymentIntentId).limit(1).get();
        const job = jobs.docs[0];
        if (job) {
          await job.ref.set(
            {
              paymentStatus: dispute.status === "won" ? "succeeded" : "disputed",
              disputeId: dispute.id,
              disputeStatus: dispute.status || "",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          if (event.type !== "charge.dispute.closed") {
            await upsertAlert(db, {
              key: `dispute_opened:${job.id}`,
              type: "dispute_opened",
              severity: "critical",
              title: "Invändning mot en betalning",
              body: dispute.reason || "En kund har bestridit betalningen",
              jobId: job.id,
              paymentIntentId,
            });
          }
        }
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
        await db.collection("payouts").doc(transfer.id).set(
          {
            ownerId: transfer.metadata?.workerId || "",
            jobId,
            transferId: transfer.id,
            amount: transfer.amount || 0,
            status: transfer.reversed ? "reversed" : "paid",
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        if (transfer.reversed) {
          await upsertAlert(db, {
            key: `payout_failed:${jobId}`,
            type: "payout_failed",
            severity: "critical",
            title: "Utbetalning misslyckades",
            body: "Överföringen återfördes",
            jobId,
            userId: transfer.metadata?.workerId || "",
          });
        }
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Webhook failed" });
  }
}
