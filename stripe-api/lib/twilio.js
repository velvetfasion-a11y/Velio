import crypto from "node:crypto";

export function twilioNumbers() {
  const raw = process.env.TWILIO_PROXY_NUMBERS || process.env.TWILIO_PROXY_NUMBER || "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function twilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_PROXY_SERVICE_SID || twilioNumbers().length));
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("0")) digits = `+46${digits.slice(1)}`;
  if (digits.startsWith("46")) digits = `+${digits}`;
  if (!digits.startsWith("+") || digits.length < 8 || digits.length > 16) return "";
  return digits;
}

export function phoneKey(value) {
  return normalizePhone(value).replace(/\D/g, "").slice(-9);
}

export function bridgeId(number) {
  return phoneKey(number);
}

export function xmlEscape(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[char]);
}

export function twilioSignatureValid(req) {
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const signature = req.headers["x-twilio-signature"];
  if (!token || !signature || typeof signature !== "string") return false;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const url = process.env.TWILIO_WEBHOOK_URL || `${proto}://${host}${req.url || "/api/calls/twiml"}`;
  const params = req.body && typeof req.body === "object" ? req.body : {};
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + String(params[key] ?? ""), url.split("?")[0]);
  const digest = crypto.createHmac("sha1", token).update(payload).digest("base64");
  const left = Buffer.from(digest);
  const right = Buffer.from(signature);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function twilioForm(url, params) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(502, "Telefonbryggan svarade inte");
  return data;
}
