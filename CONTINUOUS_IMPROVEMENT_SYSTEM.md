# CONTINUOUS IMPROVEMENT SYSTEM
## Agency Group — Recurring Review Framework
**Version 1.0 | 2026-06-25**

---

## PURPOSE

This system ensures Agency Group permanently improves across all dimensions. It defines WHO reviews WHAT, HOW OFTEN, and with WHAT OUTPUT. The goal is compounding improvement — every review produces at least one concrete action.

---

## THE PERMANENT RELEASE QUESTION

Before any code deployment, feature change, or strategic decision:

> **"Is Agency Group materially better after this than before it?"**

If the answer is not clearly YES, do not release. Better means: more leads, more revenue, better conversion, better security, better user experience, better brand — not just "different."

---

## REVIEW CALENDAR

### DAILY (5-minute checks — Carlos only until first agent hire)

| Check | Method | Pass Condition | Fail Action |
|-------|--------|----------------|-------------|
| Vercel uptime | Check agencygroup.pt loads | 200 response | Debug immediately |
| Sofia responding | Send test message to widget | Response < 3s | Check Anthropic key |
| Any inbound leads | Check contacts DB | — | Review + respond same day |
| New Sofia conversations | Check sofia_conversations | — | Review + follow up |
| n8n workflows (once deployed) | Railway dashboard | All green | Debug failed workflow |

---

### WEEKLY (Sunday, 30 minutes)

#### COMMERCIAL (Priority 1)

| Review | What to check | Output |
|--------|--------------|--------|
| Lead pipeline | New leads in contacts, pipeline stages | Advance 1+ deal |
| Email open rates | Track outreach responses | Adjust templates |
| Buyer conversations | Sofia conversations from week | Quality / patterns |
| Pending mandates | Developers who need follow-up | Schedule call |

#### TECHNICAL

| Review | What to check | Output |
|--------|--------------|--------|
| TS errors | `pnpm tsc --noEmit` | Must be 0 |
| Test suite | `pnpm vitest run` | Must be 2,222+ pass |
| Cron errors | Vercel logs for cron failures | Fix any failures |
| Performance | Core Web Vitals (Google Search Console) | CLS/LCP/FID targets |

---

### MONTHLY (Last Sunday, 2 hours)

#### DIMENSION 1: DESIGN

**Reviewer:** Carlos (external design audit quarterly)

| Check | Standard | Action if below |
|-------|----------|-----------------|
| Homepage above fold | Communicates value in 3 seconds | Redesign hero |
| Mobile experience | Usable one-handed on iPhone | Fix layout issues |
| Color contrast | WCAG AA (4.5:1 minimum) | Fix failing elements |
| Loading states | All async operations show spinner/skeleton | Add missing states |
| Error states | All errors show user-friendly message | Add missing states |

**Protected elements:** AG Design System tokens. Never change the gold palette (`#D4AF37`), navy, or font stack without full brand review.

---

#### DIMENSION 2: UX

| Check | Standard | Action if below |
|-------|----------|-----------------|
| Property search flow | User finds relevant property < 3 clicks | Simplify flow |
| Contact/lead capture | Form completion > 40% of starters | Reduce fields |
| Sofia engagement | Message response rate > 20% | Improve prompt |
| Navigation clarity | User task success > 80% (observe if possible) | User test |
| Mobile performance | Lighthouse mobile score > 80 | Fix bottlenecks |

---

#### DIMENSION 3: SEO

| Check | Method | Target |
|-------|--------|--------|
| Google Search Console | Search Console (if connected) | Growing impressions |
| Core Web Vitals | PageSpeed Insights | LCP < 2.5s |
| Blog indexation | `site:agencygroup.pt` in Google | All 55 articles indexed |
| Hreflang integrity | No errors in GSC | 0 hreflang errors |
| Schema markup | Rich Results Test | 0 errors |
| Keyword rankings | Track "imóveis portugal", "luxury real estate portugal" | Position movement |

**Improvement targets:**
- Add 1-2 new blog articles per month (target high-volume buyer search queries)
- Internal link audit — ensure property pages link to relevant blog content
- Backlink opportunities — PR/press in target buyer markets (US, UK, FR)

---

#### DIMENSION 4: AI DISCOVERY

| Check | Standard | Action |
|-------|----------|--------|
| Sofia response quality | Sample 5 recent conversations | Improve system prompts if poor |
| AVM accuracy | Compare against recent transactions | Retrain if > 15% error |
| Lead scoring accuracy | Compare predicted vs. actual conversion | Recalibrate tiers |
| Semantic search | Test 5 property queries | Improve embeddings if irrelevant |
| Juridico quality | Test 3 legal scenarios | Improve legal prompts |

---

#### DIMENSION 5: PERFORMANCE

| Metric | Target | Tool |
|--------|--------|------|
| Lighthouse mobile performance | > 80 | PageSpeed Insights |
| Lighthouse desktop performance | > 90 | PageSpeed Insights |
| API P95 response time | < 500ms | Vercel Analytics |
| Sofia response time | < 3s | Manual test |
| Property search response | < 1s | Manual test |
| Bundle size | < 500KB first load JS | Webpack analyzer |

---

#### DIMENSION 6: SECURITY

| Check | Frequency | Standard |
|-------|-----------|----------|
| Dependency audit | Monthly | `pnpm audit` — no high vulnerabilities |
| Auth logs review | Monthly | No suspicious login attempts |
| RLS policy review | Quarterly | No exposed data without auth |
| Rate limiting review | Monthly | No abuse patterns |
| Magic link TTL | Monthly | 15 minutes (never increase) |
| OWASP score maintenance | Quarterly | Maintain 87+ (targeting 95+) |

**Monthly action:** `pnpm audit` — fix any high-severity findings same day.

---

#### DIMENSION 7: ACCESSIBILITY

| Check | Standard | Tool |
|-------|----------|------|
| WCAG AA compliance | 0 errors on key pages | axe DevTools |
| Keyboard navigation | Full site navigable without mouse | Manual test |
| Screen reader compatibility | All interactive elements labeled | NVDA/VoiceOver |
| Color contrast | 4.5:1 minimum everywhere | Contrast checker |
| Focus indicators | Visible on all interactive elements | Manual check |

---

#### DIMENSION 8: DATA QUALITY

| Check | Standard | Action |
|-------|----------|--------|
| Lead scoring accuracy | A+ leads convert at > 2x B leads | Recalibrate if not |
| Email bounce rate | < 5% on outreach | Remove bounced emails |
| Duplicate records | 0 duplicates in contacts | Run dedup query |
| Column accuracy | company_name NOT company, country NOT country_iso | Verify in queries |
| Apollo enrichment freshness | Re-enrich if > 6 months old | Run Apollo quarterly |
| Missing data % | < 20% missing emails in A+ leads | Prioritize enrichment |

---

#### DIMENSION 9: CONTENT

| Check | Target | Action |
|-------|--------|--------|
| Blog publishing | 2+ articles/month | Publish 1 by week 2 |
| Language coverage | All 6 languages growing | Identify language gaps |
| Content freshness | No article > 12 months without update | Update or remove |
| Buyer persona coverage | Content for each buyer segment | Fill gaps |
| Property guide depth | Each zone has 1 comprehensive guide | Create missing guides |
| Market data updates | Prices updated quarterly | Update INE/Banco PT data |

**New content priorities (current gaps):**
- German-language articles (only 0-1 currently, buyers = 5% market)
- Chinese-language guide (buyers = 8% market, 0 ZH articles)
- Azores investment guide (growing market, low competition)
- Commercial real estate content (future segment expansion)

---

#### DIMENSION 10: CONVERSION

| Funnel Stage | Metric | Target | Current |
|-------------|--------|--------|---------|
| Visitor → Lead | Lead capture rate | > 3% | Unknown |
| Lead → Sofia conversation | Engagement rate | > 20% | 0% |
| Sofia → Meeting | Meeting rate | > 10% | 0% |
| Meeting → Offer | Offer rate | > 30% | 0% |
| Offer → CPCV | CPCV rate | > 70% | 0% |
| CPCV → Escritura | Close rate | > 90% | 0% |

**Monthly action:** Track where leads drop off. Fix the worst leak.

---

### QUARTERLY (6 hours — strategic review)

#### DIMENSION 11: CRM QUALITY

| Review | Standard | Action |
|--------|----------|--------|
| Contact lifecycle | Every contact has next action defined | Assign actions |
| Deal stage accuracy | Stages match reality | Update or close |
| Co-agency coverage | Track all partners | Expand to 10+ |
| Response time SLA | First response < 2 hours | Fix if failing |
| CRM completeness | All deals have: value, stage, next action, contact | Fill gaps |

---

#### DIMENSION 12: AI (SOFIA + ALL AI FEATURES)

| Review | Standard | Action |
|--------|----------|--------|
| Sofia conversation quality | NPS-equivalent satisfaction | Improve prompts |
| Role switching accuracy | Correct role 95% of time | Test + fix |
| Tool call accuracy | 0 false tool calls | Audit tool definitions |
| Multi-language quality | Equal quality in all 6 languages | Test each language |
| WhatsApp (once live) | Response rate > 30% | Improve WA prompts |
| AVM accuracy | ±10% of actual transaction prices | Retrain model |

---

#### DIMENSION 13: COMPETITOR ANALYSIS

| Competitor | Check | Action |
|-----------|-------|--------|
| Compass | New feature releases | Implement if advantageous |
| CBRE Portugal | Mandate inventory growth | Accelerate co-agency |
| Knight Frank | Luxury segment moves | Monitor tone/positioning |
| Idealista | SEO position changes | Defend ranking positions |
| New entrants | Monitor new prop-tech launches | Assess threat level |

**Quarterly deliverable:** 1-page competitor status update with top 3 relevant moves.

---

#### DIMENSION 14: MARKET TRENDS

| Data Source | Check | Action |
|-------------|-------|--------|
| INE Portugal | Transaction volumes, prices | Update AVM model |
| Banco de Portugal | Credit conditions, euribor | Update financial content |
| Idealista market report | Price trends by zone | Update pricing pages |
| Knight Frank luxury | HNWI investment trends | Adjust buyer targeting |
| ECB policy | Rate outlook | Update investor content |

---

#### DIMENSION 15: CLIENT FEEDBACK

| Method | Frequency | Action |
|--------|-----------|--------|
| Post-visit survey | After every property showing | Improve presentation |
| Post-CPCV survey | After every CPCV | Improve process |
| Post-escritura NPS | After every closing | Testimonial request |
| Buyer exit interview | For deals that fell through | Fix identified gaps |
| Sofia feedback | Review negative conversation ends | Improve prompts |

---

#### DIMENSION 16: COMMERCIAL KPIs

| KPI | Formula | Quarterly Review |
|-----|---------|-----------------|
| GCI | Commission income before IRS | Track vs. model |
| Deals in pipeline | Count by stage | Ensure 5:1 ratio to target |
| CAC | Cost to acquire client | < €2K target |
| Mandate-to-close rate | Mandates → Deals | > 40% target |
| Co-agency ratio | % deals via co-agency | Track co-agency ROI |
| Data quality index | % leads with email | > 50% target |

---

## IMPROVEMENT VELOCITY TARGETS

| Year | Deals/quarter | GCI/quarter | OWASP | Tests | Blog articles |
|------|--------------|-------------|-------|-------|---------------|
| 2026 Q3-Q4 | 1 | €75K | 87 → 90 | 2222+ | 55 → 65 |
| 2027 Q1-Q2 | 3 | €225K | 90+ | 2500+ | 65 → 80 |
| 2027 Q3-Q4 | 6 | €500K | 90+ | 3000+ | 80 → 100 |
| 2028 | 15/qtr | €1.5M/qtr | 95+ | 4000+ | 100+ |

---

## WHAT "ALWAYS IMPROVE" MEANS IN PRACTICE

Every interaction with the codebase must improve at least one of:
1. Revenue potential (commercial readiness)
2. Security (OWASP score)
3. Performance (speed, reliability)
4. Quality (test coverage, type safety)
5. Content/SEO (indexable value)
6. Data (quality, enrichment)
7. Conversion (lead-to-deal funnel)

It never means:
- Changing something for aesthetics alone
- Adding features nobody uses
- Refactoring working code without improving any of the above
- Removing something that works (without a clear reason)

---

## SUPREME COMMAND COMPLIANCE CHECK

Before any release, answer all 9 questions:

1. Is Agency Group better after this than before? (YES / NO)
2. Does this advance the €1B path? (YES / NO / NEUTRAL)
3. Does this protect existing excellence? (YES / NEED TO CHECK)
4. Does this improve a metric that matters commercially? (WHICH ONE)
5. Is this the highest-value thing I could do right now? (YES / NO)
6. Does this build a compounding asset? (YES / NO)
7. Could a competitor replicate this in < 30 days? (YES = competitive moat, NO = durable advantage)
8. Does this generate or preserve real data? (YES / NO / NA)
9. Is this ready for HNWI first impression? (YES / NEEDS WORK)

If majority NO: do not release. Fix first.

---

*Continuous Improvement System version 1.0 | Agency Group | 2026-06-25*
*Review this system itself: quarterly, or after any major strategic pivot*
