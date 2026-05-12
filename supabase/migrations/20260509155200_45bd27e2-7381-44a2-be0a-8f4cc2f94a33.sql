
CREATE TABLE public.plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  item_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  institution_name TEXT,
  accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plaid_items_user_key ON public.plaid_items(user_key);

CREATE TABLE public.plaid_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  item_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  plaid_transaction_id TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  iso_currency_code TEXT,
  date DATE NOT NULL,
  name TEXT,
  merchant_name TEXT,
  category TEXT[],
  pending BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plaid_transactions_user_key_date ON public.plaid_transactions(user_key, date DESC);

ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_transactions ENABLE ROW LEVEL SECURITY;

-- No policies: locked down to service role (edge functions) only.
