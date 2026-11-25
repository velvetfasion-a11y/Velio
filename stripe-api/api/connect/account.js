import { FieldValue } from "firebase-admin/firestore";
import { applyCors } from "../../lib/cors.js";
import { adminDb, userFromRequest } from "../../lib/firebase.js";
import { stripeV2 } from "../../lib/stripe.js";

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
    // Recipient account: VELIO charges the customer, then transfers 90% here.
    // Express dashboard, Stripe collects KYC in the embedded onboarding.
    const account = await stripeV2("POST", "/v2/core/accounts", {
      contact_email: user.email || undefined,
      display_name: user.name || undefined,
      dashboard: "express",
      identity: { country: "se", entity_type: "individual" },
      configuration: {
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      },
      defaults: {
        currency: "sek",
        locales: ["sv-SE"],
        responsibilities: { fees_collector: "application", losses_collector: "application" },
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
