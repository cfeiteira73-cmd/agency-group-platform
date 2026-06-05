#!/usr/bin/env python3
# Generate CRM import SQL file
import warnings, os, json
warnings.filterwarnings('ignore')
import pandas as pd
from pathlib import Path
from datetime import datetime

TENANT_ID = "00000000-0000-0000-0000-000000000001"
EXCEL = Path.home() / 'Desktop/AGENCY_GROUP_CRM/OUTPUT/PHASE18/CRM_IMPORT_FINAL.xlsx'
OUT   = Path('C:/Users/Carlos/agency-group/RUN_CRM_IMPORT.sql')

PERSONA_MAP = {
    'FAMILY_OFFICE':'FAMILY_OFFICE','REAL_ESTATE_FUND':'FUND','PRIVATE_BANK':'FUND',
    'WEALTH_MANAGER':'INVESTOR','PRIVATE_CLIENT_ADVISOR':'INVESTOR','INVESTOR':'INVESTOR',
    'BUYER':'BUYER','DEVELOPER':'DEVELOPER','CONNECTOR':'CONNECTOR','INTRODUCER':'CONNECTOR',
    'PARTNER':'CONNECTOR','BROKER':'CONNECTOR','AGENT':'CONNECTOR','LAWYER':'CONNECTOR',
    'ARCHITECT':'CONNECTOR',
}

def q(v):
    if pd.isna(v) or str(v).strip() in ['','nan','NaN']:
        return 'NULL'
    return "'" + str(v).strip().replace("'","''")[:300] + "'"

def f(v, d=0.0):
    try: return round(float(v),2) if pd.notna(v) else d
    except: return d

def n(v, d=0):
    try: return int(float(v)) if pd.notna(v) else d
    except: return d

df = pd.read_excel(str(EXCEL))
print(f"Loaded {len(df):,} rows from {EXCEL.name}")

# Use available columns
skip_cols = set()
for col in ['DO_NOT_CONTACT','IS_DUPLICATE']:
    if col not in df.columns:
        print(f"Warning: {col} not in columns, skipping filter")
        skip_cols.add(col)

if 'DO_NOT_CONTACT' in df.columns:
    df = df[~df['DO_NOT_CONTACT'].astype(str).str.lower().isin(['true','1'])]
if 'IS_DUPLICATE' in df.columns:
    df = df[~df['IS_DUPLICATE'].astype(str).str.lower().isin(['true','1'])]

df = df.reset_index(drop=True)
print(f"After filter: {len(df):,} rows")

# Schema SQL
schema = """-- ============================================================
-- AGENCY GROUP CRM IMPORT
-- Creates capital_profiles table + imports 7,342 contacts
-- Run in Supabase SQL Editor (may need 2-3 runs for large data)
-- ============================================================

-- STEP 1: Create table
CREATE TABLE IF NOT EXISTS capital_profiles (
  id bigserial PRIMARY KEY,
  profile_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'BUYER',
  name text NOT NULL DEFAULT '',
  budget_min_eur numeric(15,2) NOT NULL DEFAULT 0,
  budget_max_eur numeric(15,2) NOT NULL DEFAULT 0,
  preferred_locations jsonb NOT NULL DEFAULT '[]',
  preferred_asset_types jsonb NOT NULL DEFAULT '[]',
  risk_tolerance text NOT NULL DEFAULT 'MODERATE',
  target_yield_min_pct numeric(5,2) NOT NULL DEFAULT 0,
  target_yield_max_pct numeric(5,2) NOT NULL DEFAULT 100,
  investment_horizon_months integer NOT NULL DEFAULT 60,
  liquidity_preference text NOT NULL DEFAULT 'MEDIUM',
  currency text NOT NULL DEFAULT 'EUR',
  verified boolean NOT NULL DEFAULT false,
  kyc_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE capital_profiles ENABLE ROW LEVEL SECURITY;
DO $pol$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='capital_profiles' AND policyname='service_role_all')
  THEN CREATE POLICY service_role_all ON capital_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $pol$;

-- STEP 2: Add CRM fields
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS lead_id text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS linkedin text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS country_iso text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS persona_type text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS tier text DEFAULT 'C';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS total_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS capital_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS influence_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS connector_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS deal_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS hot_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS contactability_score integer DEFAULT 60;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS crm_pipeline text DEFAULT 'NURTURE';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS owner text DEFAULT 'MARKETING';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS sofia_sequence text DEFAULT 'SEQ_NURTURE';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS next_action text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS contact_status text DEFAULT 'NEW';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS newsletter_segment text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS buying_power_est text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS priority_level integer DEFAULT 5;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS do_not_contact boolean DEFAULT false;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS manual_review boolean DEFAULT false;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS consent_status text DEFAULT 'PENDING_CONFIRMATION';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS outreach_type text DEFAULT 'NEWSLETTER';

CREATE INDEX IF NOT EXISTS idx_cp_tier     ON capital_profiles (tier);
CREATE INDEX IF NOT EXISTS idx_cp_pipeline ON capital_profiles (crm_pipeline);
CREATE INDEX IF NOT EXISTS idx_cp_owner    ON capital_profiles (owner);
CREATE INDEX IF NOT EXISTS idx_cp_persona  ON capital_profiles (persona_type);
CREATE INDEX IF NOT EXISTS idx_cp_score    ON capital_profiles (total_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_lead_id ON capital_profiles (lead_id) WHERE lead_id IS NOT NULL;

-- STEP 3: Import contacts
"""

# Column list
COLS = "profile_id,tenant_id,type,name,budget_min_eur,budget_max_eur,preferred_locations,preferred_asset_types,risk_tolerance,target_yield_min_pct,target_yield_max_pct,investment_horizon_months,liquidity_preference,currency,verified,kyc_status,created_at,lead_id,full_name,email,linkedin,country_iso,company,title,persona_type,tier,total_score,capital_score,influence_score,connector_score,deal_score,hot_score,contactability_score,crm_pipeline,owner,sofia_sequence,next_action,contact_status,newsletter_segment,buying_power_est,priority_level,do_not_contact,manual_review,consent_status,outreach_type"

def get_col(row, *names, default=''):
    for nm in names:
        if nm in row.index and pd.notna(row[nm]) and str(row[nm]).strip() not in ['','nan']:
            return str(row[nm]).strip()
    return default

chunk_size = 200
total_written = 0
chunks = []

for i in range(0, len(df), chunk_size):
    chunk = df.iloc[i:i+chunk_size]
    vals = []
    for _, row in chunk.iterrows():
        persona  = get_col(row, 'PERSONA_TYPE', default='OTHER')
        ptype    = PERSONA_MAP.get(persona, 'BUYER')
        lid      = get_col(row, 'LEAD_ID')
        nm       = get_col(row, 'Full Name').replace("'","''")
        if not nm:
            continue
        em       = get_col(row, 'Email').replace("'","''")
        li       = get_col(row, 'LinkedIn').replace("'","''")
        co_iso   = get_col(row, 'Country_ISO').replace("'","''")
        company  = get_col(row, 'Company').replace("'","''")[:150]
        title    = get_col(row, 'Title').replace("'","''")[:100]
        tier     = get_col(row, 'TIER', default='C')
        pipeline = get_col(row, 'CRM_PIPELINE', default='NURTURE')
        owner    = get_col(row, 'OWNER', default='MARKETING')
        seq      = get_col(row, 'SOFIA_SEQUENCE', default='SEQ_NURTURE')
        nxt      = get_col(row, 'NEXT_ACTION').replace("'","''")[:200]
        seg      = get_col(row, 'NEWSLETTER_SEGMENT').replace("'","''")
        bp       = get_col(row, 'BUYING_POWER_EST').replace("'","''")
        otype    = get_col(row, 'OUTREACH_TYPE', default='NEWSLETTER')
        ts       = f(row.get('TOTAL_SCORE',0))
        cs       = f(row.get('CAPITAL_SCORE',0))
        ins      = f(row.get('INFLUENCE_SCORE',0))
        cos      = f(row.get('CONNECTOR_SCORE',0))
        ds       = f(row.get('DEAL_SCORE',0))
        hs       = f(row.get('HOT_SCORE',0))
        ctsco    = n(row.get('CONTACTABILITY_SCORE',60))
        pri      = n(row.get('PRIORITY_LEVEL',5))
        mr       = 'true' if get_col(row,'MANUAL_REVIEW') in ['True','true','1'] else 'false'

        v = f"(gen_random_uuid(),'{TENANT_ID}','{ptype}','{nm}',0,0,'[]','[]','MODERATE',0,100,60,'MEDIUM','EUR',false,'PENDING',now(),'{lid}','{nm}','{em}','{li}','{co_iso}','{company}','{title}','{persona}','{tier}',{ts},{cs},{ins},{cos},{ds},{hs},{ctsco},'{pipeline}','{owner}','{seq}','{nxt}','NEW','{seg}','{bp}',{pri},false,{mr},'PENDING_CONFIRMATION','{otype}')"
        vals.append(v)

    if vals:
        total_written += len(vals)
        chunks.append((i, vals))

# Write file
with open(str(OUT), 'w', encoding='utf-8') as fh:
    fh.write(schema)
    for chunk_idx, (start, vals) in enumerate(chunks):
        fh.write(f"-- Batch {chunk_idx+1} of {len(chunks)} (rows {start}-{start+len(vals)})\n")
        fh.write(f"INSERT INTO capital_profiles ({COLS}) VALUES\n")
        fh.write(',\n'.join(vals))
        fh.write("\nON CONFLICT (lead_id) DO NOTHING;\n\n")

    fh.write("""
-- STEP 4: Verify
SELECT 'Import complete' AS status, COUNT(*) AS total_contacts FROM capital_profiles;
SELECT tier, COUNT(*) n FROM capital_profiles GROUP BY tier ORDER BY n DESC;
SELECT crm_pipeline, COUNT(*) n FROM capital_profiles GROUP BY 1 ORDER BY n DESC;
SELECT persona_type, COUNT(*) n FROM capital_profiles WHERE persona_type IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 10;
""")

sz = os.path.getsize(str(OUT))
print(f"\nGenerated: {OUT}")
print(f"Size: {sz/1024/1024:.1f} MB")
print(f"Records: {total_written:,}")
print(f"Batches: {len(chunks)}")
print(f"\nTo apply:")
print(f"  1. Go to: https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/sql/new")
print(f"  2. Paste the SQL from RUN_CRM_IMPORT.sql")
print(f"  3. The file may be large — you can split by batch numbers if needed")
print(f"  4. After run: SELECT COUNT(*) FROM capital_profiles; -- should be ~{total_written}")
