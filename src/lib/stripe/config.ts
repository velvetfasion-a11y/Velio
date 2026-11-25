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

/** The 10% service fee is included in the offer the customer pays. */
export function quoteBreakdown(priceSek: number) {
  const total = Math.max(0, Math.round(priceSek));
  const fee = Math.round(total * 0.1);
  const work = total - fee;
  return { work, fee, total };
}

export function paymentReturnUrl() {
  if (typeof window === "undefined") return "";
  const envBase = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  const prefix = envBase || (window.location.pathname.startsWith("/Velio") ? "/Velio" : "");
  return `${window.location.origin}${prefix}/checkout/`;
}

export function sek(value: number) {
  return `${new Intl.NumberFormat("sv-SE").format(value)} kr`;
}
