import { FieldValue } from "firebase-admin/firestore";
import { applyCors } from "../lib/cors.js";
import { adminDb, userFromRequest } from "../lib/firebase.js";
import { breakdownFromSek } from "../lib/money.js";
import { stripeClient } from "../lib/stripe.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await userFromRequest(req);
    const offerId = String(req.body?.offerId || "");
    if (!offerId) return res.status(400).json({ error: "offerId saknas" });
    const db = adminDb();
    const offerSnap = await db.collection("offers").doc(offerId).get();
    if (!offerSnap.exists) return res.status(404).json({ error: "Offerten finns inte" });
    const offer = offerSnap.data();
    if (offer.jobOwnerId !== user.uid) return res.status(403).json({ error: "Bara kunden kan betala offerten" });
    if (offer.status !== "pending" && offer.status !== "accepted") {
      return res.status(409).json({ error: "Offerten kan inte betalas" });
    }
    const { totalOre, feeOre, workOre } = breakdownFromSek(offer.amount);
    if (totalOre < 300) return res.status(400).json({ error: "Beloppet är för lågt" });
    const stripe = stripeClient();
    if (offer.paymentIntentId && offer.paymentStatus !== "failed" && offer.paymentStatus !== "canceled") {
      const existing = await stripe.paymentIntents.retrieve(offer.paymentIntentId);
      if (existing.status !== "canceled" && existing.status !== "succeeded") {
        return res.status(200).json({
          clientSecret: existing.client_secret,
          paymentIntentId: existing.id,
          amount: existing.amount,
          currency: existing.currency,
          feeOre,
          workOre,
        });
      }
    }
    const intent = await stripe.paymentIntents.create({
      amount: totalOre,
      currency: "sek",
      automatic_payment_methods: { enabled: true },
      transfer_group: offer.jobId,
      metadata: {
        jobId: offer.jobId,
        offerId,
        workerId: offer.ownerId,
        customerId: user.uid,
      },
    });
    const patch = {
      paymentIntentId: intent.id,
      paymentStatus: "requires_payment",
      offerId,
      workerId: offer.ownerId,
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection("jobs").doc(offer.jobId).set(patch, { merge: true });
    await offerSnap.ref.set(
      {
        paymentIntentId: intent.id,
        paymentStatus: "requires_payment",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return res.status(200).json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      feeOre,
      workOre,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Betalningen kunde inte startas" });
  }
}
