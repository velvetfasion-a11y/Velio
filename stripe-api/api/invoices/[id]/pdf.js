import { applyCors } from "../../../lib/cors.js";
import { adminDb, userFromRequest } from "../../../lib/firebase.js";
import { renderInvoicePdf } from "../../../lib/invoice.js";

async function isAdmin(db, user) {
  if (user.admin === true) return true;
  const snap = await db.collection("admins").doc(user.uid).get();
  return snap.exists;
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await userFromRequest(req);
    const id = String(req.query?.id || "");
    if (!id) return res.status(400).json({ error: "Kvittot saknas" });
    const db = adminDb();
    const snap = await db.collection("invoices").doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: "Kvittot finns inte ännu" });
    const invoice = snap.data();
    const allowed = user.uid === invoice.buyerId || user.uid === invoice.workerId || (await isAdmin(db, user));
    if (!allowed) return res.status(403).json({ error: "Du kan inte öppna det här kvittot" });
    const pdf = await renderInvoicePdf({ ...invoice, number: invoice.number });
    const name = `${invoice.number || "kvitto"}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.status(200).send(pdf);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Kvittot kunde inte skapas" });
  }
}
