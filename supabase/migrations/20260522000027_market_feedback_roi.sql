-- Agency Group — Market Feedback + ROI Engine
-- Migration: 20260522000027_market_feedback_roi.sql
-- Layers 7+8: closing price ingestion, bank confirmations, market calibration, ROI predictions/tracking

CREATE TABLE IF NOT EXISTS closing_price_records (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid NOT NULL,
  property_id         uuid,
  external_asset_id   text,
  closing_price_eur   numeric(15,2) NOT NULL CHECK (closing_price_eur > 0),
  asking_price_eur    numeric(15,2),
  price_delta_pct     numeric(8,4),
  source              text NOT NULL CHECK (source IN ('notario','bank_confirmation','manual','registry')),
  district            text NOT NULL,
  zone                text,
  typology            text,
  area_sqm            numeric(10,2),
  closed_at           timestamptz NOT NULL,
  mortgage_amount_eur numeric(15,2),
  cash_percentage     numeric(5,2),
  days_on_market      integer,
  ingested_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_confirmations (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid NOT NULL,
  reference_code text NOT NULL,
  amount_eur     numeric(15,2) NOT NULL,
  confirmed_at   timestamptz NOT NULL,
  bank_reference text NOT NULL,
  status         text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','rejected','pending_review')),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_calibration_runs (
  id                         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                  uuid NOT NULL,
  zone                       text NOT NULL,
  sample_count               integer NOT NULL DEFAULT 0,
  avg_price_delta_pct        numeric(8,4),
  median_days_on_market      integer,
  cash_purchase_rate         numeric(5,4),
  price_discovery_accuracy   numeric(5,4),
  liquidity_engine_delta     numeric(8,4),
  calibrated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, zone, calibrated_at)
);

CREATE TABLE IF NOT EXISTS roi_predictions (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                 uuid NOT NULL,
  property_id               uuid NOT NULL,
  investor_id               uuid,
  predicted_roi_pct         numeric(8,4) NOT NULL,
  predicted_gross_yield_pct numeric(8,4),
  capital_at_risk_eur       numeric(15,2),
  execution_probability     numeric(5,4),
  time_to_return_days       integer,
  confidence                numeric(5,4),
  factors                   jsonb NOT NULL DEFAULT '{}',
  predicted_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roi_tracking (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            uuid NOT NULL,
  deal_id              uuid NOT NULL,
  property_id          uuid NOT NULL,
  investor_id          uuid,
  predicted_roi_pct    numeric(8,4),
  actual_roi_pct       numeric(8,4),
  prediction_error_pct numeric(8,4),
  capital_deployed_eur numeric(15,2) NOT NULL,
  gross_return_eur     numeric(15,2),
  days_to_close        integer,
  tracked_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, deal_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_closing_price_records_zone
  ON closing_price_records (tenant_id, zone, closed_at DESC);

CREATE INDEX IF NOT EXISTS idx_closing_price_records_district
  ON closing_price_records (tenant_id, district, closed_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_calibration_zone
  ON market_calibration_runs (tenant_id, zone, calibrated_at DESC);

CREATE INDEX IF NOT EXISTS idx_roi_predictions_property
  ON roi_predictions (tenant_id, property_id, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_roi_tracking_deal
  ON roi_tracking (tenant_id, deal_id);

-- Row Level Security
ALTER TABLE closing_price_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_calibration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'closing_price_records' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON closing_price_records
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_confirmations' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON bank_confirmations
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_calibration_runs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON market_calibration_runs
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'roi_predictions' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON roi_predictions
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'roi_tracking' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON roi_tracking
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
