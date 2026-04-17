-- Adicionar colunas Stripe à tabela contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ;

-- Index para lookup por stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_contacts_stripe_customer ON contacts(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_subscription_status ON contacts(subscription_status);

-- RLS: service_role pode gerir subscrições
CREATE POLICY IF NOT EXISTS "service_role_manage_subscriptions"
ON contacts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
