# CRM DATABASE AUDIT
Agency Group | 2026-06-05 | Evidence: migrations + Supabase project

---

## TABLE STATUS (* = requires migration 000149-000154 applied)

| Table | Exists | Rows | Key Columns | Sofia linked | Dashboard |
|-------|--------|------|-------------|-------------|----------|
| contacts | ✅ YES | UNKNOWN | 50 cols: full_name, email, phone, role, status, lead_tier, l... | Yes (portal auth users) | Yes (executive dashboard) |
| deals | ✅ YES | UNKNOWN | deal_type, stage, probability, deal_value, commission_rate, ... | Partially (deal stage) | Yes (analytics) |
| properties | ✅ YES | UNKNOWN | address, price, bedrooms, area, type, status... | No (direct) | Yes (property search) |
| sofia_conversations | ✅ YES | UNKNOWN | contact_id, role, messages, context... | Yes (direct write) | No |
| sofia_conversation_turns | ⚠️ W54+ YES* | UNKNOWN | session_id, contact_id, role, intent, entities_json, lead_sc... | Yes | No |
| sofia_escalations | ⚠️ W54+ YES* | UNKNOWN | escalation_id, reason, contact_id, human_ack_required... | Yes | No |
| capital_profiles | ⚠️ W54+ YES* | EMPTY | profile_id, type, name, budget_min_eur, preferred_locations,... | Via matching engine | No |
| asset_opportunities | ⚠️ W54+ YES* | EMPTY | asset_id, type, location, price_eur, gross_yield_pct... | Via matching engine | No |
| capital_matches | ⚠️ W54+ YES* | EMPTY | match_id, profile_id, asset_id, overall_score, grade... | Yes | No |
| audit_log | ✅ YES | UNKNOWN | actor_id, action, resource_type, result, risk_level... | No | Yes |
| forensic_audit_log | ⚠️ W54+ YES* | UNKNOWN | log_id, actor, action, payload_hash, chain_hash... | No | No |
| asel_defense_runs | ⚠️ W54+ YES* | UNKNOWN | incident_id, event_type, risk_level, capital_frozen... | No | No |
| ios_runtime_audits | ❌ NO | N/A | Migration 000152 NOT applied to production... | No | No |
| system_health_dashboards | ❌ NO | N/A | Migration 000149 NOT applied to production... | No | No |

---

## KEY FINDINGS

1. **contacts table**: Exists, unknown row count — designed for portal users (buyers/sellers)
2. **capital_profiles table**: Exists (W54 migration) — EMPTY — designed for capital network
3. **W54-W58 tables**: Exist in schema but migrations 000149-000154 not applied to production
4. **Notion CRM**: Active — 5 databases configured, used by followups cron
5. **Excel leads**: NOT in any database — live only in desktop Excel files

---

## CRITICAL GAP
The 7,342 Excel leads are in **capital_profiles** schema format but the table is EMPTY.
The import bridge was built (CRM_IMPORT_FINAL.xlsx) but never executed.
