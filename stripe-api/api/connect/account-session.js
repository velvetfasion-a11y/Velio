import { applyCors } from "../../lib/cors.js";
import { adminDb, userFromRequest } from "../../lib/firebase.js";
import { stripeClient } from "../../lib/stripe.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await userFromRequest(req);
    const snap = await adminDb().collection("users").doc(user.uid).get();
    const accountId = snap.data()?.stripeAccountId;
    if (!accountId) return res.status(409).json({ error: "Inget utbetalningskonto ännu" });
    const stripe = stripeClient();
    const session = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
      },
    });
    return res.status(200).json({ clientSecret: session.client_secret });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Onboarding kunde inte öppnas" });
  }
}
