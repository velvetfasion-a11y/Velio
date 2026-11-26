import { applyCors } from "../../../lib/cors.js";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, userFromRequest } from "../../../lib/firebase.js";
import { hintText, iduraConfigured, pollHeadless, qrImage, saveVerifiedIdentity } from "../../../lib/idura.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await userFromRequest(req);
    if (!iduraConfigured()) {
      return res.status(200).json({ configured: false, status: "unavailable", message: "BankID kommer snart" });
    }
    const session = await adminDb().collection("identitySessions").doc(user.uid).get();
    const reqId = session.data()?.reqId;
    if (!reqId || Number(session.data()?.expiresAt || 0) < Date.now()) {
      return res.status(200).json({ configured: true, status: "expired", message: "BankID-sessionen har gått ut. Starta igen." });
    }
    const polled = await pollHeadless(reqId);
    if (polled.status === "complete") {
      const name = await saveVerifiedIdentity(user.uid, polled.claims);
      await session.ref.delete().catch(() => undefined);
      return res.status(200).json({ configured: true, status: "verified", name });
    }
    if (polled.status === "failed") {
      const current = await adminDb().collection("users").doc(user.uid).get();
      if (current.data()?.idVerified !== true) {
        await current.ref.set({ idVerified: false, idStatus: "canceled", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      await session.ref.delete().catch(() => undefined);
      return res.status(200).json({ configured: true, status: "failed", message: polled.message || "BankID avbröts." });
    }
    return res.status(200).json({
      configured: true,
      status: "pending",
      qrImage: await qrImage(polled.qrData),
      hint: hintText(polled.hintCode),
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "BankID kunde inte kontrolleras" });
  }
}
