import Stripe from "stripe";

export type DonationCheckoutInput = {
  kind?: "support" | "dashboard_unlock";
  source?: string;
};

export type DonationCheckoutConfig = {
  appUrl?: string;
  cancelUrl?: string;
  dashboardUnlockPriceId?: string;
  donationPriceId?: string;
  secretKey?: string;
  supportPriceId?: string;
  successUrl?: string;
};

const STRIPE_API_VERSION = "2026-04-22.dahlia";

export function getDonationCheckoutConfig(env: Record<string, string | undefined>, origin?: string): DonationCheckoutConfig {
  const appUrl = env.STRIPE_APP_URL || env.VITE_APP_URL || origin;
  return {
    appUrl,
    cancelUrl: env.STRIPE_CANCEL_URL,
    dashboardUnlockPriceId: env.STRIPE_DASHBOARD_UNLOCK_PRICE_ID,
    donationPriceId: env.STRIPE_DONATION_PRICE_ID,
    secretKey: env.STRIPE_SECRET_KEY,
    supportPriceId: env.STRIPE_SUPPORT_PRICE_ID,
    successUrl: env.STRIPE_SUCCESS_URL,
  };
}

export async function createDonationCheckoutSession(input: DonationCheckoutInput, config: DonationCheckoutConfig) {
  if (!config.secretKey) {
    throw new StripeConfigError("Missing STRIPE_SECRET_KEY.");
  }
  const priceId = getCheckoutPriceId(input, config);
  if (!priceId) {
    throw new StripeConfigError("Missing Stripe price ID for checkout.");
  }

  const baseUrl = normalizeBaseUrl(config.appUrl);
  const stripe = new Stripe(config.secretKey, { apiVersion: STRIPE_API_VERSION });
  const source = sanitizeMetadataValue(input.source || "support");
  const kind = input.kind === "dashboard_unlock" ? "dashboard_unlock" : "support";

  return stripe.checkout.sessions.create({
    mode: "payment",
    submit_type: "donate",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: config.successUrl || `${baseUrl}/dashboard?support=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: config.cancelUrl || `${baseUrl}/dashboard?support=cancelled`,
    metadata: {
      app: "fyi_find_your_income",
      kind,
      source,
    },
  });
}

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigError";
  }
}

function normalizeBaseUrl(value?: string) {
  if (!value) return "http://localhost:5001";
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "http://localhost:5001";
  }
}

function sanitizeMetadataValue(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

function getCheckoutPriceId(input: DonationCheckoutInput, config: DonationCheckoutConfig) {
  if (input.kind === "dashboard_unlock") {
    return config.dashboardUnlockPriceId || config.donationPriceId;
  }
  return config.supportPriceId || config.donationPriceId;
}
