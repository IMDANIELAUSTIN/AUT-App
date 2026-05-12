import { plaid, corsHeaders } from "../_shared/plaid.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { user_key, public_token, institution } = await req.json();
    if (!user_key || !public_token) {
      return new Response(JSON.stringify({ error: "user_key and public_token required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const exch = await plaid<{ access_token: string; item_id: string }>("/item/public_token/exchange", { public_token });
    const accountsRes = await plaid<{ accounts: Array<{ account_id: string; name: string; mask: string; subtype: string; type: string }> }>("/accounts/get", { access_token: exch.access_token });

    const { error } = await supabase.from("plaid_items").upsert({
      user_key,
      item_id: exch.item_id,
      access_token: exch.access_token,
      institution_name: institution?.name ?? null,
      accounts: accountsRes.accounts,
      updated_at: new Date().toISOString(),
    }, { onConflict: "item_id" });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, accounts: accountsRes.accounts, institution: institution?.name }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("plaid-exchange error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
