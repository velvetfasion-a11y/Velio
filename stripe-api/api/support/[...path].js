import { FieldValue } from "firebase-admin/firestore";
import { applyCors } from "../../lib/cors.js";
import { adminDb, userFromRequest } from "../../lib/firebase.js";
import { upsertAlert } from "../../lib/alerts.js";

function parts(req) {
  const value = req.query.path;
  if (Array.isArray(value)) return value;
  return String(value || "").split("/").filter(Boolean);
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await userFromRequest(req);
    const db = adminDb();
    const [root, id, action] = parts(req);
    if (root === "threads" && !id) {
      const text = String(req.body?.text || "").trim().slice(0, 4000);
      if (text.length < 2) return res.status(400).json({ error: "Skriv ett meddelande" });
      const topic = String(req.body?.topic || "Övrigt").slice(0, 80);
      const jobId = String(req.body?.jobId || "").slice(0, 128);
      const existing = await db.collection("supportThreads").where("customerId", "==", user.uid).limit(10).get();
      const open = existing.docs.find((doc) => doc.data().status !== "closed" && (doc.data().topic || "") === topic);
      const ref = open ? open.ref : db.collection("supportThreads").doc();
      if (!open) {
        await ref.set({
          customerId: user.uid,
          participantIds: [user.uid],
          status: "open",
          topic,
          jobId,
          lastMessagePreview: text.slice(0, 140),
          lastMessageAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        await ref.set({ status: "open", lastMessagePreview: text.slice(0, 140), lastMessageAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      await ref.collection("messages").add({
        senderId: user.uid,
        senderRole: "customer",
        text,
        createdAt: FieldValue.serverTimestamp(),
      });
      await upsertAlert(db, {
        key: `support_waiting:${ref.id}`,
        type: "support_waiting",
        severity: "info",
        title: "Support väntar",
        body: text.slice(0, 140),
        userId: user.uid,
        jobId,
      });
      return res.status(200).json({ id: ref.id });
    }
    if (root === "threads" && id && action === "messages") {
      const thread = await db.collection("supportThreads").doc(id).get();
      if (!thread.exists || thread.data().customerId !== user.uid) return res.status(403).json({ error: "Du kan inte skriva här" });
      const text = String(req.body?.text || "").trim().slice(0, 4000);
      if (!text) return res.status(400).json({ error: "Skriv ett meddelande" });
      await thread.ref.collection("messages").add({
        senderId: user.uid,
        senderRole: "customer",
        text,
        createdAt: FieldValue.serverTimestamp(),
      });
      await thread.ref.set({ status: "open", lastMessagePreview: text.slice(0, 140), lastMessageAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return res.status(200).json({ ok: true });
    }
    return res.status(404).json({ error: "Okänd väg" });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Meddelandet kunde inte skickas" });
  }
}
