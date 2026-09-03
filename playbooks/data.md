# PLAYBOOK — DATA GOVERNANCE
**Agency Group | Data is the €1B moat. Protect it.**

## LOAD WITH
CONSTITUTION + CURRENT_STATE + THIS PLAYBOOK + CURRENT TASK

---

## DATA HIERARCHY (by value)
1. Transaction data (0 records today — MOST VALUABLE when built)
2. Buyer demand data (25,384 capital profiles)
3. CRM contacts (18,042 with email)
4. Property data (UNKNOWN quantity, unverified)
5. Market intelligence (sourced externally)

## CORE PRINCIPLE
Every transaction makes the system smarter.
Every buyer interaction creates demand intelligence.
Every market data point must have: source, date, methodology.

## DATA QUALITY GATES
Before using any data claim publicly:
- Source known? → cite it
- Date known? → show it
- Methodology known? → note it
- Sample size known? → note it
- Rights to publish? → confirm it

## SUPABASE STRUCTURE
- `leads` — buyer/seller/investor contacts
- `capital_profiles` — structured investor demand
- `properties` — listing inventory
- `deals` — transaction pipeline
- `sofia_conversations` — AI interaction logs
- `runtime_events` — system event log

## TRANSACTION DATA PROTOCOL (from deal 1)
Every closed deal must record:
- Buyer nationality, age bracket, source
- Property type, zone, price/m²
- Days on market, viewings before offer
- Lead source attribution
- Time from lead to close

*This becomes the AVM training data and the market intelligence product.*

## GDPR COMPLIANCE
- Personal data: purpose-limited, retention defined
- Investor profiles: consent documented
- AI prompts: no raw personal data without anonymisation
- Deletion requests: processed within 30 days
- See `playbooks/privacy.md` for full protocol
