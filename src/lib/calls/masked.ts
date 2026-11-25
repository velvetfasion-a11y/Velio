import { paymentsApiBase } from "@/lib/stripe/config";
import { firebaseAuth } from "@/lib/firebase/client";

export type MaskedResult = { configured: false } | { configured: true; proxyNumber: string };

let cached: boolean | null = null;

export async function maskedCallsConfigured() {
  if (cached !== null) return cached;
  const base = paymentsApiBase();
  if (!base) {
    cached = false;
    return false;
  }
  try {
    const response = await fetch(`${base}/api/calls/masked-number`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probe: true }),
    });
    const data = (await response.json().catch(() => ({}))) as { configured?: boolean };
    cached = data.configured === true;
  } catch {
    cached = false;
  }
  return cached;
}

export async function requestMaskedNumber(input: { chatId?: string; jobId?: string }) {
  const base = paymentsApiBase();
  if (!base) throw new Error("Maskerade nummer är inte konfigurerade.");
  const token = await firebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Logga in igen");
  const response = await fetch(`${base}/api/calls/masked-number`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ chatId: input.chatId || "", jobId: input.jobId || "" }),
  });
  const data = (await response.json().catch(() => ({}))) as { proxyNumber?: string; error?: string; code?: string };
  if (data.code === "not_configured" || response.status === 501) throw new Error("Maskerade nummer är inte konfigurerade.");
  if (!response.ok || !data.proxyNumber) throw new Error(data.error || "Numret kunde inte hämtas");
  return data.proxyNumber;
}
