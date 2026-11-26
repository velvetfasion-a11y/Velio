export type CheckoutOrder = {
  offerId: string;
  jobId: string;
  jobTitle: string;
  workerName: string;
  whenLabel?: string;
  priceSek: number;
};

/** In-app payments. A missing or live key stays in the local demo. */

export function stripePublishableKey() {
  return (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();
}

export function paymentsApiBase() {
  return (process.env.NEXT_PUBLIC_VELIO_API_BASE || "").replace(/\/$/, "");
}

export function paymentsMode(): "demo" | "test" {
  const key = stripePublishableKey();
  if (key.startsWith("pk_test_") && paymentsApiBase()) return "test";
  return "demo";
}

export function showTestBadge() {
  const key = stripePublishableKey();
  return paymentsMode() === "demo" || key.startsWith("pk_test_");
}

/** The offer is what the worker is paid. The customer also pays a 10% VELIO fee. */
export function quoteBreakdown(priceSek: number) {
  const work = Math.max(0, Math.round(priceSek));
  const fee = Math.round(work * 0.1);
  const total = work + fee;
  return { work, fee, total };
}

export function paymentReturnUrl() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  for (const key of ["payment_intent", "payment_intent_client_secret", "redirect_status"]) url.searchParams.delete(key);
  return url.toString();
}

export function sek(value: number) {
  return `${new Intl.NumberFormat("sv-SE").format(value)} kr`;
}
