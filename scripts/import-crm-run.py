#!/usr/bin/env python3
# Agency Group — CRM Import FIXED (uses only columns created in PART1 schema)
# Run: python scripts/import-crm-run.py

import os, sys, json
from datetime import datetime
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Run: pip install pandas openpyxl")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

# ── Config ───────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
TENANT_ID    = "00000000-0000-0000-0000-000000000001"
BATCH_SIZE   = 100

EXCEL_PATH = Path.home() / 'Desktop' / 'AGENCY_GROUP_CRM' / 'OUTPUT' / 'PHASE18' / 'CRM_IMPORT_FINAL.xlsx'

PERSONA_MAP = {
    'FAMILY_OFFICE':'FAMILY_OFFICE','REAL_ESTATE_FUND':'FUND',
    'PRIVATE_BANK':'FUND','WEALTH_MANAGER':'INVESTOR',
    'PRIVATE_CLIENT_ADVISOR':'INVESTOR','INVESTOR':'INVESTOR',
    'BUYER':'BUYER','DEVELOPER':'DEVELOPER',
    'CONNECTOR':'CONNECTOR','INTRODUCER':'CONNECTOR',
    'PARTNER':'CONNECTOR','BROKER':'CONNECTOR',
    'AGENT':'CONNECTOR','LAWYER':'CONNECTOR','ARCHITECT':'CONNECTOR',
}

def sv(row, *keys, d=''):
    for k in keys:
        v = row.get(k)
        if v is not None and pd.notna(v) and str(v).strip() not in ['','nan','NaN']:
            return str(v).strip()[:500]
    return d

def sf(row, key, d=0.0):
    try: v=row.get(key); return float(v) if v is not None and pd.notna(v) else d
    except: return d

def si(row, key, d=0):
    try: v=row.get(key); return int(float(v)) if v is not None and pd.notna(v) else d
    except: return d

def sb(row, key, d=False):
    v = row.get(key)
    if v is None or pd.isna(v): return d
    if isinstance(v, bool): return v
    return str(v).lower() in ['true','1','yes']

print("=" * 60)
print("AGENCY GROUP — CRM IMPORT v2 (fixed columns)")
print(f"Target: {SUPABASE_URL}")
print("=" * 60)

print(f"\n[1] Loading Excel: {EXCEL_PATH}")
if not EXCEL_PATH.exists():
    print(f"ERROR: File not found: {EXCEL_PATH}")
    sys.exit(1)

df = pd.read_excel(str(EXCEL_PATH))
print(f"  Loaded: {len(df):,} rows | Columns: {list(df.columns[:10])}")

# Filter DO_NOT_CONTACT + IS_DUPLICATE (check if column exists)
before = len(df)
cols_lower = {c.lower(): c for c in df.columns}
if 'do_not_contact' in cols_lower:
    df = df[~df[cols_lower['do_not_contact']].astype(str).str.lower().isin(['true','1'])].copy()
if 'is_duplicate' in cols_lower:
    df = df[~df[cols_lower['is_duplicate']].astype(str).str.lower().isin(['true','1'])].copy()
df = df.reset_index(drop=True)
print(f"  After filtering: {len(df):,} rows (removed {before - len(df)} DNC/dupes)")

print(f"\n[2] Building records...")

def build_record(row):
    row = dict(row)
    persona = sv(row, 'PERSONA_TYPE', d='OTHER')
    name = sv(row, 'Full Name', 'FULL_NAME', 'full_name', d='')
    if not name:
        return None
    return {
        'tenant_id':               TENANT_ID,
        'type':                    PERSONA_MAP.get(persona, 'BUYER'),
        'name':                    name[:200],
        'budget_min_eur':          0,
        'budget_max_eur':          0,
        'preferred_locations':     [],
        'preferred_asset_types':   [],
        'risk_tolerance':          'MODERATE',
        'target_yield_min_pct':    0,
        'target_yield_max_pct':    100,
        'investment_horizon_months': 60,
        'liquidity_preference':    'MEDIUM',
        'currency':                'EUR',
        'verified':                False,
        'kyc_status':              'PENDING',
        'lead_id':                 sv(row, 'LEAD_ID', d=''),
        'full_name':               name[:200],
        'email':                   sv(row, 'Email', 'EMAIL', d='')[:200],
        'linkedin':                sv(row, 'LinkedIn', 'LINKEDIN', d='')[:300],
        'country_iso':             sv(row, 'Country_ISO', 'COUNTRY_ISO', d='')[:10],
        'company':                 sv(row, 'Company', 'COMPANY', d='')[:150],
        'title':                   sv(row, 'Title', 'TITLE', d='')[:100],
        'persona_type':            persona,
        'tier':                    sv(row, 'TIER', d='C'),
        'total_score':             sf(row, 'TOTAL_SCORE'),
        'capital_score':           sf(row, 'CAPITAL_SCORE'),
        'influence_score':         sf(row, 'INFLUENCE_SCORE'),
        'connector_score':         sf(row, 'CONNECTOR_SCORE'),
        'deal_score':              sf(row, 'DEAL_SCORE'),
        'hot_score':               sf(row, 'HOT_SCORE'),
        'contactability_score':    si(row, 'CONTACTABILITY_SCORE', 60),
        'crm_pipeline':            sv(row, 'CRM_PIPELINE', d='NURTURE'),
        'owner':                   sv(row, 'OWNER', d='MARKETING'),
        'sofia_sequence':          sv(row, 'SOFIA_SEQUENCE', d='SEQ_NURTURE'),
        'next_action':             sv(row, 'NEXT_ACTION', d='')[:200],
        'contact_status':          'NEW',
        'newsletter_segment':      sv(row, 'NEWSLETTER_SEGMENT', d='')[:50],
        'buying_power_est':        sv(row, 'BUYING_POWER_EST', d='')[:50],
        'priority_level':          si(row, 'PRIORITY_LEVEL', 5),
        'do_not_contact':          False,
        'manual_review':           sb(row, 'MANUAL_REVIEW'),
        'consent_status':          'PENDING_CONFIRMATION',
        'outreach_type':           sv(row, 'OUTREACH_TYPE', d='NEWSLETTER'),
    }

records = []
skipped_empty = 0
for _, row in df.iterrows():
    r = build_record(row)
    if r:
        records.append(r)
    else:
        skipped_empty += 1

print(f"  Valid records: {len(records):,} (skipped {skipped_empty} empty names)")

# ── Import via REST API ───────────────────────────────────────────
print(f"\n[3] Importing in batches of {BATCH_SIZE}...")

headers = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'resolution=ignore-duplicates,return=minimal',
}

total_inserted = 0
total_skipped  = 0
total_errors   = 0
first_errors   = []

for i in range(0, len(records), BATCH_SIZE):
    batch   = records[i:i + BATCH_SIZE]
    batch_n = i // BATCH_SIZE + 1
    total_b = (len(records) + BATCH_SIZE - 1) // BATCH_SIZE

    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/capital_profiles",
            headers=headers,
            json=batch,
            timeout=30,
        )
        if resp.status_code in [200, 201]:
            total_inserted += len(batch)
        elif resp.status_code == 409:
            total_skipped += len(batch)
        else:
            total_errors += len(batch)
            if len(first_errors) < 3:
                first_errors.append(f"Batch {batch_n}: HTTP {resp.status_code} | {resp.text[:200]}")
    except Exception as e:
        total_errors += len(batch)
        if len(first_errors) < 3:
            first_errors.append(f"Batch {batch_n}: EXCEPTION {e}")

    if batch_n % 10 == 0 or i + BATCH_SIZE >= len(records):
        pct = min((i + len(batch)) / len(records) * 100, 100)
        print(f"  {pct:5.1f}% | Batch {batch_n}/{total_b} | OK:{total_inserted:,} Skip:{total_skipped} Err:{total_errors}")

print("\n" + "=" * 60)
print("IMPORT COMPLETE")
print("=" * 60)
print(f"  Total records: {len(records):,}")
print(f"  Inserted:      {total_inserted:,}")
print(f"  Skipped:       {total_skipped:,}")
print(f"  Errors:        {total_errors:,}")

if first_errors:
    print("\nFirst errors:")
    for e in first_errors:
        print(f"  {e}")

# Save log
log_dir = Path('C:/Users/Carlos/agency-group/logs')
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"crm-import-{datetime.now().strftime('%Y-%m-%d_%H%M')}.json"
with open(log_file, 'w') as f:
    json.dump({
        'imported_at': datetime.now().isoformat(),
        'total_records': len(records),
        'inserted': total_inserted,
        'skipped': total_skipped,
        'errors': total_errors,
        'first_errors': first_errors,
    }, f, indent=2)
print(f"\nLog saved: {log_file}")
