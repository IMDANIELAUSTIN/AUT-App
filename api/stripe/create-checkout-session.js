import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-04-22.dahlia";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[Stripe checkout] Missing STRIPE_SECRET_KEY.");
    res.status(503).json({ error: "Support payments are not available right now." });
    return;
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
    const baseUrl = normalizeBaseUrl(process.env.STRIPE_APP_URL || process.env.VITE_APP_URL || getOrigin(req));
    const body = typeof req.body === "object" && req.body ? req.body : {};
    const source = sanitizeMetadataValue(body.source || "support");
    const kind = body.kind === "dashboard_unlock" ? "dashboard_unlock" : "support";
    const priceId = kind === "dashboard_unlock"
      ? process.env.STRIPE_DASHBOARD_UNLOCK_PRICE_ID || process.env.STRIPE_DONATION_PRICE_ID
      : process.env.STRIPE_SUPPORT_PRICE_ID || process.env.STRIPE_DONATION_PRICE_ID;
    if (!priceId) {
      console.error(`[Stripe checkout] Missing price ID for ${kind}.`);
      res.status(503).json({ error: "Support payments are not available right now." });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: process.env.STRIPE_SUCCESS_URL || `${baseUrl}/dashboard?support=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${baseUrl}/dashboard?support=cancelled`,
      metadata: {
        app: "fyi_find_your_income",
        kind,
        source,
      },
    });

    res.status(200).json({ url: session.url });
  } catch {
    res.status(500).json({ error: "Unable to create Stripe Checkout Session." });
  }
}

function getOrigin(req) {
  const forwardedHost = req.headers["x-forwarded-host"];
  const forwardedProto = req.headers["x-forwarded-proto"];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || "https";
  return host ? `${proto}://${host}` : undefined;
}

function normalizeBaseUrl(value) {
  if (!value) return "http://localhost:5001";
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "http://localhost:5001";
  }
}

function sanitizeMetadataValue(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}
