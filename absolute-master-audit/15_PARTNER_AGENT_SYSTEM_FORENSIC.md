# 15 — PARTNER / AGENT SYSTEM FORENSIC
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Verdict

**Mostly presentation. Technically built. Commercially empty.**

The partner/agent system exists as pages, routes, and DB schemas, but has 0 real agents and 0 real partners.

---

## System Reality

| Metric | Value |
|--------|-------|
| Real agents | **0** |
| Real partners | **0** |
| Agent profiles in DB (`profiles`) | **0 rows** |
| Partner records in DB | **Unknown (table may not exist)** |
| Agent pages (`/agente/[slug]`) | ✅ Code exists |
| Partner pages (`/parceiros`) | ✅ Code exists |

---

## Agent System

### Pages
| Route | Purpose | Status |
|-------|---------|--------|
| `/agente/[slug]` | Individual agent profile | ✅ Code (0 real agents) |
| `/equipa` | Team page | ✅ Shows placeholder team |

### Data
| Table | Rows | Status |
|-------|------|--------|
| `profiles` | 0 | Empty — no agents |
| Auth users | 38 logins | All Carlos |

### Capabilities Built
- Agent profile pages (dynamic slug routing)
- Commission tracking per agent
- Performance analytics per agent (`/portal/analytics/performance`)
- Agent recomputation cron (`/api/cron/recompute-agent-performance`)

**Status**: Everything built for agents, 0 agents exist.

---

## Partner System

### Pages
| Route | Purpose | Status |
|-------|---------|--------|
| `/parceiros` | Partners page | ✅ Static |
| `/white-label` | White-label offering | ✅ Static |

### DB Status
The `partners` table was one of the 5 tables reported as potentially missing. Migration `20260412_002_institutional_partners.sql` creates a `institutional_partners` table. Whether a `partners` table (separate) exists is unverified.

---

## Commission System

The commission system IS operational for real deals:
- AMI 22506 (real, legally registered)
- Commission: 5% on deal value
- Split: 50% at CPCV signing, 50% at Escritura
- IRS withholding: 25%

Stage probabilities: corrected in commit 8aa4f63
- CPCV Assinado: 70%
- Escritura Concluída: 100%

The commission calculator at `/dashboard/simulations` works with any deal data.

---

## Recruitment Infrastructure

The platform could support partner/agent recruitment via:
- `/parceiros` page (call to action)
- `/white-label` page (agency franchise offer)
- Partner onboarding n8n workflow (`workflow-j-partner-onboarding.json`)

**Status**: None of this has been commercially activated.

---

## Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Code completeness | 70/100 | Pages and routes exist |
| DB completeness | 20/100 | profiles=0, partners unknown |
| Commercial activation | 0/100 | 0 agents, 0 partners |
| Commission system | 85/100 | Works with real data |

**Bottom line**: The partner/agent layer is mostly presentation. It was built anticipating team growth that hasn't happened yet. It will activate naturally once Carlos closes the first deal and recruits the first agent.

---

*Evidence: profiles=0 verified (multiple audits) | agent/partner route file scan 2026-06-25 | reverse-engineering/13_OPERATIONAL_REALITY.md*
