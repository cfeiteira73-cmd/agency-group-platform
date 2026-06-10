# 21 — REBUILD COST REPORT
Agency Group | Final Operating System Audit | 2026-06-11

---

## SYSTEM SIZE (verified 2026-06-11)

| Metric | Value |
|--------|-------|
| Pages | 154 |
| API routes | 542 |
| Migrations | 278 |
| Total TS files | ~1,997 |
| Cron jobs | 41 |
| n8n workflows | 12 |
| Test files | 91 |
| Estimated total lines | ~95,000+ |

---

## REBUILD COST BY SCENARIO

### Scenario 1: Junior Developer (Portugal) — Solo
- **Cost**: €15,000–€25,000 (12-18 months at €2,000/month)
- **Time**: 18-24 months
- **Risk**: VERY HIGH — junior can't rebuild security architecture
- **Probability of matching current quality**: 30%

### Scenario 2: Senior Developer (Portugal) — Solo
- **Cost**: €48,000–€72,000 (12-18 months at €4,000-6,000/month)
- **Time**: 12-18 months
- **Risk**: HIGH — one person for 154 pages + 542 routes
- **Probability of matching**: 70%

### Scenario 3: Senior Developer (Spain) — Solo
- **Cost**: €60,000–€90,000
- **Time**: 12-18 months
- **Risk**: HIGH — same as Portugal
- **Probability of matching**: 65%

### Scenario 4: Small Team Portugal (2 seniors + PM)
- **Cost**: €150,000–€220,000/year
- **Time**: 8-12 months
- **Risk**: MEDIUM
- **Probability of matching**: 85%

### Scenario 5: Agency Portugal
- **Cost**: €180,000–€350,000 total project
- **Time**: 10-14 months
- **Risk**: MEDIUM-HIGH (scope creep, handoff)
- **Probability of matching**: 70%

### Scenario 6: Agency Spain/Iberia
- **Cost**: €250,000–€500,000
- **Time**: 10-14 months
- **Risk**: MEDIUM
- **Probability of matching**: 75%

### Scenario 7: Europe Consultancy (McKinsey Digital, BCG)
- **Cost**: €800,000–€2,000,000
- **Time**: 8-12 months
- **Risk**: LOW-MEDIUM
- **Probability of matching**: 90%

### Scenario 8: Global Enterprise Vendor (Salesforce+)
- **Cost**: €2,000,000–€10,000,000 (licenses + implementation)
- **Time**: 18-36 months
- **Risk**: LOW tech risk, HIGH business fit risk
- **Note**: Would not match — would be off-the-shelf, not custom

---

## WHAT CANNOT BE REBUILT CHEAPLY

| Component | Time to rebuild | Irreplaceable element |
|-----------|----------------|----------------------|
| 7,342 capital_profiles | 6-12 months of scraping | The contacts themselves |
| Security architecture | 3-6 months to match | timingSafeEqual, OWASP, rate limiting |
| AI integration (Sofia) | 1-2 months | Claude API config + prompts |
| 278 migrations (schema history) | Cannot be rebuilt | Only preserved in git |
| 30,901 SOFIA_QUEUE messages | 2-3 months | The targeting logic |

---

## FAIR MARKET VALUE

Based on rebuild cost + scarcity of institutional contact database:

| Asset | Value |
|-------|-------|
| Tech platform (code only) | €120,000–€180,000 |
| capital_profiles database (7,342 contacts) | €200,000–€400,000 |
| Domain + brand + SEO | €50,000–€100,000 |
| **Total fair market value** | **€370,000–€680,000** |

**Note**: This is the replacement cost, NOT current revenue value (which is €0).
The gap between tech value and revenue value is the execution deficit.

---

## CONCLUSION

**Cost to rebuild from scratch**: €120,000–€250,000 (realistic scenario)
**Time to rebuild**: 12-18 months
**Current tech quality**: Comparable to a €150,000-€200,000 agency-built platform

**The platform is underutilised. The investment is made. The gap is operational.**
