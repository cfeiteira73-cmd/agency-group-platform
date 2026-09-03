# 02 — TRUTH, DATA & COMPLIANCE
**Agency Group | 2026-09-03**

---

## CORE PRINCIPLE

**Zero Fabrication.** Every claim on the platform, in communications, and in this documentation must be either VERIFIED, ESTIMATED (with source), or stated as UNKNOWN.

This is not optional. HNWI and institutional buyers verify everything. One fabricated claim destroys trust permanently.

---

## WHAT IS TRUE (VERIFIED)

| Claim | Verified | Evidence |
|-------|----------|---------|
| AMI License 22506 | ✅ TRUE | IMPIC license issued to Carlos Feiteira |
| Commission 5% | ✅ TRUE | Standard policy |
| 18,042 CRM contacts | ✅ TRUE | Supabase leads table |
| 25,384 capital profiles | ✅ TRUE | capital_profiles table |
| TS 0 errors | ✅ TRUE | `pnpm tsc --noEmit` = 0 |
| 2,222 tests passing | ✅ TRUE | vitest output |
| OWASP 87/100 | ✅ TRUE | Wave 7 audit |
| 55 blog articles | ✅ TRUE | /blog directory count |
| 113 emails sent 2026-09-03 | ✅ TRUE | Resend API log |
| Sofia 7 roles, 8 tools | ✅ TRUE | Code inspection |
| Vercel Paris cdg1 | ✅ TRUE | Vercel dashboard |
| Supabase Frankfurt | ✅ TRUE | Supabase dashboard |

---

## WHAT IS UNKNOWN (NOT FABRICATED)

| Unknown | Why unknown |
|---------|------------|
| Revenue / GCI | 0 closed deals |
| Active mandates | Not in system |
| Sofia conversations | sofia_conversations table empty |
| Google organic traffic | GSC not checked |
| AVM accuracy (claimed ±4.2%) | No real transactions to validate against |
| pgvector search quality | Not tested with real buyer queries |
| WhatsApp message volume | Token not set |
| n8n workflow execution | Not deployed |
| Performance metrics | Not measured |

---

## WHAT WAS CLEANED (PRIOR LEGAL AUDIT)

The following were removed during the Wave 4–6 legal audit:
- Fake statistics on public pages (claimed awards, unverified transaction volumes)
- Fake review quotes from clients who do not exist
- Inflated market share claims
- Any implied endorsements not obtained

**Current status:** All public-facing pages contain only verified or clearly estimated data.

---

## COMPLIANCE STATUS

| Requirement | Status |
|-------------|--------|
| AMI 22506 (Portuguese RE license) | ✅ Active |
| GDPR Article 17 (right to erasure) | ✅ Cron purge implemented |
| GDPR Article 20 (data portability) | ✅ Implemented |
| Magic link one-time use | ✅ SHA-256 blocklist |
| Cookie consent | ✅ Implemented |
| Terms of service | UNKNOWN — not audited this session |
| Privacy policy | UNKNOWN — not audited this session |

---

## DATA INTEGRITY RULES (PERMANENT)

1. Never overwrite CRM records without matching LEAD_ID, email, or LinkedIn
2. Never delete CRM contacts (mark do_not_contact instead)
3. Never import data without deduplication check
4. Never claim more transactions than have been verified
5. Always use: `company_name` (not `company`), `country` (not `country_iso`) in leads table
6. CRM accuracy: before any outreach, verify email_confidence ≥ 0.5
