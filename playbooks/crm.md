# PLAYBOOK — CRM OPERATING SYSTEM
**Agency Group | AMI: 22506**

## LOAD WITH
CONSTITUTION + CURRENT_STATE + THIS PLAYBOOK + CURRENT TASK

---

## SINGLE SOURCE OF TRUTH
Supabase is authoritative. Email/WhatsApp are NOT CRM.

## LEAD LIFECYCLE
LEAD → QUALIFIED → VIEWING → OFFER → CPCV → DEED → AFTER-SALES

## MANDATORY FIELDS ON EVERY LEAD
- Source (how found us)
- Budget (confirmed, not assumed)
- Timeline
- Asset type preference
- Next action + date

## NEVER
- Delete CRM records
- Overwrite contact without matching by lead_id/email/LinkedIn
- Store qualification in email only

## ENRICHMENT ORDER
1. Supabase existing data
2. Apollo ($49/mo — top priority)
3. Manual research

## FOLLOW-UP PROTOCOL
- Reply within 2h during business hours
- If no reply in 48h → WhatsApp follow-up
- If no reply in 7d → final email
- After 30d silence → mark dormant, keep in CRM

## TABLES (Supabase)
- `leads` — all contacts
- `capital_profiles` — investor profiles
- `sofia_conversations` — AI interactions
- `deals` — active opportunities
