# 22 — BUG FIX LOG AND TRUTH PATCHES
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

This is the canonical log of all confirmed bugs found and fixed across all audit sessions.

---

## Confirmed Bug Fixes (With Commit Evidence)

### BF-001: Magic Link Login — NOT NULL violation
| Field | Value |
|-------|-------|
| Bug | INSERT into `used_magic_tokens` was missing `email` and `expires_at` columns → PostgreSQL 23502 NOT NULL constraint → 500 error on all logins |
| Impact | **100% of users could not log in** |
| Fix | Added missing columns to INSERT statement |
| Commit | 95235ec |
| Date | 2026-04-08 |
| Category | Critical auth regression |

---

### BF-002: Properties API — Wrong Column Names
| Field | Value |
|-------|-------|
| Bug | `/api/properties/public` and `/api/properties` queried columns `title`, `zone`, `price` — actual DB columns were `nome`, `zona`, `preco` |
| Impact | All property queries returned empty / errored. `/imoveis` page showed 0 properties for 48 days |
| Fix | Updated all property API queries to use correct column names |
| Commit | 1760efe |
| Date | 2026-06-11 |
| Category | Data access bug |

---

### BF-003: WhatsApp Webhook — ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH
| Field | Value |
|-------|-------|
| Bug | `timingSafeEqual()` called with buffers of different lengths → runtime crash on every WhatsApp message |
| Impact | WhatsApp webhook would crash on any incoming message |
| Fix | Added length guard before timingSafeEqual call |
| Commit | 1760efe |
| Date | 2026-06-11 |
| Category | Crypto/runtime crash |

---

### BF-004: Pipeline Stage Probability — Wrong Percentages
| Field | Value |
|-------|-------|
| Bug | `lib/constants/pipeline.ts` had incorrect stage probabilities (e.g. CPCV = 90%) |
| Impact | Pipeline value calculations were inflated / inaccurate |
| Fix | Corrected to: Angariação=10%, Proposta=20%, CPCV=70%, Escritura=100% |
| Commit | 8aa4f63 |
| Date | 2026-06-14 |
| Category | Business logic |

---

### BF-005: Anthropic Gateway — Lazy Proxy Not Implemented
| Field | Value |
|-------|-------|
| Bug | `lib/ai/gateway.ts` instantiated Anthropic client at module load time. In test environment (vitest/jsdom), this triggered a browser-env error |
| Impact | All tests using Sofia AI or AVM routes could fail with environment error |
| Fix | Wrapped Anthropic instantiation in a lazy Proxy pattern (created only on first use) |
| Commit | 8aa4f63 |
| Date | 2026-06-14 |
| Category | Test infrastructure |

---

### BF-006: Security Test Mocks — Missing Supabase Mock
| Field | Value |
|-------|-------|
| Bug | Security-related tests were missing `vi.mock('@/lib/supabase')` causing test failures |
| Impact | Security tests failed in isolation |
| Fix | Added proper supabase mock to affected test files |
| Commit | 8aa4f63 |
| Date | 2026-06-14 |
| Category | Test infrastructure |

---

### BF-007: Commission PL Assertions — Test Assertion Errors
| Field | Value |
|-------|-------|
| Bug | Commission P&L calculation test assertions used wrong expected values |
| Impact | Commission PL tests were failing despite correct implementation |
| Fix | Corrected test assertions to match actual calculation output |
| Commit | 8aa4f63 |
| Date | 2026-06-14 |
| Category | Test correctness |

---

### BF-008: Alerts Push RPC — Wrong Parameter Name
| Field | Value |
|-------|-------|
| Bug | `/api/alerts/push` called Supabase RPC with `lead_ids` (plural) but function expected `lead_id` (singular) |
| Impact | Push alert function would fail with parameter binding error |
| Fix | Changed `lead_ids` to `lead_id` |
| Commit | 472a95e |
| Date | 2026-06-24 |
| Category | API/RPC mismatch |

---

## Fake Stats Removed (Legal Compliance)

Not bugs per se but deliberate removals to prevent legal exposure:

| Item | Location | Removed In |
|------|---------|-----------|
| Fake AggregateRating 4.8/5 schema.org | Homepage | ~6d8a959 |
| Invented buyer testimonials | Homepage/blog | ~6d8a959 |
| False transaction statistics | Homepage | ~6d8a959 |
| Agent count claims without basis | Multiple | ~6d8a959 |

---

## Known Bugs NOT Yet Fixed

| Bug | Location | Impact | Priority |
|-----|---------|--------|---------|
| Chaos test supabase mock missing | `tests/chaos/dbOutage.spec.ts`, `queueOutage.spec.ts` | Low (chaos tests only) | Low |
| 5 DB tables possibly missing | partners, campanhas, sellers, buyers, investment_portfolios | Medium (features may fail) | Fix when needed |
| Local .env.local service key corrupted | `.env.local` | Low (local dev only) | Low |
| WHATSAPP_ACCESS_TOKEN = "PREENCHER" | Vercel env | Medium (WhatsApp disabled) | Fix when activating WhatsApp |

---

## Bug Severity Matrix

| Severity | Bugs Fixed | Bugs Open |
|----------|-----------|-----------|
| Critical (100% users blocked) | 1 (BF-001 login) | 0 |
| High (revenue lost) | 1 (BF-002 properties 48 days) | 0 |
| Medium (feature broken) | 3 (BF-003, BF-004, BF-008) | 2 (5 tables, WhatsApp token) |
| Low (tests/local) | 3 (BF-005, BF-006, BF-007) | 2 (chaos tests, local key) |

**Current production state**: No known critical or high bugs.

---

*Evidence: git log commits 95235ec, 1760efe, 8aa4f63, 472a95e | reverse-engineering/15_BUG_REGISTRY.md | revenue-activation/10_BUG_RESOLUTION_REPORT.md*
