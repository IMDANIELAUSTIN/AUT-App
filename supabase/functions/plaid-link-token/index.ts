import { plaid, corsHeaders } from "../_shared/plaid.ts";

function getCountryCodes() {
  return (Deno.env.get("PLAID_COUNTRY_CODES") || "US")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { user_key } = await req.json();
    if (!user_key || typeof user_key !== "string") {
      return new Response(JSON.stringify({ error: "user_key required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await plaid<{ link_token: string; expiration: string }>("/link/token/create", {
      user: { client_user_id: user_key },
      client_name: "FYI — Find Your Income",
      products: ["transactions"],
      country_codes: getCountryCodes(),
      language: "en",
    });
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("plaid-link-token error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
