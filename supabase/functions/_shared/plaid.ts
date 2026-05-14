// Shared Plaid helpers
const PLAID_ENV = Deno.env.get("PLAID_ENV") || "sandbox";
const PLAID_BASE = `https://${PLAID_ENV}.plaid.com`;

export async function plaid<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${PLAID_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("PLAID_CLIENT_ID"),
      secret: Deno.env.get("PLAID_SECRET"),
      ...body,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Plaid ${path} ${res.status}: ${JSON.stringify(data)}`);
  return data as T;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
