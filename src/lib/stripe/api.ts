import { firebaseAuth } from "@/lib/firebase/client";
import { paymentsApiBase } from "@/lib/stripe/config";

async function post<T>(path: string, body: Record<string, string>) {
  const base = paymentsApiBase();
  if (!base) throw new Error("Betaltjänsten är inte kopplad ännu");
  const token = await firebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Logga in igen");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Något gick fel");
  return data;
}

export function createPaymentIntent(offerId: string, buyer?: { companyName?: string; orgNr?: string }) {
  return post<{ clientSecret: string; paymentIntentId: string; amount: number; currency: string }>("/api/create-payment-intent", {
    offerId,
    buyerCompanyName: buyer?.companyName || "",
    buyerOrgNr: buyer?.orgNr || "",
  });
}

export function createConnectAccount() {
  return post<{ accountId: string; onboardingStatus: string }>("/api/connect/account", {});
}

export function createAccountSession() {
  return post<{ clientSecret: string }>("/api/connect/account-session", {});
}

export function releasePayout(jobId: string) {
  return post<{ payoutStatus: string }>("/api/release-payout", { jobId });
}

export function cancelCloudJob(jobId: string, reason: string) {
  return post<{ ok: boolean; released: boolean }>(`/api/support/jobs/${jobId}/cancel`, { reason });
}

export function acceptCloudBookingChange(jobId: string, messageId: string) {
  return post<{ ok: boolean }>(`/api/support/jobs/${jobId}/change`, { messageId });
}
