# 15 — REBUILD ANALYSIS
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## SYSTEM SIZE (EXACT COUNT — 2026-06-11)

| Metric | Value |
|--------|-------|
| Total source files | 2,837 (excl. node_modules/.next) |
| TypeScript files (.ts) | 1,613 |
| TypeScript React files (.tsx) | 390 |
| SQL migration files | 293 |
| Markdown documentation | 301 |
| JSON configs | 104 |
| Python scripts | 22 |
| Total lines of code (TS/TSX/JS) | 461,190 |
| App pages | 142 |
| API routes | 542 |
| Library service files | ~400+ |
| Database migrations | 278 |
| Cron jobs | 41 |
| n8n workflows | 11 |
| Test files (vitest) | 91 |
| Unit tests | 2,222 |
| Playwright e2e | Configured |

---

## REBUILD COST SCENARIOS

### Scenario 1: Junior Developer (Portugal, solo)
| Item | Value |
|------|-------|
| Cost/month | €1,500-€2,000 |
| Time to rebuild | 24-36 months |
| Total cost | €36,000-€72,000 |
| Risk | Very High |
| Quality match | 25% |
| Verdict | NOT RECOMMENDED |

Junior cannot replicate: security architecture, AI integration, ML pipeline, compliance layer, event bus, zero-trust auth.

### Scenario 2: Senior Developer (Portugal, solo)
| Item | Value |
|------|-------|
| Cost/month | €4,000-€6,000 |
| Time to rebuild | 18-24 months |
| Total cost | €72,000-€144,000 |
| Risk | High |
| Quality match | 65% |
| Verdict | Possible but risky |

One senior cannot maintain quality across 542 API routes + 400 lib files + compliance + ML.

### Scenario 3: Senior Dev Team (2 seniors + PM, Portugal)
| Item | Value |
|------|-------|
| Cost/month | €12,000-€18,000 |
| Time to rebuild | 12-18 months |
| Total cost | €144,000-€324,000 |
| Risk | Medium |
| Quality match | 80% |
| Verdict | Realistic |

### Scenario 4: Boutique Agency (Portugal/Spain)
| Item | Value |
|------|-------|
| Project cost | €200,000-€400,000 |
| Time | 10-14 months |
| Risk | Medium-High |
| Quality match | 70% |
| Verdict | Expensive, uncertain |

### Scenario 5: Global Agency (McKinsey Digital, BCG, Accenture)
| Item | Value |
|------|-------|
| Project cost | €1,000,000-€3,000,000 |
| Time | 12-18 months |
| Risk | Low-Medium |
| Quality match | 90% |
| Verdict | Overkill for current stage |

---

## WHAT CANNOT BE REBUILT CHEAPLY

| Asset | Rebuild Difficulty | Why |
|-------|------------------|-----|
| 7,342 capital_profiles contacts | VERY HIGH | 18-24 months scraping + enrichment |
| Security architecture | HIGH | OWASP + timingSafeEqual + RLS + zero-trust |
| pgvector embeddings | MEDIUM | Re-embedding all content |
| 278 migration history | CANNOT BE REBUILT | Only exists in git history |
| AI agent configuration | MEDIUM | Prompts + tools + memory system |
| Blog SEO (55 articles) | MEDIUM | Indexed, backlinks, domain age |
| 30,901+ outreach queue | MEDIUM | Targeting logic + history |

---

## FAIR MARKET VALUE

| Asset | Low Estimate | High Estimate |
|-------|-------------|--------------|
| Tech platform (code) | €120,000 | €200,000 |
| Capital network (7,342 contacts) | €200,000 | €500,000 |
| Institutional AI system | €80,000 | €150,000 |
| SEO domain + 55 articles | €30,000 | €80,000 |
| Compliance & security layer | €50,000 | €100,000 |
| Brand + AMI licence | €20,000 | €50,000 |
| **Total** | **€500,000** | **€1,080,000** |

**Note**: This is replacement/strategic value, NOT revenue value (which is €0 today).

---

## ACTUAL REBUILD TIME BY MODULE

| Module | Time to Rebuild | Specialist Needed |
|--------|----------------|------------------|
| Public website (142 pages) | 3 months | Frontend dev |
| API layer (542 routes) | 6 months | Backend dev |
| Database schema (278 migrations) | 4 months | DB architect |
| Sofia AI system | 2 months | AI engineer |
| Security layer (OWASP) | 3 months | Security engineer |
| ML pipeline | 4 months | ML engineer |
| n8n workflows | 1 month | Automation engineer |
| Compliance (GDPR, SOC2) | 3 months | Compliance + dev |
| Testing (2,222 tests) | 2 months | QA engineer |
| Capital profiles data | 18+ months | Data researcher |

**Total for technology alone: ~18-24 months with a team**

---

## CONCLUSION

```
What was built: €500K-€1M in strategic value
What it cost: Time + Claude API + Vercel + Supabase
What's missing: €0 in revenue

The platform is a fully built institutional real estate 
technology company. The only thing missing is Carlos 
selling properties.
```

---

*Evidence: file system count (PowerShell), lib/ analysis, Supabase migrations — 2026-06-11*
