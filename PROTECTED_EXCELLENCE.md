# PROTECTED EXCELLENCE
## Agency Group — Elements That Must Never Be Degraded
**Last updated: 2026-06-25 | Based on Digital Twin Forensic Audit**

---

## PURPOSE

This document records every element of Agency Group that is already exceptional. Before modifying anything listed here, perform an explicit review. Protect the characteristics that make it excellent before improving it.

---

## PE-01: TypeScript Architecture (0 Errors, Strict Mode)

**What it is:** 2,003 TypeScript files in strict mode with 0 compilation errors.

**Why it is excellent:**
- Zero type errors across 437,753 lines of code
- Strict mode catches null/undefined errors at compile time
- Makes refactoring safe — the compiler catches breaking changes
- Enables aggressive tooling (autocomplete, find-references, rename)

**Evidence:** `tsc.CMD --noEmit` confirms 0 errors (PowerShell 2026-06-25)

**Business value:** Reduces production bugs, enables faster development, enables future team onboarding without fear of silent type errors.

**What must NEVER be broken:**
- TypeScript strict mode (tsconfig.json `strict: true`)
- 0-error state — any PR that introduces type errors is rejected
- Existing type safety patterns (no `any` proliferation)

**Safe improvement opportunities:** More specific types, tighter Zod schemas, branded types for IDs.

---

## PE-02: Security Posture (OWASP 87/100)

**What it is:** 7 waves of security hardening resulting in OWASP 87/100.

**Why it is excellent:**
- timingSafeEqual on all sensitive comparisons (22 routes)
- Magic link: SHA-256 hashed, one-time-use, 15-min TTL
- RLS on all Supabase tables (no data leakage possible)
- Upstash Redis rate limiting on auth + AVM routes
- Field allowlists preventing mass assignment
- Ownership checks preventing cross-user data access
- GDPR Art.17+20 compliance via purge cron + export API
- Zero fake stats in production (legal compliance)

**Evidence:** Audit commits b04a4ad, 9e51c2b, 1760efe; GDPR cron 03:00 UTC confirmed

**Business value:** GDPR compliance (€10K-€20M fine avoidance), client trust, HNWI buyer confidence.

**What must NEVER be broken:**
- timingSafeEqual on all routes that do comparison
- Magic link one-time-use (SHA-256 blocklist)
- RLS policies on Supabase tables
- Rate limiting on auth routes
- CRON_SECRET on all 41 cron routes
- No fake claims, fake reviews, or fabricated statistics

**Safe improvement opportunities:** Remaining 13 OWASP points, SOC2 certification (post-€500K).

---

## PE-03: Data Assets (25,384 Buyer Profiles)

**What it is:** 18,042 leads + 7,342 capital profiles — unique institutional buyer database.

**Why it is excellent:**
- Would take 6+ months and €80K-€120K to rebuild
- Geographic alignment with actual buyer market (US 41%, UK 12%, FR 10%, UAE 7%)
- Algorithmic scoring applied (A+/A/B/C tiers)
- 184 immediately contactable emails without any enrichment
- 3,164 already in outreach_queue (pre-qualified for sequences)
- Unique positioning: no Portuguese agency has 7,342 institutional buyer profiles

**Evidence:** DB counts confirmed 2026-06-24; geographic breakdown in digital twin Phase 05

**Business value:** First-mover advantage in institutional segment; unfair leverage vs. all local competitors; foundation of the buyer intelligence moat.

**What must NEVER be broken:**
- Row counts (NEVER delete CRM records — golden rule)
- column_name accuracy: `company_name` (not `company`), `country` (not `country_iso`)
- Scoring integrity — do not reset scores without recalculating
- RLS policies (data is private to Carlos)
- Apollo enrichment results once run (do not overwrite without matching LEAD_ID)

**Safe improvement opportunities:** Apollo enrichment ($49) → +2,400 emails; LinkedIn coverage; company size data.

---

## PE-04: Sofia AI Architecture (7 Roles, 8 Tools, Multi-Channel)

**What it is:** Full multi-role AI agent built on claude-sonnet-4-6 with tool use.

**Why it is excellent:**
- 7 specialized roles (sales, qualifier, scheduler, researcher, analyst, negotiator, post_sales)
- 8 tools that write to production DB (create_contact, create_deal, etc.)
- 4 channels (web, WhatsApp pending, email, portal)
- Lazy proxy pattern prevents environment-specific initialization errors
- Consultor Jurídico covers 10 legal areas (real competitive differentiator)
- No Portuguese competitor has an equivalent AI agent

**Evidence:** lib/ai/gateway.ts (lazy proxy fix commit 8aa4f63); 2222/2222 tests passing

**Business value:** 24/7 qualification, instant response, automatic CRM creation, multilingual by default. Replaces €50K/year junior agent salary when activated.

**What must NEVER be broken:**
- Lazy proxy in gateway.ts (prevents jsdom error in tests)
- Tool call implementations (create_contact, create_deal — these write to DB)
- Role-specific prompts (tuned for Portuguese real estate)
- Multi-language capability (sofia handles all 6 languages)
- CRM integration (sofia_conversations → contacts → deals pipeline)

**Safe improvement opportunities:** WhatsApp activation, n8n follow-up integration, real conversation training data once buyers arrive.

---

## PE-05: Blog + SEO Infrastructure (55 Articles, 6 Languages)

**What it is:** 55 blog articles in 6 languages with full technical SEO implementation.

**Why it is excellent:**
- 62 days indexed in Google (cannot be accelerated with money)
- Proper hreflang on all pages (en, pt, fr, de, ar, zh)
- Schema.org Article + LocalBusiness (legitimate, no fake reviews)
- Canonical tags, robots.txt, dynamic sitemap
- Targets all high-value buyer segments (US/UK/FR/DE/ME/CN)
- 7 French articles for the 13% French buyer segment (not just 1-2)
- Content based on real market data (INE, Banco de Portugal)

**Evidence:** file scan confirmed 55 page.tsx blog files; hreflang commits b04a4ad, 9e51c2b

**Business value:** Organic discovery by international buyers searching NHR, Golden Visa, property investment Portugal. Cannot be replicated quickly — SEO authority compounds.

**What must NEVER be broken:**
- Hreflang implementation (breaking = international SEO collapse)
- Canonical tags (breaking = duplicate content penalty)
- Schema.org markup (no fake ratings, no invented reviews)
- robots.txt (breaking = Google deindex risk)
- Blog article structure (structured data integrity)

**Safe improvement opportunities:** German-language articles (5% segment underserved), Chinese-language depth, Azores content, social sharing optimization.

---

## PE-06: Test Suite (2,222 Tests, 100% Passing)

**What it is:** 103 test files, 2,222 passing tests, zero failures.

**Why it is excellent:**
- 100% pass rate enables confident deployments
- Covers commission calculations (critical business logic)
- Covers authentication flows (security-critical)
- Covers pipeline stage calculations (corrected and verified)
- Provides regression net for all future changes

**Evidence:** `pnpm vitest run` confirmed 2222/2222 (multiple sessions)

**Business value:** Prevents business logic regressions (commission errors = legal liability), enables faster development with confidence.

**What must NEVER be broken:**
- 100% pass rate — any failing test blocks deployment
- Commission calculation tests (financial accuracy)
- Auth flow tests (security)
- No mocking production behavior when real behavior is testable

**Safe improvement opportunities:** Chaos test supabase mocks (dbOutage.spec.ts, queueOutage.spec.ts), E2E tests with Playwright when team grows.

---

## PE-07: Commission + Pipeline System (Corrected Business Logic)

**What it is:** Commission calculator with corrected stage probabilities and IRS calculation.

**Why it is excellent:**
- Corrected probabilities: Angariação=10%, Proposta=20%, CPCV=70%, Escritura=100%
- IRS withholding 25% calculated automatically
- 50/50 CPCV+Escritura split tracked
- AMI 22506 commission rate 5% hardcoded correctly
- Portuguese legal framework correctly implemented

**Evidence:** commit 8aa4f63 (pipeline.ts correction); commission tests in vitest

**Business value:** Direct financial accuracy — incorrect commission calculations = wrong expectations to clients = legal liability.

**What must NEVER be broken:**
- Stage probability values (they were wrong before and have been corrected)
- IRS withholding 25% (Portuguese tax law)
- CPCV/Escritura 50/50 split
- 5% commission rate (AMI-compliant)

**Safe improvement opportunities:** Multi-agent split tracking, co-agency commission splits, expense tracking.

---

## PE-08: Infrastructure Reliability (62 Days No Crashes)

**What it is:** Vercel deployment (cdg1 Paris) running 62 days with no reported crashes.

**Why it is excellent:**
- Properties API fix means all core user journeys now work
- 41 crons all executing on schedule
- Auth system handling 38 login sessions without failure
- KPI snapshots accumulating 62+ data points

**Evidence:** kpi_snapshots 62+ rows confirmed; no Sentry alerts in DB; uptime by observation

**Business value:** Buyer and seller trust requires reliability. Every downtime during a buyer visit = lost transaction.

**What must NEVER be broken:**
- Vercel deployment pipeline (no breaking changes without staging test)
- CRON_SECRET validation on all 41 crons
- Auth system reliability
- Properties API column names (nome/zona/preco — were wrong before, corrected in 1760efe)

**Safe improvement opportunities:** CI/CD pipeline (automated pre-deploy TS + tests), staging environment, rollback procedure documentation.

---

## REVIEW PROTOCOL

Before modifying anything in this document:

1. **State what is being changed and why**
2. **Confirm what characteristic makes it excellent currently**
3. **Demonstrate that the change preserves or improves that characteristic**
4. **Run relevant tests before and after**
5. **If in doubt: DO NOT CHANGE IT YET**

---

*Protected Excellence register last audited: 2026-06-25*
*Next review: 2026-09-25 or after any significant architectural change*
