# 06 — MIGRATIONS FORENSIC LEDGER
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Summary

| Metric | Count |
|--------|-------|
| Total migration files in repo | **278** |
| Standard timestamped migrations (20260406+) | ~155 |
| Sequential numbered migrations (000036-000155) | 120 |
| Combined/manual SQL files | 4 |
| Likely applied to production DB | ~85-100 |
| Questionable / likely NOT applied | ~120 |

---

## Migration Format Analysis

### Format A — Standard Supabase (Timestamped, 2026-04-06 to 2026-05-22)

These follow proper Supabase migration format `YYYYMMDD_NNN_description.sql`.
**HIGH CONFIDENCE: Applied to production DB.**

| Range | Count | Content | Applied? |
|-------|-------|---------|---------|
| 20260406 | 4 | Pre-market properties, investidores, campanhas, sofia_conversations, collections | ✅ Likely |
| 20260407 | 4 | CRM agent tables, property embeddings, sofia memory, crm_agent_tables | ✅ Likely |
| 20260408 | 1 | Magic link used flag | ✅ Confirmed (38 logins work) |
| 20260412–13 | 19 | Offmarket leads, buyer intelligence, deal engines (001-019) | ✅ Likely |
| 20260415–17 | 5 | Fix visitas, push subscriptions, triggers, RLS, Stripe | ✅ Likely |
| 20260424–30 | ~15 | Deal packs, KPI snapshots, seller fields, campanhas, deal schema, decision engine, priority items, RLS, orgs, performance indexes, audit log | ✅ Confirmed (kpi_snapshots has 47 rows) |
| 20260501–09 | ~20 | Price history, intelligence layer, production hardening, business OS, growth machine | ✅ Likely |
| 20260510–22 | ~35 | Runtime events, omega tenancy, property AI, storage, Kafka, ML, financial audit, market capital, SRE | ⚠️ Partial |

### Format B — Sequential Numbered (000036–000155)

These use non-standard naming and were generated during infrastructure audit waves (waves 36–60).

| Range | Content | Assessment |
|-------|---------|-----------|
| 000036–000050 | KMS/SIEM, zero trust, compliance, truth audit, self-healing | ❓ Likely NOT applied |
| 000051–000090 | Financial grade, capital accounts, marketplace, execution, compliance, ML economic, financial infra | ❓ Likely NOT applied |
| 000091–000120 | Production gate, security hardening, reconciliation, DR simulation, market integrity, institutional cert | ❓ Likely NOT applied |
| 000121–000155 | Command center, go-live gate, money reality, system audit, dashboard hardening, capital execution, capital_profiles_crm_extension | ⚠️ Some may be applied (capital_profiles_crm_extension) |

**Why likely NOT applied**: These were generated during Waves 36–55 audit sessions that ran `supabase migration new` commands. The DB state (leads=18,042, contacts=28) suggests the aspirational Kafka/ML/financial infrastructure tables were NOT created.

### Format C — Manual/Combined SQL

| File | Content | Applied? |
|------|---------|---------|
| `001_initial_check.sql` | Initial schema check | ❓ |
| `001_initial_schema.sql` | Initial schema | ✅ (earliest migration) |
| `002_missing_tables.sql` | Missing table fixes | ✅ Likely |
| `002_seed_properties.sql` | Property seeding | ✅ (55 properties exist) |
| `003_portal_compat.sql` | Portal compatibility | ✅ |
| `036_public_saved_searches.sql` | Saved searches | ✅ |
| `037–042_*.sql` | Various fixes | ✅ |
| `COMBINED_OFFMARKET_MIGRATIONS.sql` | Combined run script | ❓ Manual |
| `COMBINED_RUN_IN_SUPABASE_DASHBOARD.sql` | Dashboard execution | ❓ Manual |

---

## Key Migrations by System

### Authentication System
| Migration | Creates/Fixes |
|-----------|--------------|
| `20260408_001_magic_link_used_flag.sql` | `used_magic_tokens` table — CRITICAL |
| `039_contacts_email_unique_utm.sql` | Email uniqueness constraint |

### CRM System
| Migration | Creates/Fixes |
|-----------|--------------|
| `20260407_crm_agent_tables.sql` | Agent management tables |
| `20260412_006_contacts_buyer_enrichment.sql` | Buyer fields on contacts |
| `20260424_001_deal_packs.sql` | Deal packages |
| `20260426_001_priority_items.sql` | Priority action items |
| `20260426_002_deals_revenue_fields.sql` | Revenue tracking fields |
| `20260429_003_deal_pack_view_rpc.sql` | Deal pack RPC |

### Lead Engine
| Migration | Creates/Fixes |
|-----------|--------------|
| `20260412_001_offmarket_leads.sql` | Off-market leads table |
| `20260412_002_institutional_partners.sql` | Partner framework |
| `20260412_003_offmarket_score_status.sql` | Scoring |
| `20260412_004_offmarket_scoring_buyermatch.sql` | Buyer matching |

### Sofia AI
| Migration | Creates/Fixes |
|-----------|--------------|
| `20260407_003_sofia_conversations.sql` | Conversation storage |
| `20260407_sofia_memory.sql` | Memory persistence |
| `20260502_003_intelligence_dominance.sql` | Sofia intelligence |

### KPI/Analytics
| Migration | Creates/Fixes |
|-----------|--------------|
| `20260424_002_kpi_snapshots.sql` | KPI snapshot table |
| `20260430_004_audit_log.sql` | Audit trail |

---

## Migration Risk Assessment

| Risk | Migrations Affected | Severity |
|------|---------------------|---------|
| 120 migrations likely not applied | 000036–000155 | MEDIUM — they create infrastructure that app code may reference but DB doesn't have |
| 5 tables possibly missing | partners, sellers, buyers, investment_portfolios | HIGH — 20+ API routes return 500 |
| Duplicate/overlapping schemas | Multiple migration files claim to create same tables | LOW — PostgreSQL IF NOT EXISTS guards |
| Rollback SQL files | Several `_rollback.sql` files exist | LOW — manual safety nets |

---

## How to Verify Applied Migrations

To verify which migrations are actually applied:

```sql
-- Run in Supabase SQL Editor
SELECT name FROM supabase_migrations.schema_migrations ORDER BY inserted_at;
```

This would show exactly which migrations were applied via `supabase db push`. The current session cannot execute this query due to auth issues.

---

*Evidence: supabase/migrations/ file scan (278 files) | DB state (leads=18,042) | revenue-activation/03_SQL_MIGRATIONS_REPORT.md | 2026-06-25*
