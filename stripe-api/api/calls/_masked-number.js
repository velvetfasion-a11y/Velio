import { applyCors } from "../../lib/cors.js";
import { adminDb, userFromRequest } from "../../lib/firebase.js";
import { bridgeId, httpError, normalizePhone, twilioConfigured, twilioForm, twilioNumbers } from "../../lib/twilio.js";

const TWO_HOURS = 2 * 60 * 60 * 1000;

async function phoneOf(uid) {
  const snap = await adminDb().collection("users").doc(uid).get();
  return normalizePhone(snap.exists ? snap.data().phone : "");
}

async function pairFromChat(uid, chatId) {
  const snap = await adminDb().collection("chats").doc(chatId).get();
  if (!snap.exists) throw httpError(404, "Chatten finns inte");
  const ids = Array.isArray(snap.data().participantIds) ? snap.data().participantIds : [];
  if (!ids.includes(uid)) throw httpError(403, "Du deltar inte i den här chatten");
  const other = ids.find((item) => item !== uid);
  if (!other) throw httpError(404, "Den andra personen saknas");
  return { other, chatId, jobId: snap.data().jobId || "" };
}

async function pairFromJob(uid, jobId) {
  const snap = await adminDb().collection("jobs").doc(jobId).get();
  if (!snap.exists) throw httpError(404, "Uppdraget finns inte");
  const data = snap.data();
  let other = "";
  if (data.ownerId === uid) other = data.workerId || "";
  else if (data.workerId === uid) other = data.ownerId || "";
  if (!other) {
    const offers = await adminDb().collection("offers").where("jobId", "==", jobId).get();
    const accepted = offers.docs.find((item) => {
      const offer = item.data();
      return offer.status === "accepted" && (offer.ownerId === uid || offer.jobOwnerId === uid);
    });
    if (!accepted) throw httpError(403, "Du deltar inte i det här uppdraget");
    const offer = accepted.data();
    other = offer.ownerId === uid ? offer.jobOwnerId : offer.ownerId;
  }
  if (!other) throw httpError(404, "Den andra personen saknas");
  return { other, chatId: "", jobId };
}

async function openProxySession(callerPhone, calleePhone, name) {
  const service = process.env.TWILIO_PROXY_SERVICE_SID;
  const session = await twilioForm(`https://proxy.twilio.com/v1/Services/${service}/Sessions`, {
    UniqueName: name.slice(0, 80),
    Mode: "voice-only",
    Ttl: "7200",
  });
  const base = `https://proxy.twilio.com/v1/Services/${service}/Sessions/${session.sid}/Participants`;
  const caller = await twilioForm(base, { Identifier: callerPhone, FriendlyName: "caller" });
  await twilioForm(base, { Identifier: calleePhone, FriendlyName: "callee" });
  if (!caller.proxy_identifier) throw httpError(502, "Telefonbryggan svarade inte");
  return caller.proxy_identifier;
}

async function assignPoolNumber(uid, other, callerPhone, calleePhone, chatId, jobId) {
  const pool = twilioNumbers();
  const database = adminDb();
  for (const number of pool) {
    const ref = database.collection("maskedBridges").doc(bridgeId(number));
    const snap = await ref.get();
    const current = snap.exists ? snap.data() : null;
    const busy = current && current.expiresAt > Date.now() && current.callerUid !== uid && current.calleeUid !== uid;
    if (busy) continue;
    await ref.set({
      proxyNumber: normalizePhone(number),
      callerPhone,
      calleePhone,
      callerUid: uid,
      calleeUid: other,
      chatId: chatId || "",
      jobId: jobId || "",
      expiresAt: Date.now() + TWO_HOURS,
    });
    return normalizePhone(number);
  }
  throw httpError(409, "Alla nummer är upptagna just nu");
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const configured = twilioConfigured();
  if (req.body?.probe === true) return res.status(200).json({ configured });
  if (!configured) return res.status(501).json({ error: "Maskerade nummer är inte konfigurerade.", code: "not_configured" });
  try {
    const user = await userFromRequest(req);
    const chatId = String(req.body?.chatId || "");
    const jobId = String(req.body?.jobId || "");
    if (!chatId && !jobId) throw httpError(400, "Chatt eller uppdrag saknas");
    const pair = chatId ? await pairFromChat(user.uid, chatId) : await pairFromJob(user.uid, jobId);
    const callerPhone = await phoneOf(user.uid);
    const calleePhone = await phoneOf(pair.other);
    if (!callerPhone || !calleePhone) throw httpError(400, "Båda behöver ett telefonnummer i profilen.");
    const proxyNumber = process.env.TWILIO_PROXY_SERVICE_SID
      ? await openProxySession(callerPhone, calleePhone, `velio-${pair.chatId || pair.jobId}-${Date.now()}`)
      : await assignPoolNumber(user.uid, pair.other, callerPhone, calleePhone, pair.chatId, pair.jobId);
    if (!process.env.TWILIO_PROXY_SERVICE_SID) {
      /* The pool path already stored the bridge. */
    } else {
      await adminDb().collection("maskedBridges").doc(bridgeId(proxyNumber)).set({
        proxyNumber,
        callerPhone,
        calleePhone,
        callerUid: user.uid,
        calleeUid: pair.other,
        chatId: pair.chatId || "",
        jobId: pair.jobId || "",
        expiresAt: Date.now() + TWO_HOURS,
      });
    }
    return res.status(200).json({ proxyNumber, expiresInSec: 7200 });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Numret kunde inte hämtas" });
  }
}
