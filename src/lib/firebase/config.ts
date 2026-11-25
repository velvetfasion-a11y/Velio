/** Public web config. Real values ship as fallbacks so the GitHub Pages build works without a .env file. */

function env(name: string, fallback: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

export const firebaseConfig = {
  apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY", "AIzaSyAIi0D1A7S2YS4T38eMqsfXYWM_55ubif8"),
  authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "velio-se.firebaseapp.com"),
  projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "velio-se"),
  storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "velio-se.firebasestorage.app"),
  messagingSenderId: env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "163550522853"),
  appId: env("NEXT_PUBLIC_FIREBASE_APP_ID", "1:163550522853:web:74898e9ad22759c922d30c"),
};
