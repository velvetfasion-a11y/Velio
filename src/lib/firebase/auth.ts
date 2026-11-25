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
let pendingSignupName = "";
const REDIRECT_FLAG = "velio_google_redirect";

export function authReady() {
  if (!persistenceReady) {
    persistenceReady = setPersistence(firebaseAuth(), browserLocalPersistence).then(() => undefined);
  }
  return persistenceReady;
}

/** Remember the name typed on Skapa konto before Auth creates the user. */
export function rememberSignupName(name: string) {
  pendingSignupName = name.trim().slice(0, 80);
}

export function takeSignupName() {
  const name = pendingSignupName;
  pendingSignupName = "";
  return name;
}

export async function signUpWithEmail(email: string, password: string, name: string) {
  rememberSignupName(name);
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

/**
 * Start Google sign-in. Call this directly from the click handler, with no
 * await before it: Safari only allows the popup in that same tap.
 * Redirect is the fallback when the popup is blocked. On iPad that fallback
 * often returns to the login page, because the app is not on authDomain.
 */
export function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const auth = firebaseAuth();
  return signInWithPopup(auth, provider).then(
    (cred) => cred.user,
    async (error: unknown) => {
      const code = errorCode(error);
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        try {
          sessionStorage.setItem(REDIRECT_FLAG, "1");
        } catch {
          /* Private mode can block storage. Redirect may still be attempted. */
        }
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw error;
    },
  );
}

/** True when a redirect came back without a signed-in user. Clears the flag. */
export const redirectMissMessage =
  "Google-inloggningen kom tillbaka utan att du blev inloggad. Tryck på Fortsätt med Google igen, så öppnas ett fönster ovanpå sidan.";

export function takeRedirectMiss() {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const missed = sessionStorage.getItem(REDIRECT_FLAG) === "1";
    if (missed) sessionStorage.removeItem(REDIRECT_FLAG);
    return missed;
  } catch {
    return false;
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
  try {
    const cred = await getRedirectResult(firebaseAuth());
    if (cred?.user) {
      try {
        sessionStorage.removeItem(REDIRECT_FLAG);
      } catch {
        /* Ignore storage failures. The user is signed in. */
      }
    }
    return cred?.user ?? null;
  } catch (error) {
    try {
      sessionStorage.removeItem(REDIRECT_FLAG);
    } catch {
      /* Ignore. */
    }
    throw error;
  }
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
  if (code === "auth/popup-blocked") {
    return "Webbläsaren blockerade Google-fönstret. Tillåt popup-fönster för den här sidan och försök igen.";
  }
  if (code === "auth/unauthorized-domain") return "Den här adressen är inte godkänd för inloggning i Firebase.";
  if (code === "auth/web-storage-unsupported") {
    return "Webbläsaren blockerar lagringen som Google-inloggningen behöver. Stäng privat läge eller tillåt lagring för sidan.";
  }
  const message = error instanceof Error ? error.message : "";
  if (/missing initial state|sessionStorage/i.test(message)) {
    return "Google-inloggningen kom tillbaka utan att kunna slutföras i Safari. Tryck på Fortsätt med Google igen, så öppnas ett fönster ovanpå sidan.";
  }
  if (code === "auth/requires-recent-login") return "Logga in igen och prova att radera kontot direkt efteråt.";
  if (error instanceof Error && error.message) return error.message;
  return "Inloggningen misslyckades.";
}
