#!/usr/bin/env python3
import warnings, os
warnings.filterwarnings('ignore')
import pandas as pd
from pathlib import Path

TENANT_ID = "00000000-0000-0000-0000-000000000001"
EXCEL = Path.home() / 'Desktop/AGENCY_GROUP_CRM/OUTPUT/PHASE18/CRM_IMPORT_FINAL.xlsx'
REPO  = Path('C:/Users/Carlos/agency-group')

PERSONA_MAP = {
    'FAMILY_OFFICE':'FAMILY_OFFICE','REAL_ESTATE_FUND':'FUND','PRIVATE_BANK':'FUND',
    'WEALTH_MANAGER':'INVESTOR','PRIVATE_CLIENT_ADVISOR':'INVESTOR','INVESTOR':'INVESTOR',
    'BUYER':'BUYER','DEVELOPER':'DEVELOPER','CONNECTOR':'CONNECTOR','INTRODUCER':'CONNECTOR',
    'PARTNER':'CONNECTOR','BROKER':'CONNECTOR','AGENT':'CONNECTOR','LAWYER':'CONNECTOR',
    'ARCHITECT':'CONNECTOR',
}

COLS = "profile_id,tenant_id,type,name,budget_min_eur,budget_max_eur,preferred_locations,preferred_asset_types,risk_tolerance,target_yield_min_pct,target_yield_max_pct,investment_horizon_months,liquidity_preference,currency,verified,kyc_status,created_at,lead_id,full_name,email,linkedin,country_iso,company,title,persona_type,tier,total_score,capital_score,influence_score,connector_score,deal_score,hot_score,contactability_score,crm_pipeline,owner,sofia_sequence,next_action,contact_status,newsletter_segment,buying_power_est,priority_level,do_not_contact,manual_review,consent_status,outreach_type"

def f(v):
    try: return round(float(v),2) if pd.notna(v) else 0
    except: return 0

def n(v, d=0):
    try: return int(float(v)) if pd.notna(v) else d
    except: return d

def gc(row, *names, d=''):
    for nm in names:
        try:
            v = row[nm]
            if pd.notna(v) and str(v).strip() not in ['','nan']: return str(v).strip()
        except: pass
    return d

def make_val(row):
    persona = gc(row, 'PERSONA_TYPE', d='OTHER')
    ptype   = PERSONA_MAP.get(persona, 'BUYER')
    lid     = gc(row, 'LEAD_ID')
    nm      = gc(row, 'Full Name').replace("'","''")
    if not nm: return None
    em  = gc(row, 'Email').replace("'","''")
    li  = gc(row, 'LinkedIn').replace("'","''")
    co  = gc(row, 'Country_ISO').replace("'","''")
    cp  = gc(row, 'Company').replace("'","''")[:150]
    ti  = gc(row, 'Title').replace("'","''")[:100]
    tr  = gc(row, 'TIER', d='C')
    pl  = gc(row, 'CRM_PIPELINE', d='NURTURE')
    ow  = gc(row, 'OWNER', d='MARKETING')
    sq  = gc(row, 'SOFIA_SEQUENCE', d='SEQ_NURTURE')
    nx  = gc(row, 'NEXT_ACTION').replace("'","''")[:200]
    sg  = gc(row, 'NEWSLETTER_SEGMENT').replace("'","''")
    bp  = gc(row, 'BUYING_POWER_EST').replace("'","''")
    ot  = gc(row, 'OUTREACH_TYPE', d='NEWSLETTER')
    ts  = f(row.get('TOTAL_SCORE', 0))
    cs  = f(row.get('CAPITAL_SCORE', 0))
    ins = f(row.get('INFLUENCE_SCORE', 0))
    cos = f(row.get('CONNECTOR_SCORE', 0))
    ds  = f(row.get('DEAL_SCORE', 0))
    hs  = f(row.get('HOT_SCORE', 0))
    ct  = n(row.get('CONTACTABILITY_SCORE', 60))
    pr  = n(row.get('PRIORITY_LEVEL', 5))
    mr  = 'true' if gc(row, 'MANUAL_REVIEW') in ['True', 'true', '1'] else 'false'
    return f"(gen_random_uuid(),'{TENANT_ID}','{ptype}','{nm}',0,0,'[]','[]','MODERATE',0,100,60,'MEDIUM','EUR',false,'PENDING',now(),'{lid}','{nm}','{em}','{li}','{co}','{cp}','{ti}','{persona}','{tr}',{ts},{cs},{ins},{cos},{ds},{hs},{ct},'{pl}','{ow}','{sq}','{nx}','NEW','{sg}','{bp}',{pr},false,{mr},'PENDING_CONFIRMATION','{ot}')"

print("Loading Excel...")
df = pd.read_excel(str(EXCEL))
print(f"Rows: {len(df):,}")

all_vals = []
for _, row in df.iterrows():
    v = make_val(row)
    if v:
        all_vals.append(v)

print(f"Valid records: {len(all_vals):,}")

# Part 1: Schema
p1 = open(str(REPO / 'RUN_CRM_PART1_SCHEMA.sql'), 'w', encoding='utf-8')
p1.write("-- PART 1/4: CREATE TABLE + COLUMNS (run first)\n")
p1.write("CREATE TABLE IF NOT EXISTS capital_profiles (\n")
p1.write("  id bigserial PRIMARY KEY, profile_id uuid NOT NULL DEFAULT gen_random_uuid(),\n")
p1.write("  tenant_id uuid NOT NULL, type text NOT NULL DEFAULT 'BUYER',\n")
p1.write("  name text NOT NULL DEFAULT '', budget_min_eur numeric(15,2) NOT NULL DEFAULT 0,\n")
p1.write("  budget_max_eur numeric(15,2) NOT NULL DEFAULT 0,\n")
p1.write("  preferred_locations jsonb NOT NULL DEFAULT '[]', preferred_asset_types jsonb NOT NULL DEFAULT '[]',\n")
p1.write("  risk_tolerance text NOT NULL DEFAULT 'MODERATE', target_yield_min_pct numeric(5,2) NOT NULL DEFAULT 0,\n")
p1.write("  target_yield_max_pct numeric(5,2) NOT NULL DEFAULT 100, investment_horizon_months integer NOT NULL DEFAULT 60,\n")
p1.write("  liquidity_preference text NOT NULL DEFAULT 'MEDIUM', currency text NOT NULL DEFAULT 'EUR',\n")
p1.write("  verified boolean NOT NULL DEFAULT false, kyc_status text NOT NULL DEFAULT 'PENDING',\n")
p1.write("  created_at timestamptz NOT NULL DEFAULT now()\n")
p1.write(");\n")
p1.write("ALTER TABLE capital_profiles ENABLE ROW LEVEL SECURITY;\n")
p1.write("DO $pol$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='capital_profiles' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON capital_profiles FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $pol$;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS lead_id text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS full_name text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS email text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS linkedin text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS country_iso text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS company text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS title text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS persona_type text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS tier text DEFAULT 'C';\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS total_score numeric(5,2) DEFAULT 0;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS capital_score numeric(5,2) DEFAULT 0;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS influence_score numeric(5,2) DEFAULT 0;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS connector_score numeric(5,2) DEFAULT 0;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS deal_score numeric(5,2) DEFAULT 0;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS hot_score numeric(5,2) DEFAULT 0;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS contactability_score integer DEFAULT 60;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS crm_pipeline text DEFAULT 'NURTURE';\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS owner text DEFAULT 'MARKETING';\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS sofia_sequence text DEFAULT 'SEQ_NURTURE';\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS next_action text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS contact_status text DEFAULT 'NEW';\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS newsletter_segment text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS buying_power_est text;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS priority_level integer DEFAULT 5;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS do_not_contact boolean DEFAULT false;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS manual_review boolean DEFAULT false;\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS consent_status text DEFAULT 'PENDING_CONFIRMATION';\n")
p1.write("ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS outreach_type text DEFAULT 'NEWSLETTER';\n")
p1.write("CREATE INDEX IF NOT EXISTS idx_cp_tier ON capital_profiles (tier);\n")
p1.write("CREATE INDEX IF NOT EXISTS idx_cp_pipeline ON capital_profiles (crm_pipeline);\n")
p1.write("CREATE INDEX IF NOT EXISTS idx_cp_owner ON capital_profiles (owner);\n")
p1.write("CREATE INDEX IF NOT EXISTS idx_cp_persona ON capital_profiles (persona_type);\n")
p1.write("CREATE INDEX IF NOT EXISTS idx_cp_score ON capital_profiles (total_score DESC);\n")
p1.write("CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_lead_id ON capital_profiles (lead_id) WHERE lead_id IS NOT NULL;\n")
p1.write("SELECT 'Part 1 complete - table ready' AS status, COUNT(*) AS rows FROM capital_profiles;\n")
p1.close()

def write_part(vals, partnum, total):
    fname = f"RUN_CRM_PART{partnum}_IMPORT.sql"
    start = (partnum-2) * 2500 + 1
    end   = min((partnum-1) * 2500, len(all_vals))
    with open(str(REPO / fname), 'w', encoding='utf-8') as fh:
        fh.write(f"-- PART {partnum}/{total}: INSERT rows {start}-{end}\n")
        for i in range(0, len(vals), 200):
            batch = vals[i:i+200]
            fh.write(f"INSERT INTO capital_profiles ({COLS}) VALUES\n")
            fh.write(',\n'.join(batch))
            fh.write("\nON CONFLICT (lead_id) DO NOTHING;\n\n")
        if partnum == total:
            fh.write("-- VERIFICATION\n")
            fh.write("SELECT 'IMPORT DONE' AS status, COUNT(*) AS total FROM capital_profiles;\n")
            fh.write("SELECT tier, COUNT(*) n FROM capital_profiles GROUP BY tier ORDER BY n DESC;\n")
            fh.write("SELECT persona_type, COUNT(*) n FROM capital_profiles GROUP BY 1 ORDER BY n DESC LIMIT 10;\n")
        else:
            fh.write(f"SELECT 'Part {partnum} done' AS status, COUNT(*) AS rows_so_far FROM capital_profiles;\n")
    sz = os.path.getsize(str(REPO / fname))
    print(f"  {fname}: {sz/1024:.0f} KB ({len(vals)} contacts)")

chunk = 2500
write_part(all_vals[:chunk],          2, 4)
write_part(all_vals[chunk:chunk*2],   3, 4)
write_part(all_vals[chunk*2:],        4, 4)

sz1 = os.path.getsize(str(REPO / 'RUN_CRM_PART1_SCHEMA.sql'))
print(f"  RUN_CRM_PART1_SCHEMA.sql: {sz1/1024:.0f} KB (table creation)")

print(f"\nAll 4 files ready. Run in Supabase SQL Editor IN ORDER:")
print(f"  1. RUN_CRM_PART1_SCHEMA.sql  — creates table + columns")
print(f"  2. RUN_CRM_PART2_IMPORT.sql  — imports rows 1-2,500")
print(f"  3. RUN_CRM_PART3_IMPORT.sql  — imports rows 2,501-5,000")
print(f"  4. RUN_CRM_PART4_IMPORT.sql  — imports rows 5,001-{len(all_vals)} + verification")
print(f"\nURL: https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/sql/new")
