import Stripe from "stripe";

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a test key");
  }
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" });
}

const V2_VERSION = "2026-11-18.preview";

/** Accounts v2 (new Connect platforms can no longer create v1 accounts). */
export async function stripeV2(method, path, body) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a test key");
  }
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": V2_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || "Stripe request failed");
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return data;
}
