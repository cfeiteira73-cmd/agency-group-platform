#!/usr/bin/env python3
# Apply migration 000155 via Supabase REST API
# Uses service role key — works without browser/PAT

import os, json, requests

SUPABASE_URL = "[SUPABASE_URL from .env.local]"
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "[from .env.local]")

# Read migration SQL
sql = open(os.path.join(os.path.dirname(__file__), '..', 'supabase', 'migrations',
    '000155_capital_profiles_crm_extension.sql')).read()

print("Migration SQL preview (first 200 chars):")
print(sql[:200])
print("...")
print(f"\nSQL length: {len(sql)} chars")

# Note: Supabase REST API doesn't support DDL directly
# This script generates the SQL to paste in Supabase Dashboard
print("\n" + "="*60)
print("MANUAL STEP REQUIRED")
print("="*60)
print(f"""
The Supabase REST API cannot run DDL statements (ALTER TABLE).
You need to run this SQL manually in the Supabase SQL Editor.

URL: https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/sql/new

The migration file is ready at:
supabase/migrations/000155_capital_profiles_crm_extension.sql

Or copy and paste this SQL directly:
""")
print(sql)
