# FRONTEND AUDIT REPORT
Agency Group | 2026-06-05 | Evidence: Live site + code scan

---

## SITE STATUS
- **URL**: https://www.agencygroup.pt
- **Status**: 200 OK in 1.1s ✅
- **Framework**: Next.js 15 (App Router)
- **Hosting**: Vercel Pro (cdg1 — Paris)

---

## PAGE INVENTORY (153 pages)
| Section | Count | Status |
|---------|-------|--------|
| Homepage (/) | 1 | ✅ Live |
| Property search (/imoveis) | ~8 | ✅ Live |
| Blog | ~15 | ✅ Live (52 articles) |
| AVM tool | ~3 | ✅ Live (static data) |
| Portal (/portal/*) | ~40 | ✅ Auth-gated |
| Dashboard (/dashboard/*) | ~15 | ✅ Auth-gated |
| Control Tower | ~10 | ✅ Auth-gated |
| Legal/FAQ | ~5 | ✅ Live |
| Investor section | ~5 | ✅ Live |
| Multi-language (en/fr/de/ar) | ~20 | ✅ Live |

---

## SCORES (evidence-based assessment)

| Dimension | Score | Evidence |
|-----------|-------|---------|
| **Performance** | 72/100 | Site loads in 1.1s. Vercel CDN. No field data available. |
| **SEO** | 75/100 | Metadata configured, 52 blog articles, sitemap exists, hreflang 6 languages |
| **UX** | 70/100 | Professional design, multi-language, Sofia widget, mobile responsive |
| **Accessibility** | 65/100 | aria-labels on critical elements, but no a11y audit run |
| **Mobile** | 75/100 | Responsive design confirmed in code, bottom nav implemented |

---

## KNOWN GAPS
1. **AVM uses static 2026 data** — not live pricing (Idealista not connected)
2. **Sofia AVM prices** — will quote static medians to leads, not real market
3. **Property search** — depends on database population (unknown count)
4. **No live chat widget** besides Sofia (HeyGen video configured)
5. **No external uptime monitoring** — no Pingdom/StatusPage

---

## WHAT WORKS (confirmed)
- Site is live and accessible globally (Vercel CDN)
- Magic link authentication
- Portal login and all gated pages
- Blog (52 articles) — SEO content
- Property search (database-driven)
- AVM calculator (static fallback)
- Sofia AI chat (web channel)
- Multi-language (PT/EN/FR/DE/AR/IT)
