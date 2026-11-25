import { adminDb } from "../../lib/firebase.js";
import { bridgeId, phoneKey, twilioSignatureValid, xmlEscape } from "../../lib/twilio.js";

function say(message) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="sv-SE">${xmlEscape(message)}</Say></Response>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }
  if (!twilioSignatureValid(req)) {
    res.status(403).send("Forbidden");
    return;
  }
  const from = phoneKey(req.body?.From);
  const to = bridgeId(req.body?.To);
  res.setHeader("Content-Type", "text/xml");
  if (!from || !to) {
    res.status(200).send(say("Det här numret är inte kopplat."));
    return;
  }
  try {
    const snap = await adminDb().collection("maskedBridges").doc(to).get();
    const data = snap.exists ? snap.data() : null;
    if (!data || data.expiresAt < Date.now()) {
      res.status(200).send(say("Det här numret är inte kopplat."));
      return;
    }
    const caller = phoneKey(data.callerPhone);
    const callee = phoneKey(data.calleePhone);
    const dest = from === caller ? data.calleePhone : from === callee ? data.callerPhone : "";
    if (!dest) {
      res.status(200).send(say("Det här numret är inte kopplat."));
      return;
    }
    const proxy = xmlEscape(data.proxyNumber);
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${proxy}"><Number>${xmlEscape(dest)}</Number></Dial></Response>`);
  } catch {
    res.status(200).send(say("Samtalet kunde inte kopplas."));
  }
}
