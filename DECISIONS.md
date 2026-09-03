# AGENCY GROUP — KEY DECISIONS LOG
**Last updated: 2026-09-03**

---

## STRATEGIC DECISIONS

### D001 — €1B North Star (2026-09-03)
**Decision:** Set €1B enterprise value as the long-term North Star.
**Rationale:** Forces long-term platform thinking over transaction-only optimization. Changes every build decision.
**Constraints:** NOT a valuation claim. NOT permission to fabricate scale. Forces strategic choices.
**Status:** ACTIVE — all decisions evaluated against €1B path

### D002 — 5% Commission, 50% CPCV / 50% Escritura (set: pre-2026)
**Decision:** Fixed commission structure across all segments.
**Rationale:** Simple, defensible, standard-compliant.
**Status:** ACTIVE — do not change without explicit review

### D003 — Core Segment €500K–€3M with €100K–€100M range (set: pre-2026)
**Decision:** Premium positioning, no sub-€100K properties.
**Rationale:** HNWI brand requires premium positioning. Sub-premium destroys brand value.
**Status:** ACTIVE — never compromise

### D004 — Multi-language (6 languages) strategy (set: 2026 Q1)
**Decision:** EN + PT + FR + DE + ZH + IT all first-class.
**Rationale:** Top buyer nationalities (US 16%, FR 13%, UK 9%, CN 8%) + domestic market.
**Status:** ACTIVE — content and Sofia both multilingual

### D005 — Supabase as single source of truth (set: 2026 Q1)
**Decision:** All data written to Supabase first. No Notion as primary DB.
**Rationale:** Query capability, RLS, pgvector, foreign keys — Notion cannot do this.
**Status:** ACTIVE — never bypass Supabase for production data

### D006 — Sofia AI powered by claude-sonnet-4-6 (set: 2026 Q1)
**Decision:** Use Claude, not GPT, for Sofia. claude-sonnet-4-6 as default.
**Rationale:** Superior instruction-following, superior multilingual quality, better tool use.
**Status:** ACTIVE — review when Claude 5 family is stable and well-priced

### D007 — Zero tolerance for fabrication (set: 2026-06-25, reinforced 2026-09-03)
**Decision:** Never invent: properties, clients, transactions, revenue, team, offices, stats.
**Rationale:** HNWI/institutional buyers verify everything. One false claim = permanent reputation damage.
**Status:** PERMANENT — cannot be overridden

### D008 — Resend for transactional email (2026-09-03)
**Decision:** Resend is the email provider. Key: re_MRqLWf4u (created 2026-09-03, replaces expired key).
**Status:** ACTIVE — key renewed. Monitor quarterly.

### D009 — n8n for workflow automation (set: 2026 Q1)
**Decision:** n8n on Railway as automation layer. Connects to Supabase and Next.js.
**Status:** PENDING — n8n not yet deployed. Deploy = P1 priority.

---

## TECHNICAL DECISIONS

### T001 — Next.js 16 App Router (set: 2026 Q1)
**Decision:** Full App Router, no Pages Router mixing.
**Status:** ACTIVE — never revert to Pages Router

### T002 — pnpm as package manager (set: 2026 Q1)
**Decision:** pnpm only. npm corrupted. Never mix.
**Status:** ACTIVE — always use pnpm

### T003 — TS strict mode, 0 errors required (set: 2026 Q1)
**Decision:** TypeScript strict. `pnpm tsc --noEmit` must return 0.
**Status:** PERMANENT — never release with TS errors

### T004 — OWASP 87 baseline, never degrade (set: 2026-06-25)
**Decision:** Security score floor = 87/100. Every release maintains or improves.
**Status:** PERMANENT

---

## OPEN QUESTIONS (not yet decided)

- When to raise institutional capital (if ever)?
- First hire profile: sales agent vs. tech developer?
- Co-agency partnership structure: revenue share model?
- Developer mandate fee structure: % or flat + %?
