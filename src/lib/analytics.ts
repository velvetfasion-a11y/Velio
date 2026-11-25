import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase/client";

export async function logSessionStart(uid: string) {
  if (!uid || typeof window === "undefined") return;
  const key = `velio_session_${uid}_${new Date().toISOString().slice(0, 10)}`;
  if (window.localStorage.getItem(key)) return;
  window.localStorage.setItem(key, "1");
  try {
    await addDoc(collection(firebaseDb(), "analyticsEvents"), {
      uid,
      name: "session_start",
      source: "web",
      createdAt: serverTimestamp(),
    });
  } catch {
    window.localStorage.removeItem(key);
  }
}
