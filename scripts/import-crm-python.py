#!/usr/bin/env python3
# Agency Group — CRM Import (Python version — no npm needed)
# Imports CRM_IMPORT_FINAL.xlsx into Supabase capital_profiles
# Uses Supabase REST API with service role key
#
# Run: python3 scripts/import-crm-python.py
# Dry run: DRY_RUN=true python3 scripts/import-crm-python.py

import os, sys, json, re
from datetime import datetime
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

import pandas as pd

# ── Config ───────────────────────────────────────────────────────
SUPABASE_URL  = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
SERVICE_KEY   = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
TENANT_ID     = os.environ.get('DEFAULT_TENANT_ID', '00000000-0000-0000-0000-000000000001')
DRY_RUN       = os.environ.get('DRY_RUN', 'false').lower() == 'true'
BATCH_SIZE    = 50

EXCEL_PATH = Path.home() / 'Desktop' / 'AGENCY_GROUP_CRM' / 'OUTPUT' / 'PHASE18' / 'CRM_IMPORT_FINAL.xlsx'
LOG_PATH   = Path(__file__).parent.parent / 'logs' / f"crm-import-{datetime.now().strftime('%Y-%m-%d')}.json"

print("=" * 60)
print("AGENCY GROUP — CRM IMPORT (Python)")
print(f"DRY_RUN: {DRY_RUN}")
print(f"Target: {SUPABASE_URL}")
print("=" * 60)

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip3 install requests")
    sys.exit(1)

# ── Persona type mapping ─────────────────────────────────────────
PERSONA_MAP = {
    'FAMILY_OFFICE': 'FAMILY_OFFICE', 'REAL_ESTATE_FUND': 'FUND',
    'PRIVATE_BANK': 'FUND', 'WEALTH_MANAGER': 'INVESTOR',
    'PRIVATE_CLIENT_ADVISOR': 'INVESTOR', 'INVESTOR': 'INVESTOR',
    'BUYER': 'BUYER', 'DEVELOPER': 'DEVELOPER',
    'CONNECTOR': 'CONNECTOR', 'INTRODUCER': 'CONNECTOR',
    'PARTNER': 'CONNECTOR', 'BROKER': 'CONNECTOR',
    'AGENT': 'CONNECTOR', 'LAWYER': 'CONNECTOR', 'ARCHITECT': 'CONNECTOR',
}

def safe_val(v, default=''):
    if pd.isna(v) or str(v).strip() in ['', 'nan', 'NaN']: return default
    return str(v).strip()

def safe_float(v, default=0.0):
    try: return float(v) if pd.notna(v) else default
    except: return default

def safe_bool(v, default=False):
    if pd.isna(v): return default
    return bool(v) if not isinstance(v, str) else v.lower() in ['true','1','yes']

def safe_int(v, default=0):
    try: return int(float(v)) if pd.notna(v) else default
    except: return default

# ── Load Excel ───────────────────────────────────────────────────
print(f"\n[1] Loading Excel: {EXCEL_PATH}")
if not EXCEL_PATH.exists():
    print(f"ERROR: File not found: {EXCEL_PATH}")
    sys.exit(1)

df = pd.read_excel(EXCEL_PATH)
print(f"  Loaded: {len(df):,} rows x {len(df.columns)} columns")

# Filter: skip DO_NOT_CONTACT and duplicates
before = len(df)
df = df[
    (~df['DO_NOT_CONTACT'].astype(str).str.lower().isin(['true','1'])) &
    (~df['IS_DUPLICATE'].astype(str).str.lower().isin(['true','1']))
].copy().reset_index(drop=True)
print(f"  After filtering: {len(df):,} rows (removed {before - len(df)} DNC/duplicates)")

if DRY_RUN:
    print(f"\n[DRY RUN] Would import {len(df):,} records")
    print("Sample (first 3):")
    for _, r in df.head(3).iterrows():
        print(f"  {safe_val(r.get('Full Name'))} | {safe_val(r.get('PERSONA_TYPE'))} | {safe_val(r.get('TIER'))} | {safe_val(r.get('Country_ISO'))}")
    print("\nDRY RUN complete — no data written")
    sys.exit(0)

# ── Build records ────────────────────────────────────────────────
print(f"\n[2] Building {len(df):,} records...")

def build_record(row):
    persona = safe_val(row.get('PERSONA_TYPE'))
    return {
        'profile_id':              safe_val(row.get('LEAD_ID')),
        'tenant_id':               TENANT_ID,
        'type':                    PERSONA_MAP.get(persona, 'BUYER'),
        'name':                    safe_val(row.get('Full Name')),
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
        # Extended fields (added by migration 000155)
        'lead_id':                 safe_val(row.get('LEAD_ID')),
        'full_name':               safe_val(row.get('Full Name')),
        'email':                   safe_val(row.get('Email')),
        'linkedin':                safe_val(row.get('LinkedIn')),
        'country_iso':             safe_val(row.get('Country_ISO')),
        'city':                    safe_val(row.get('City')),
        'title':                   safe_val(row.get('Title')),
        'company':                 safe_val(row.get('Company')),
        'persona_type':            persona,
        'tier':                    safe_val(row.get('TIER'), 'C'),
        'total_score':             safe_float(row.get('TOTAL_SCORE')),
        'capital_score':           safe_float(row.get('CAPITAL_SCORE')),
        'influence_score':         safe_float(row.get('INFLUENCE_SCORE')),
        'connector_score':         safe_float(row.get('CONNECTOR_SCORE')),
        'deal_score':              safe_float(row.get('DEAL_SCORE')),
        'hot_score':               safe_float(row.get('HOT_SCORE')),
        'contactability_score':    safe_int(row.get('CONTACTABILITY_SCORE', 60)),
        'crm_pipeline':            safe_val(row.get('CRM_PIPELINE'), 'NURTURE'),
        'owner':                   safe_val(row.get('OWNER'), 'MARKETING'),
        'sofia_sequence':          safe_val(row.get('SOFIA_SEQUENCE'), 'SEQ_NURTURE'),
        'next_action':             safe_val(row.get('NEXT_ACTION')),
        'contact_status':          safe_val(row.get('CONTACT_STATUS'), 'NEW'),
        'newsletter_segment':      safe_val(row.get('NEWSLETTER_SEGMENT')),
        'buying_power_est':        safe_val(row.get('BUYING_POWER_EST')),
        'portugal_interest':       safe_float(row.get('PORTUGAL_INTEREST'), 5.0),
        'priority_level':          safe_int(row.get('PRIORITY_LEVEL', 5)),
        'is_duplicate':            False,
        'do_not_contact':          False,
        'manual_review':           safe_bool(row.get('MANUAL_REVIEW')),
        'consent_status':          safe_val(row.get('CONSENT_STATUS'), 'PENDING_CONFIRMATION'),
        'outreach_type':           safe_val(row.get('OUTREACH_TYPE'), 'NEWSLETTER'),
    }

records = [build_record(row) for _, row in df.iterrows()]
print(f"  Built {len(records):,} records")

# ── Import via REST API ───────────────────────────────────────────
print(f"\n[3] Importing to Supabase in batches of {BATCH_SIZE}...")

headers = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'resolution=ignore-duplicates,return=minimal',
}

log = []
total_inserted = 0
total_skipped  = 0
total_errors   = 0

for i in range(0, len(records), BATCH_SIZE):
    batch    = records[i:i + BATCH_SIZE]
    batch_n  = i // BATCH_SIZE + 1
    total_b  = (len(records) + BATCH_SIZE - 1) // BATCH_SIZE

    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/capital_profiles",
            headers=headers,
            json=batch,
            timeout=30,
        )

        if resp.status_code in [200, 201]:
            total_inserted += len(batch)
            log.append({'batch': batch_n, 'status': 'ok', 'inserted': len(batch)})
        elif resp.status_code == 409:
            # Conflict (duplicates) — treat as skipped
            total_skipped += len(batch)
            log.append({'batch': batch_n, 'status': 'skipped', 'count': len(batch)})
        else:
            error_msg = resp.text[:200]
            total_errors += len(batch)
            log.append({'batch': batch_n, 'status': 'error', 'code': resp.status_code, 'msg': error_msg})
            if batch_n <= 3:  # Show first few errors
                print(f"  BATCH {batch_n} ERROR {resp.status_code}: {error_msg[:100]}")

    except Exception as e:
        total_errors += len(batch)
        log.append({'batch': batch_n, 'status': 'exception', 'msg': str(e)[:200]})
        print(f"  BATCH {batch_n} EXCEPTION: {e}")

    if batch_n % 20 == 0 or i + BATCH_SIZE >= len(records):
        pct = (i + len(batch)) / len(records) * 100
        print(f"  Progress: {pct:.1f}% | Inserted: {total_inserted:,} | Skipped: {total_skipped} | Errors: {total_errors}")

# ── Write log ─────────────────────────────────────────────────────
LOG_PATH.parent.mkdir(exist_ok=True)
log_data = {
    'imported_at':     datetime.now().isoformat(),
    'excel_rows':      len(df) + (before - len(df)),
    'valid_rows':      len(df),
    'total_inserted':  total_inserted,
    'total_skipped':   total_skipped,
    'total_errors':    total_errors,
    'batches':         log,
}
with open(LOG_PATH, 'w') as f:
    json.dump(log_data, f, indent=2)

# ── Summary ───────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("IMPORT COMPLETE")
print("=" * 60)
print(f"  Excel rows:   {len(df):,}")
print(f"  Inserted:     {total_inserted:,}")
print(f"  Skipped:      {total_skipped:,}")
print(f"  Errors:       {total_errors:,}")
print(f"  Log:          {LOG_PATH}")

if total_errors > 0:
    print(f"\nWARNING: {total_errors} errors. Check log for details.")
    print("Common cause: migration 000155 not applied — column 'lead_id' doesn't exist yet")
    print("Fix: Apply migration 000155 in Supabase SQL Editor first, then re-run")

if total_inserted > 0:
    print(f"\nSUCCESS: {total_inserted:,} records imported to capital_profiles")
    print("Verify: SELECT COUNT(*) FROM capital_profiles;")
else:
    print("\nNO RECORDS IMPORTED")
    if total_errors > 0:
        print("Apply migration 000155 first, then re-run this script")
