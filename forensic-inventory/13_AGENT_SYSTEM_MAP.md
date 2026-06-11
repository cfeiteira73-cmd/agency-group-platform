# 13 — AGENT SYSTEM MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## AGENT SYSTEM STATUS: NOT OPERATIONAL

The Agent (co-broker/partner) system has been built in code but the database table is missing, making it non-functional.

---

## WHAT EXISTS (CODE)

### Routes
```
GET  /api/partners/performance    — Partner performance metrics
GET  /api/agent/actions           — Agent action feed
GET  /api/agent/deal-risk         — Deal risk per agent
GET  /api/agent/negotiation       — Negotiation support
GET  /api/agent/weekly-report     — Weekly agent report
GET  /api/portal/leaderboard      — Agent leaderboard
GET  /api/portal/milestones       — Achievement milestones
GET  /api/portal/nps              — Net Promoter Score
GET  /api/commercial/commissions  — Commission calculations
GET  /api/commercial/partner-tiers — Partner tier management
GET  /api/distribution/invite     — Invite partner
POST /api/distribution/onboard    — Onboard partner
```

### Pages
```
/agente/[slug]    — Individual agent profile page
```

### Library
| File | Purpose |
|------|---------|
| lib/commercial/partnerTiering.ts | Partner tier management |
| lib/commercial/revenueAttribution.ts | Attribution model |
| lib/intelligence/agentPerformance.ts | KPI tracking |
| lib/operations/operatorEfficiency.ts | Operator metrics |

---

## WHAT'S MISSING (DATABASE)

| Missing | Impact |
|---------|--------|
| `partners` table | All /api/partners/* routes return 404/empty |
| `agent_performance` table | /api/analytics/agent-performance broken |

### SQL to Create (5 minutes)
```sql
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  company TEXT,
  tier TEXT DEFAULT 'STANDARD',
  commission_rate NUMERIC DEFAULT 0.025,
  deals_closed INTEGER DEFAULT 0,
  total_commission BIGINT DEFAULT 0,
  status TEXT DEFAULT 'active',
  onboarded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES partners(id),
  period_start DATE,
  period_end DATE,
  leads_contacted INTEGER DEFAULT 0,
  meetings_held INTEGER DEFAULT 0,
  deals_closed INTEGER DEFAULT 0,
  revenue_generated BIGINT DEFAULT 0,
  nps_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## PARTNER TIER SYSTEM (configured in code)

| Tier | Requirements | Benefits |
|------|-------------|---------|
| STANDARD | Entry level | 2.5% commission |
| SILVER | 3 deals/year | 3% commission + priority matching |
| GOLD | 8 deals/year | 3.5% commission + exclusive leads |
| PLATINUM | 15 deals/year | 4% commission + HNW introductions |
| ELITE | 25+ deals/year | 4.5% commission + CEO access |

---

## COMMISSION MODEL

| Scenario | Commission Rate | Agency Gross |
|----------|----------------|-------------|
| Sole agency (Carlos) | 5% | 100% |
| Co-agency with developer | 2.5% each | 50% |
| Co-agency with broker | 2.5% each | 50% |
| Partner referral | 0.5% referral | 4.5% retained |
| Partner closed | 2-4% partner | 1-3% retained |

---

## ONBOARDING FLOW (configured but never used)

```
1. /api/distribution/invite     — Send invite email
2. /api/distribution/onboard    — Partner registers
3. /api/auth/complete-onboarding — Account setup
4. /agente/[slug]               — Profile created
5. /portal                      — Dashboard access
```

---

## LEADERBOARD & GAMIFICATION

| Component | Status |
|-----------|--------|
| Leaderboard page | /portal/leaderboard (configured) |
| Milestones | /portal/milestones (configured) |
| NPS tracking | /portal/nps (configured) |
| Achievement system | Code ready, no data |

---

## CURRENT AGENT COUNT

| Metric | Value |
|--------|-------|
| Active agents | 0 |
| Partners registered | 0 |
| Co-agency agreements | 0 |
| Partner table | MISSING |

---

*Evidence: app/api/partners scan, lib/commercial scan, Supabase REST API (404 on partners) — 2026-06-11*
