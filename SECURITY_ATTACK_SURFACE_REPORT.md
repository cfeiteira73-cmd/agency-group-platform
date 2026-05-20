# SH-ROS Security Attack Surface Report
**Wave 14 — Global Audit**  
**Generated:** 2026-05-20  
**Status:** All P0/P1 risks closed

---

## Executive Summary

Full security audit of all ~280 API routes, authentication paths, AI governance, RLS policies, and infrastructure. Wave 14 closed all identified P0/P1 security findings.

---

## 1. Authentication Layer

| Surface | Status | Mechanism |
|---------|--------|-----------|
| Portal magic link | ✅ SECURE | Timing-safe OTP, SHA-256 blocklist, rate-limited (Upstash), scanner-protected |
| Cron job auth | ✅ FIXED (Wave 14) | `timingSafeEqual` via crypto — timing oracle removed from 3 routes |
| AI market routes | ✅ FIXED (Wave 14) | `requirePortalAuth` added to market/pulse + market/cross-compare |
| Portal session | ✅ SECURE | NextAuth magic-link session cookie |
| Service-to-service | ✅ SECURE | `INTERNAL_API_TOKEN` + `PORTAL_API_SECRET` bearer |

**Previously fixed cron timing oracle routes:**
- `app/api/cron/refresh-market-segments/route.ts`
- `app/api/cron/refresh-engagement-decay/route.ts`  
- `app/api/cron/collect-soc2-evidence/route.ts`

---

## 2. Row Level Security (RLS)

All 8 critical business data tables now have full RLS:

| Table | RLS | Policy Type | Wave |
|-------|-----|------------|------|
| contacts | ✅ ON | `agent_email = auth.email() OR tenant_id IN org_members` | Wave 12 |
| deals | ✅ ON | Same | Wave 12 |
| properties | ✅ ON | Same | Wave 12 |
| matches | ✅ ON | `authenticated + org_members` | Wave 13 |
| deal_packs | ✅ ON | `authenticated + org_members` | Wave 13 |
| priority_items | ✅ ON | `org_id IN org_members` | **Wave 14** |
| learning_events | ✅ ON | `org_id` scoped | pre-Wave 12 |
| incidents | ✅ ON | `tenant_id` scoped | pre-Wave 12 |

**Zero `OR true` or public-writable policies on business data tables.**

---

## 3. AI Governance Attack Surface

| Risk | Status | Detail |
|------|--------|--------|
| AI budget drain (no auth) | ✅ FIXED (Wave 14) | market/pulse + market/cross-compare now require portal auth |
| Redis down → uncapped spend | ✅ FIXED (Wave 13) | policyEngine fail-CLOSED when Redis absent |
| Direct Anthropic() bypasses | ⚠️ PARTIALLY FIXED | ~14 routes identified; 2 critical (market routes) fixed; remaining are internal routes with auth |
| policyEngine DENY on budget exceeded | ✅ SECURE | monthlyTokenBudget enforced per agent |

---

## 4. Data Exposure

| Surface | Status | Detail |
|---------|--------|--------|
| Raw Supabase errors in HTTP responses | ✅ FIXED (Wave 14) | alerts/push + contact-enrichment/run sanitized |
| Raw AI output on parse failure | ✅ FIXED (Wave 14) | 4 routes return 502, generate-description returns `{text, structured:false}` |
| WhatsApp sender name in logs | ✅ FIXED (Wave 11) | senderName redacted |
| WhatsApp message body in debug logs | ⚠️ P3 DEFERRED | RISK-007 — message content (not identity), low priority |

---

## 5. Infrastructure

| Surface | Status | Detail |
|---------|--------|--------|
| INTERNAL_API_BASE localhost guard | ✅ SECURE | P0 incident written if localhost in production |
| CRON_SECRET whitespace validation | ✅ SECURE | Fixed Wave 6 |
| Auth rate limiting | ✅ SECURE | Upstash Redis rate limiting on auth/send + auth/verify |
| Auth secret minimum length | ✅ SECURE | AUTH_SECRET < 32 chars → P0 at boot |
| SUPABASE_URL https enforcement | ✅ SECURE | Must start with https:// |

---

## 6. Remaining Open Surface (P3 only)

| ID | Surface | Severity | Note |
|----|---------|----------|------|
| RISK-007 | WhatsApp message body in debug logs | P3 | GDPR edge case, identity already redacted |
| — | `runtime_events_warm` + `runtime_events_dlq` RLS unverified | P3 | Tables exist, RLS status not confirmed |
| — | ~12 internal AI routes with direct `new Anthropic()` | P3 | All have portal auth; budget drain limited |
| — | In-memory cache in market-data + draft-offer routes | P3 | Single-instance only, not multi-instance safe |

---

## Appendix: Timing Oracle Fix Applied

```typescript
// BEFORE (vulnerable — string comparison time reveals secret length/content):
if (!cronExpected || !secret || secret !== cronExpected) { ... }

// AFTER (timing-safe):
if (!cronExpected || !secret) { return 401 }
const { timingSafeEqual } = await import('crypto')
const a = Buffer.from(secret, 'utf8')
const b = Buffer.from(cronExpected, 'utf8')
const match = a.length === b.length && timingSafeEqual(a, b)
if (!match) { return 401 }
```
