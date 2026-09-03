# AGENCY GROUP — SYSTEM OF RECORD MAP
**Last updated: 2026-09-03**

> Defines the single authoritative source for every critical data type.
> Conflicts between systems → trust this map, fix the secondary.

---

## MASTER TABLE

| Data Type | System of Record | Secondary | Sync? | Owner |
|-----------|-----------------|-----------|-------|-------|
| Property status (active/sold/reserved) | Supabase `properties` | agencygroup.pt | Realtime | Carlos |
| Property price | Supabase `properties` | agencygroup.pt | Realtime | Carlos |
| Property availability | Supabase `properties` | Portal | Realtime | Carlos |
| Lead (contact) | Supabase `leads` | — | — | Sofia/CRM |
| Capital profile | Supabase `capital_profiles` | — | — | Sofia/CRM |
| Buyer demand | Supabase `leads` | — | — | CRM |
| Transaction / CPCV | Supabase `deals` | — | — | Carlos |
| Commission / Revenue | Supabase `deals` | — | — | Carlos |
| Sofia conversations | Supabase `sofia_conversations` | — | — | Sofia |
| Blog content | agencygroup.pt CMS | — | — | Carlos |
| Market statistics | External sources (INE, Confidencial Imobiliário) | Content | Manual | Carlos |
| Investor profiles | Supabase `capital_profiles` | — | — | CRM |
| Co-broker partners | Supabase (TBD) | Email/WhatsApp | None | Carlos |
| Mandate agreements | Physical/PDF | Supabase (reference) | Manual | Carlos |
| AML/KYC documents | Physical/Secure storage | Supabase (ref) | Manual | Carlos |

---

## CONFLICT RESOLUTION PROTOCOL

When two systems show different values for the same fact:

1. **Supabase is ALWAYS authoritative** for structured data
2. Website must reflect Supabase (not the reverse)
3. If website shows stale data: trigger sync or update Supabase
4. If email/WhatsApp shows different status: update Supabase immediately

**Never** trust:
- Email threads as source of truth for deal status
- WhatsApp conversations as source of truth for property status
- Memory as source of truth for any commercial fact

---

## KNOWN GAPS (2026-09-03)

| Gap | Risk | Fix |
|-----|------|-----|
| n8n not deployed → no sync automation | Medium | Deploy Railway |
| Co-broker partners: no structured table in Supabase | Medium | Create table |
| Mandate agreements: no digital record | HIGH | Add to Supabase on deal creation |
| AML/KYC: no structured workflow | HIGH | Define before first transaction |
| Market data: sourced ad-hoc | Medium | Define source list in `02_TRUTH_DATA_COMPLIANCE.md` |

---

## DATA QUALITY STANDARDS

For every property in Supabase:
- [ ] Price verified (not estimated) — date of last verification
- [ ] Status current — checked within 30 days
- [ ] Photos real and current
- [ ] Description factually accurate
- [ ] Area verified (m²) — source noted

For every lead:
- [ ] Source recorded
- [ ] Budget range confirmed (not assumed)
- [ ] Timeline confirmed
- [ ] Next action set with date

For every deal:
- [ ] All parties identified
- [ ] Commission structure documented
- [ ] CPCV date tracked
- [ ] Deed date tracked
- [ ] Commission received confirmed
