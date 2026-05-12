import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from '@tailwindcss/vite';
import { createDonationCheckoutSession, getDonationCheckoutConfig, StripeConfigError } from "./server/stripeCheckout";

export default defineConfig({
  plugins: [
    stripeCheckoutApi(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});

function stripeCheckoutApi(): Plugin {
  return {
    name: "fyi-stripe-checkout-api",
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), "");

      server.middlewares.use("/api/stripe/create-checkout-session", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed." });
          return;
        }

        try {
          const input = await readJsonBody(req);
          const origin = getOrigin(req);
          const session = await createDonationCheckoutSession(input, getDonationCheckoutConfig(env, origin));

          sendJson(res, 200, { url: session.url });
        } catch (error) {
          const isConfigError = error instanceof StripeConfigError;
          if (isConfigError) console.error("[Stripe checkout]", error.message);
          sendJson(res, isConfigError ? 503 : 500, {
            error: isConfigError ? "Support payments are not available right now." : "Unable to create Stripe Checkout Session.",
          });
        }
      });
    },
  };
}

function readJsonBody(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16_384) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

function getOrigin(req: import("node:http").IncomingMessage) {
  const origin = req.headers.origin;
  if (typeof origin === "string") return origin;
  const host = req.headers.host;
  return typeof host === "string" ? `http://${host}` : undefined;
}

function sendJson(res: import("node:http").ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
