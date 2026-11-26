import { applyCors } from "../../../lib/cors.js";
import { userFromRequest, adminDb } from "../../../lib/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { bankIdLaunchUrl, clientIp, iduraConfigured, qrImage, startHeadless, hintText } from "../../../lib/idura.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await userFromRequest(req);
    if (!iduraConfigured()) {
      return res.status(200).json({ configured: false, message: "BankID kommer snart" });
    }
    const started = await startHeadless(clientIp(req));
    await adminDb()
      .collection("identitySessions")
      .doc(user.uid)
      .set({
        uid: user.uid,
        reqId: started.reqId,
        expiresAt: Date.now() + started.expiresIn * 1000,
        createdAt: FieldValue.serverTimestamp(),
      });
    await adminDb().collection("users").doc(user.uid).set({ idStatus: "pending", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return res.status(200).json({
      configured: true,
      autoStartUrl: started.autoStartToken ? bankIdLaunchUrl(started.autoStartToken) : "",
      qrImage: await qrImage(started.qrData),
      hint: hintText(started.hintCode),
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "BankID kunde inte startas" });
  }
}
