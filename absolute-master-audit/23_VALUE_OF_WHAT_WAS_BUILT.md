# 23 — VALUE OF WHAT WAS BUILT
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Rebuild Cost Estimate

If Agency Group had to rebuild this platform from scratch with external developers:

| Layer | LOC | Days | Rate | Cost |
|-------|-----|------|------|------|
| Next.js frontend (154 pages) | ~200K | 90 | €800/day | €72,000 |
| API layer (542 routes) | ~150K | 60 | €800/day | €48,000 |
| Sofia AI (7 roles, 8 tools) | ~30K | 30 | €1,000/day | €30,000 |
| Database + migrations (278) | N/A | 20 | €800/day | €16,000 |
| n8n workflows (21) | N/A | 15 | €800/day | €12,000 |
| Security hardening (OWASP 87) | N/A | 20 | €800/day | €16,000 |
| Blog content (56 articles, 6 languages) | N/A | 30 | €500/day | €15,000 |
| DevOps + Vercel setup | N/A | 10 | €800/day | €8,000 |
| Testing (2,222 tests) | ~20K | 20 | €800/day | €16,000 |
| CRM + Lead Engine | ~50K | 30 | €800/day | €24,000 |
| **Total** | **~452K LOC** | **~325 days** | | **~€257,000** |

**With agency markup (typical 2x)**: **~€514,000**

**Actual cost** (Claude API + Carlos time): Estimated **€3,000–€8,000** in AI API costs + 500 hours of Carlos's time.

**Value multiplier**: **~65x** (€514K of code for ~€8K in API costs)

---

## What Was Built — Functional Inventory

### Platform Infrastructure
- Complete Next.js 16 App Router application
- 154 pages, 542 API routes
- TypeScript strict mode, 0 errors
- Vercel deployment with 41 crons
- OWASP 87/100 security

### AI Stack
- Sofia AI agent (7 roles, 8 tools, 4 channels)
- AVM property valuation (Anthropic-powered)
- Consultor Jurídico (10 legal areas)
- Computer vision photo scoring
- Semantic property search (pgvector)
- Deal pack AI generation

### Data Infrastructure
- 18,042 lead profiles (Lead Engine)
- 7,342 capital profiles (institutional buyers)
- 3,164 outreach queue entries
- 278 migrations
- Full CRM pipeline code (contacts, deals, profiles)
- Commission calculator with IRS calculation
- KPI snapshot system (62+ data points)

### Automation Infrastructure
- 21 n8n workflows (configured, not deployed)
- Apollo enrichment workflow
- Investor alert system
- Lead nurture sequences
- Daily digest for Carlos

### Content
- 56 blog articles (6 languages)
- SEO-optimized pages targeting €500K–€3M buyers
- Portuguese, French, German, Arabic, Chinese routes

### Legal & Compliance
- GDPR Art.17+20 (purge cron, export API)
- Privacy policy, terms
- Cookie consent
- AMI 22506 registered

---

## What This Represents Strategically

The platform was built to handle:
- **Volume**: Hundreds of buyer inquiries simultaneously (Sofia + WhatsApp)
- **Qualification**: Automatic scoring and segmentation
- **Speed**: First response in <2 seconds (Sofia)
- **Scale**: 7,342 institutional contacts ready to contact
- **Intelligence**: Match buyer profile to property automatically
- **Geography**: EN/PT/FR/DE/AR/ZH buyer coverage

This is not a brochure website. It is a **revenue engine that hasn't been turned on**.

---

## What's NOT Built (Actual Gaps)

| Not built | Impact | Required |
|-----------|--------|---------|
| Real mandate (1 property) | HIGH — nothing to sell | Co-agency call |
| Real CRM contact (beyond 1) | HIGH — no buyers in system | Use the 67 emails |
| WhatsApp activated | MEDIUM — missing inbound channel | 3-4 hours |
| n8n deployed | MEDIUM — missing automation scale | 4 hours |

---

## The Paradox

€250K+ of software was built to automate a business that hasn't signed its first deal yet.

The technology bottleneck was solved first. The commercial bottleneck (deals, mandates, relationships) was never started.

The platform is a **force multiplier** waiting for force to be applied.

---

*Evidence: Repository file counts | LOC from 02_REPOSITORY_FORENSIC_INVENTORY.md | reverse-engineering/07_FINANCIAL_VALUE.md | industry development rates*
