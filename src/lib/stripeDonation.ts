const DEFAULT_STRIPE_DONATION_URL = "https://donate.stripe.com/14AcN7did3POeLKdAO5c405";
const DEFAULT_STRIPE_DONATION_API = "/api/stripe/create-checkout-session";
const STRIPE_HOST_PATTERN = /^https:\/\/(buy|checkout|donate)\.stripe\.com\//i;

export const OPEN_SUPPORT_EVENT = "fyi:open-support";
export type StripeCheckoutKind = "support" | "dashboard_unlock";

export function getStripeCheckoutKind(source = "support"): StripeCheckoutKind {
  return source.includes("dashboard") || source.includes("unlock") || source.includes("paywall")
    ? "dashboard_unlock"
    : "support";
}

export function getStripeDonationApiUrl() {
  return import.meta.env.VITE_STRIPE_DONATION_API || DEFAULT_STRIPE_DONATION_API;
}

export function getStripeDonationUrl(source = "support") {
  const base = import.meta.env.VITE_STRIPE_DONATION_URL || DEFAULT_STRIPE_DONATION_URL;
  try {
    const url = new URL(base);
    url.searchParams.set("utm_source", "fyi_app");
    url.searchParams.set("utm_medium", "app");
    url.searchParams.set("utm_campaign", "pay_what_you_want_donation");
    url.searchParams.set("utm_content", source);
    return url.toString();
  } catch {
    return DEFAULT_STRIPE_DONATION_URL;
  }
}

export function isStripeDonationConfigured() {
  const staticUrl = import.meta.env.VITE_STRIPE_DONATION_URL || "";
  const apiUrl = getStripeDonationApiUrl();
  return Boolean(apiUrl) || STRIPE_HOST_PATTERN.test(staticUrl || DEFAULT_STRIPE_DONATION_URL);
}

export async function createStripeDonationCheckout(source = "support") {
  const response = await fetch(getStripeDonationApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, kind: getStripeCheckoutKind(source) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.url !== "string") {
    throw new Error(typeof payload.error === "string" ? payload.error : "Unable to start Stripe Checkout.");
  }
  return payload.url as string;
}

export async function openStripeDonation(source?: string) {
  try {
    window.location.assign(await createStripeDonationCheckout(source || "support"));
  } catch (error) {
    const staticUrl = import.meta.env.VITE_STRIPE_DONATION_URL || "";
    if (STRIPE_HOST_PATTERN.test(staticUrl || DEFAULT_STRIPE_DONATION_URL)) {
      window.location.assign(getStripeDonationUrl(source));
      return;
    }
    throw error;
  }
}
