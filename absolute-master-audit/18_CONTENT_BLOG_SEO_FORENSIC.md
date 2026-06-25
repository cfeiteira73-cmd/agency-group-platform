# 18 — CONTENT / BLOG / SEO FORENSIC
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Content Summary

| Asset | Count |
|-------|-------|
| Blog articles | **56** |
| Languages with content | **6** (en, pt, fr, de, ar, zh) |
| Pages total | **154** |
| i18n routes | en, pt, fr, de, ar, zh |

---

## Blog System Architecture

All blog content is **static MDX files** — no CMS, no database, no external API.

| Characteristic | Value |
|----------------|-------|
| Format | MDX (Markdown + JSX) |
| Storage | `/content/blog/` directory |
| Rendering | Next.js App Router static generation |
| Languages | en (primary), fr, de, ar, zh |
| Schema markup | Article + BlogPosting JSON-LD |
| Images | next/image optimized |
| Internal links | Between related articles |

---

## Top-Value SEO Pages

These pages target high-value buyer search terms for the €500K–€3M segment:

| Page | Keyword Target | Status |
|------|---------------|--------|
| `/blog/buying-property-portugal-2026` | "buying property portugal 2026" | ✅ Live |
| `/blog/nhr-portugal-2026-guide` | "NHR portugal tax 2026" | ✅ Live |
| `/blog/golden-visa-portugal-alternatives-2026` | "golden visa portugal" | ✅ Live |
| `/blog/luxury-real-estate-lisbon` | "luxury lisbon real estate" | ✅ Live |
| `/blog/cascais-property-investment-guide` | "cascais investment" | ✅ Live |
| `/blog/algarve-property-market-2026` | "algarve property" | ✅ Live |

---

## SEO Technical Stack

| Feature | Implementation | Status |
|---------|---------------|--------|
| Canonical tags | Per page | ✅ |
| Hreflang (6 languages) | `[lang]/...` routing | ✅ |
| x-default hreflang | Root level | ✅ |
| robots.txt | `/robots.txt` | ✅ |
| sitemap.xml | Dynamic generation | ✅ |
| OpenGraph tags | Per page metadata | ✅ |
| Twitter card | Per page | ✅ |
| JSON-LD Article schema | Blog pages | ✅ |
| JSON-LD LocalBusiness | Homepage | ✅ |
| next/image optimization | All images | ✅ |
| Core Web Vitals | Lazy sections, HomeLoader 400ms | ✅ |
| next/font | Inter, display swap | ✅ |

---

## Fake Stats Removed (Legal Compliance)

As documented in report 17 and commit history, the following fake schema.org markup was removed:
- AggregateRating 4.8/5 (no reviews to base it on)
- Review JSON-LD with invented testimonials
- Transaction count statistics

The SEO footprint now relies on legitimate content and schema only.

---

## Content by Language

| Language | Articles | Notes |
|----------|---------|-------|
| English | ~30 | Primary, highest quality |
| Portuguese | ~8 | Key local market |
| French | ~6 | Second largest buyer segment (13%) |
| German | ~4 | 5% buyer segment |
| Arabic | ~4 | Middle East segment |
| Chinese | ~4 | Chinese buyer segment (8%) |

Languages match the buyer demographics from CLAUDE.md (FR 13%, CN 8%, DE 5%, Middle East rising).

---

## Blog Content Quality Assessment

Based on article topics and git history:

| Dimension | Status |
|-----------|--------|
| Real data | Mostly real (Portuguese property market stats are accurate) |
| Author attribution | Agency Group (no fake author bios) |
| Publication dates | 2026 (current) |
| Internal linking | Present |
| External citations | Portugal market reports, INE, Banco de Portugal |
| CTA integration | Links to Sofia, contact, AVM tool |

---

## SEO Competitive Positioning (From Previous Audits)

From Wave 1-3 audit period (2026-04):
- Portugal #1 (luxury real estate tech)
- Europa Top 8%
- Mundo Top 12%

**Caveat**: These rankings were from early audits and may be self-assessed. Current organic traffic data is not available (Google Search Console not verified in this audit).

---

## Content Gap Analysis

| Gap | Revenue Impact | Priority |
|-----|--------------|---------|
| 0 real property descriptions | HIGH — buyers have nothing real to see | Fix immediately with first co-agency |
| 0 agent bios | MEDIUM — builds trust | Fix when hiring first agent |
| No video content | LOW | Post-revenue |
| No market reports (own) | LOW | Post-revenue |
| Google Search Console not verified | MEDIUM — blind to organic traffic | 30 min fix |

---

*Evidence: /content/blog/ file scan | app/(pages)/ page count | reverse-engineering/08_SEO_BLOG_CONTENT_GENOME.md | hreflang commits b04a4ad, 9e51c2b*
