import { plaid, corsHeaders } from "../_shared/plaid.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type PlaidTx = {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  date: string;
  name: string;
  merchant_name: string | null;
  category: string[] | null;
  pending: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { user_key, sync } = await req.json();
    if (!user_key) {
      return new Response(JSON.stringify({ error: "user_key required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (sync) {
      const { data: items } = await supabase.from("plaid_items").select("item_id, access_token").eq("user_key", user_key);
      for (const item of items ?? []) {
        const end = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
        const r = await plaid<{ transactions: PlaidTx[] }>("/transactions/get", {
          access_token: item.access_token,
          start_date: start,
          end_date: end,
          options: { count: 250 },
        });
        if (r.transactions.length) {
          await supabase.from("plaid_transactions").upsert(r.transactions.map((t) => ({
            user_key,
            item_id: item.item_id,
            account_id: t.account_id,
            plaid_transaction_id: t.transaction_id,
            amount: t.amount,
            iso_currency_code: t.iso_currency_code,
            date: t.date,
            name: t.name,
            merchant_name: t.merchant_name,
            category: t.category,
            pending: t.pending,
          })), { onConflict: "plaid_transaction_id" });
        }
      }
    }

    const { data: txs } = await supabase
      .from("plaid_transactions")
      .select("*")
      .eq("user_key", user_key)
      .order("date", { ascending: false })
      .limit(100);
    const { data: items } = await supabase.from("plaid_items").select("institution_name, accounts").eq("user_key", user_key);

    return new Response(JSON.stringify({ transactions: txs ?? [], items: items ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("plaid-transactions error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
