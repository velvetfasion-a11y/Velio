import { FieldValue } from "firebase-admin/firestore";
import { applyCors } from "../../lib/cors.js";
import { adminDb, userFromRequest } from "../../lib/firebase.js";
import { stripeClient } from "../../lib/stripe.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await userFromRequest(req);
    const db = adminDb();
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    const existing = snap.data()?.stripeAccountId;
    if (existing) {
      return res.status(200).json({
        accountId: existing,
        onboardingStatus: snap.data()?.stripeOnboardingStatus || "pending",
      });
    }
    const stripe = stripeClient();
    const account = await stripe.accounts.create({
      country: "SE",
      email: user.email || undefined,
      capabilities: { transfers: { requested: true } },
      controller: {
        stripe_dashboard: { type: "express" },
        fees: { payer: "application" },
        losses: { payments: "application" },
        requirement_collection: "stripe",
      },
      metadata: { velioUid: user.uid },
    });
    await ref.set(
      {
        stripeAccountId: account.id,
        stripeOnboardingStatus: "pending",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return res.status(200).json({ accountId: account.id, onboardingStatus: "pending" });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Kontot kunde inte skapas" });
  }
}
