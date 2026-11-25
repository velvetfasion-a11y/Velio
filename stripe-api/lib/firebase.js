import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const credentials = JSON.parse(raw);
  return initializeApp({ credential: cert(credentials) });
}

export function adminDb() {
  app();
  return getFirestore();
}

export async function userFromRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    const error = new Error("Logga in igen");
    error.status = 401;
    throw error;
  }
  app();
  const decoded = await getAuth().verifyIdToken(token);
  return decoded;
}
