import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";

let persistenceReady: Promise<void> | null = null;

export function authReady() {
  if (!persistenceReady) {
    persistenceReady = setPersistence(firebaseAuth(), browserLocalPersistence).then(() => undefined);
  }
  return persistenceReady;
}

function prefersRedirect() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

export async function signUpWithEmail(email: string, password: string, name: string) {
  await authReady();
  const cred = await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
  const displayName = name.trim().slice(0, 80);
  if (displayName) await updateProfile(cred.user, { displayName });
  return cred.user;
}

export async function signInWithEmail(email: string, password: string) {
  await authReady();
  const cred = await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
  return cred.user;
}

export async function signInWithGoogle() {
  await authReady();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const auth = firebaseAuth();
  if (prefersRedirect()) {
    await signInWithRedirect(auth, provider);
    return null;
  }
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (error) {
    const code = errorCode(error);
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

export async function sendReset(email: string) {
  await authReady();
  await sendPasswordResetEmail(firebaseAuth(), email.trim());
}

export async function signOutFirebase() {
  await authReady();
  await signOut(firebaseAuth());
}

export async function deleteSignedInUser() {
  const user = firebaseAuth().currentUser;
  if (!user) return;
  await deleteUser(user);
}

export async function consumeRedirect(): Promise<User | null> {
  await authReady();
  const cred = await getRedirectResult(firebaseAuth());
  return cred?.user ?? null;
}

export function watchAuth(onUser: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth(), onUser);
}

export function errorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) return String((error as { code: string }).code);
  return "";
}

export function authErrorSv(error: unknown) {
  const code = errorCode(error);
  if (code === "auth/email-already-in-use") return "Det finns redan ett konto med den e-postadressen. Logga in i stället.";
  if (code === "auth/invalid-email") return "E-postadressen ser inte giltig ut.";
  if (code === "auth/weak-password") return "Lösenordet behöver minst 6 tecken.";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/user-not-found") {
    return "Fel e-post eller lösenord.";
  }
  if (code === "auth/too-many-requests") return "För många försök. Vänta en stund och prova igen.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "Google-fönstret stängdes innan inloggningen var klar.";
  }
  if (code === "auth/unauthorized-domain") return "Den här adressen är inte godkänd för inloggning i Firebase.";
  if (code === "auth/requires-recent-login") return "Logga in igen och prova att radera kontot direkt efteråt.";
  if (error instanceof Error && error.message) return error.message;
  return "Inloggningen misslyckades.";
}
