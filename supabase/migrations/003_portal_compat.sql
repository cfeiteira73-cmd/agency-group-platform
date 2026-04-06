-- =============================================================================
-- Agency Group Portal — Migration 003: Portal Compatibility Layer
-- Run this in Supabase Dashboard → SQL Editor
-- This makes the deals/contacts tables compatible with the portal API
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ALTER DEALS TABLE — add portal-friendly columns and relax constraints
-- ---------------------------------------------------------------------------

-- Add imovel (property description text — replaces title for display)
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS imovel TEXT;
-- Add valor (deal value as formatted string — e.g. "€ 1.250.000")
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS valor TEXT;
-- Add fase (Portuguese stage name — e.g. "Proposta Aceite", "CPCV Assinado")
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS fase TEXT;
-- Add comprador (buyer name as text — simpler than contact_id foreign key)
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS comprador TEXT;
-- Add ref (deal reference string — e.g. "AG-2026-001")
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS ref TEXT;
-- Add notas (deal notes — simple text)
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS notas TEXT;
-- Add cpcv_date_text / escritura_date_text as text columns for the portal
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS cpcv_date_text TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS escritura_date_text TEXT;

-- Make contact_id nullable so deals can be created without a contact link
ALTER TABLE public.deals ALTER COLUMN contact_id DROP NOT NULL;
-- Make title nullable so we can use imovel instead
ALTER TABLE public.deals ALTER COLUMN title DROP NOT NULL;

-- Create unique index on ref (deal reference number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_ref ON public.deals(ref) WHERE ref IS NOT NULL;

-- Grant service_role full access (bypasses RLS)
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Service role has full access to deals"
  ON public.deals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Agents can read all deals"
  ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Agents can insert deals"
  ON public.deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Agents can update their deals"
  ON public.deals FOR UPDATE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 2. CONTACTS TABLE — relax status enum constraint
-- ---------------------------------------------------------------------------

-- The contacts table uses a contact_status enum that includes 'client' (not 'cliente')
-- The portal maps 'cliente' → 'client' in the API layer, so no schema change needed.
-- But add 'active' status fallback for imports:
-- (enum already has 'active', 'lead', 'prospect', 'qualified', 'vip', 'client', etc.)

-- Grant service_role full access
CREATE POLICY IF NOT EXISTS "Service role has full access to contacts"
  ON public.contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. PROPERTIES TABLE — ensure compatible with portal API
-- ---------------------------------------------------------------------------

-- The properties table might not have portal-friendly columns
-- Add basic fields if missing
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS nome TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS zona TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS preco DECIMAL(12,2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS area DECIMAL(8,2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS quartos SMALLINT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS casas_banho SMALLINT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS features TEXT[];
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS gradient TEXT;

-- Grant service_role full access
CREATE POLICY IF NOT EXISTS "Service role has full access to properties"
  ON public.properties FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Agents can read all properties"
  ON public.properties FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4. SIGNALS TABLE — verify RLS policy
-- ---------------------------------------------------------------------------

-- Policy already created in migration 002
-- Just ensure service_role bypass exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'signals'
    AND policyname = 'Service role has full access to signals'
  ) THEN
    CREATE POLICY "Service role has full access to signals"
      ON public.signals FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. REFRESH GRANTS
-- ---------------------------------------------------------------------------

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;
