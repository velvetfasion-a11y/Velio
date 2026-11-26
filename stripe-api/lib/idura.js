import { createHash, createPublicKey, createVerify } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase.js";

import QRCode from "qrcode";

const hintSv = {
  outstandingTransaction: "Starta BankID-appen.",
  noClient: "Starta BankID-appen.",
  started: "BankID startar.",
  userSign: "Skriv in din säkerhetskod i BankID-appen.",
  userMrtd: "Legitimera dig i BankID-appen.",
};

export function iduraConfigured() {
  return Boolean(process.env.IDURA_DOMAIN && process.env.IDURA_CLIENT_ID && process.env.IDURA_CLIENT_SECRET);
}

function issuer() {
  const domain = String(process.env.IDURA_DOMAIN || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  return `https://${domain}`;
}

function form(fields) {
  return new URLSearchParams(fields);
}

async function iduraPost(path, fields) {
  const id = process.env.IDURA_CLIENT_ID || "";
  const secret = process.env.IDURA_CLIENT_SECRET || "";
  const basic = Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString("base64");
  const response = await fetch(`${issuer()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form({ ...fields, client_id: id, client_secret: secret }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export function bankIdLaunchUrl(autoStartToken) {
  return `https://app.bankid.com/?autostarttoken=${encodeURIComponent(autoStartToken)}&redirect=null`;
}

export async function qrImage(qrData) {
  if (!qrData) return "";
  return QRCode.toDataURL(String(qrData), { margin: 1, width: 280, errorCorrectionLevel: "M" });
}

export async function startHeadless(endUserIp) {
  const started = await iduraPost("/headless/authorize", {
    scope: "openid",
    acr_values: "urn:grn:authn:se:bankid",
    end_user_ip: endUserIp || "127.0.0.1",
  });
  if (!started.ok || !started.data.headless_req_id) {
    const error = new Error(started.data.error_description || started.data.error || "BankID kunde inte startas");
    error.status = started.status >= 500 ? 502 : 400;
    throw error;
  }
  const acr = started.data.acr_data || {};
  return {
    reqId: started.data.headless_req_id,
    expiresIn: Number(started.data.expires_in) || 120,
    qrData: acr.qrData || "",
    autoStartToken: acr.autoStartToken || "",
    hintCode: acr.hintCode || "outstandingTransaction",
  };
}

export async function pollHeadless(reqId) {
  const polled = await iduraPost("/oauth2/token", {
    grant_type: "urn:grn:params:grant-type:headless",
    headless_req_id: reqId,
  });
  if (polled.ok && polled.data.id_token) {
    const claims = await verifiedClaims(polled.data.id_token);
    return { status: "complete", claims };
  }
  const error = polled.data.error || "";
  if (error === "authorization_pending" || error === "slow_down") {
    const acr = polled.data.acr_data || {};
    return { status: "pending", qrData: acr.qrData || "", hintCode: acr.hintCode || "" };
  }
  return { status: "failed", message: polled.data.error_description || "BankID avbröts." };
}

let jwksCache = { url: "", keys: [], exp: 0 };

async function jwks() {
  if (jwksCache.keys.length && Date.now() < jwksCache.exp) return jwksCache.keys;
  const config = await fetch(`${issuer()}/.well-known/openid-configuration`).then((response) => response.json());
  const set = await fetch(config.jwks_uri).then((response) => response.json());
  jwksCache = { url: config.jwks_uri, keys: set.keys || [], exp: Date.now() + 10 * 60 * 1000 };
  return jwksCache.keys;
}

function b64urlJson(part) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

async function verifiedClaims(idToken) {
  const [headerPart, payloadPart, signaturePart] = String(idToken).split(".");
  if (!headerPart || !payloadPart || !signaturePart) throw new Error("Ogiltigt BankID-svar");
  const header = b64urlJson(headerPart);
  const payload = b64urlJson(payloadPart);
  if (payload.iss !== issuer()) throw new Error("BankID-svaret kom från fel utfärdare");
  if (Number(payload.exp) * 1000 < Date.now()) throw new Error("BankID-svaret har gått ut");
  const jwk = (await jwks()).find((key) => key.kid === header.kid) || (await jwks())[0];
  if (!jwk) throw new Error("BankID-nyckeln saknas");
  const key = createPublicKey({ key: jwk, format: "jwk" });
  const verify = createVerify("RSA-SHA256");
  verify.update(`${headerPart}.${payloadPart}`);
  verify.end();
  const signature = Buffer.from(signaturePart.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (!verify.verify(key, signature)) throw new Error("BankID-svaret kunde inte kontrolleras");
  return payload;
}

export function hashPersonnummer(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  const salt = process.env.IDURA_PERSONNUMMER_SALT || process.env.IDURA_CLIENT_SECRET || "velio";
  return createHash("sha256").update(`${salt}:${digits}`).digest("hex");
}

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || "").split(",")[0];
  return first.trim() || req.socket?.remoteAddress || "127.0.0.1";
}

export async function saveVerifiedIdentity(uid, claims) {
  const name = String(claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(" ")).slice(0, 80);
  const hash = hashPersonnummer(claims.ssn);
  await adminDb()
    .collection("users")
    .doc(uid)
    .set(
      {
        idVerified: true,
        idMethod: "bankid",
        idStatus: "verified",
        verifiedName: name,
        ...(hash ? { personnummerHash: hash } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  return name;
}

export function hintText(code) {
  return hintSv[code] || "Väntar på BankID.";
}
