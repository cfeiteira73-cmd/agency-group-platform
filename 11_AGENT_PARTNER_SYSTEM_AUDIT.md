# 11 — AGENT / PARTNER SYSTEM AUDIT
Agency Group | Final Operating System Audit | 2026-06-11

---

## CURRENT STATE

| Metric | Value | Evidence |
|--------|-------|---------|
| Active agents | **0** | No agent accounts in DB |
| Co-agency agreements | **0** | partners table = 404 |
| Developer agreements | **0** | partners table = 404 |
| Broker agreements | **0** | partners table = 404 |
| Agents onboarded | **0** | No onboarding records |
| BROKER persona in CRM | 452 | capital_profiles |
| CONNECTOR persona in CRM | 816 | capital_profiles |
| Partners table | **MISSING** | REST API returns 404 |

---

## AGENT DASHBOARD CODE STATUS

| Component | Status |
|-----------|--------|
| /portal (main agent area) | ✅ Code exists |
| /control-tower/agents | ✅ Code exists |
| /api/control-tower/agents | ✅ Code exists |
| /api/distribution/onboard | ✅ Code exists |
| /api/distribution/invite | ✅ Code exists |
| /api/commercial/partner-tiers | ✅ Code exists |
| /api/commercial/commissions | ✅ Code exists |
| partners table | ❌ MISSING |

---

## CAN AGENCY ONBOARD 3 AGENTS TOMORROW?

**Answer: TECHNICALLY POSSIBLE, BUT NOT PRACTICAL**

What exists:
- Portal auth (NextAuth)
- Agent area in /portal
- Commission tracking code
- Lead assignment code (untested with real agents)

What's missing:
- partners table (not created)
- Agent onboarding documentation
- Real inventory for agents to sell
- Commission agreement templates
- Agent KPI tracking (metrics = 0)

**Practical answer: No. Agents need real properties to sell and a functional workflow.**

---

## CAN AGENCY ONBOARD 10 AGENTS IN 30 DAYS?

**Answer: NO — would require:**
1. Create partners table (1 hour SQL)
2. Real inventory (2-4 weeks)
3. Agent onboarding process (2 days)
4. Training materials (1 day)
5. Commission agreement (legal, 1 week)

Realistic: 10 agents operational in 60-90 days with active execution.

---

## CAN AGENCY ONBOARD 50 AGENTS IN 12 MONTHS?

**Answer: YES — with:**
1. Revenue proof (first 3-5 deals closed)
2. CRM with real buyers active
3. Proven deal pipeline
4. Agent playbook
5. Franchising/white-label infrastructure (code exists)

**Realistic: 50 agents in 12-18 months post-first-revenue.**

---

## PARTNER SEGMENTS IN CRM (never contacted)

| Type | Count | Potential |
|------|-------|----------|
| BROKER | 452 | Each = 3-10 co-agency properties |
| CONNECTOR | 816 | Each = 1-2 referral deals/year |
| DEVELOPER | 187 | Each = 5-50 new properties |
| ARCHITECT | 295 | Each = 2-5 HNWI referrals |

---

## MISSING TABLES FIX REQUIRED

```sql
-- Create partners table (5 min fix)
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'broker', 'developer', 'co_agency', 'connector'
  email TEXT,
  phone TEXT,
  company TEXT,
  commission_pct NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## SCORE: 12/100

| Category | Score | Reason |
|----------|-------|--------|
| Code infrastructure | 70/100 | Routes and portal exist |
| Active agents | 0/100 | Zero onboarded |
| Agreements | 0/100 | Zero signed |
| Partners table | 0/100 | Table missing |
| Agent workflow | 30/100 | Code exists, untested |
| Revenue from partners | 0/100 | €0 |
