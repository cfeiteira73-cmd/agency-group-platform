# CRM DISCOVERY REPORT
Agency Group | 2026-06-05 | Evidence: code scan + .env + migrations

---

## FINDING: TWO CRM SYSTEMS EXIST IN PARALLEL

### CRM System 1: Custom Supabase CRM (Primary, Built-in)
- **Location**: Supabase project isbfiofwpxqqpgxoftph
- **Tables**: contacts, deals, properties, activities, sofia_conversations
- **Migration**: supabase/migrations/001_initial_schema.sql
- **Schema**: Full real estate CRM — buyers/sellers/agents
- **Status**: TABLE EXISTS | ROW COUNT UNKNOWN (live DB not queried)
- **Evidence**: `grep "CREATE TABLE.*contacts" migrations/001_initial_schema.sql`
- **CRM routes**: /api/crm/* (6 routes confirmed)

### CRM System 2: Notion CRM (Secondary, Agent Workflow)
- **Location**: Notion workspace (geral@agencygroup.pt)
- **Database ID**: e8e554eb-adad-482e-b38b-443c23d08a40
- **Env var**: NOTION_CRM_DB configured in .env
- **Status**: CONFIGURED AND ACTIVE
- **Used by**: /api/cron/followups, /api/notion/contacts, /api/notion/seed
- **Evidence**: `grep NOTION_CRM_DB app/api/cron/followups/route.ts`

### Excel Lead Database (NOT in any CRM)
- **Location**: ~/Desktop/AGENCY_GROUP_CRM/OUTPUT/MASTER_CRM_DATABASE.xlsx
- **Rows**: 7,342 contacts
- **Status**: LOCAL FILE ONLY — NOT IMPORTED TO SUPABASE OR NOTION
- **Schema**: Different from Supabase contacts table (has TIER, CAPITAL_SCORE, etc.)

---

## CRM SYSTEM VERDICT

```
CRM_SYSTEM_1 = CUSTOM_SUPABASE_CRM (primary real estate CRM)
CRM_LOCATION_1 = Supabase isbfiofwpxqqpgxoftph / contacts table
CRM_STATUS_1 = EXISTS — ROW COUNT UNKNOWN

CRM_SYSTEM_2 = NOTION_CRM (agent workflow CRM)
CRM_LOCATION_2 = Notion DB e8e554eb-adad-482e-b38b-443c23d08a40
CRM_STATUS_2 = ACTIVE (used by followups cron)

EXCEL_DATABASE = NOT_IMPORTED
EXCEL_LOCATION = ~/Desktop/AGENCY_GROUP_CRM/OUTPUT/MASTER_CRM_DATABASE.xlsx
EXCEL_STATUS = LOCAL_ONLY — 7,342 rows not in any live CRM
```

---

## WHY THE EXCEL WAS NEVER IMPORTED

The Supabase contacts table was designed for **property CRM** (buyers/sellers in the portal).
Schema: role='buyer'/'seller', budget_min/max, preferred_locations, typologies_wanted.

The Excel leads are **institutional capital network** (family offices, funds, wealth managers).
Schema: PERSONA_TYPE, TIER, CAPITAL_SCORE, INFLUENCE_SCORE, CRM_PIPELINE, SOFIA_SEQUENCE.

These are **different schemas for different purposes**:
- Supabase contacts = active property buyers/sellers
- Excel CRM = institutional capital network for business development

The correct import target for the Excel leads is the **capital_profiles** table (W54, designed for this).

---

## WHAT NEEDS TO HAPPEN

1. Import 7,342 leads from Excel → capital_profiles table (see Phase 10)
2. The existing Supabase contacts table serves a different purpose (portal users)
3. Both can coexist without conflict
