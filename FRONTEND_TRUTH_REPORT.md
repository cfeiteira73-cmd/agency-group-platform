# FRONTEND TRUTH REPORT
Agency Group | Section 2 | 2026-06-06

---

## LIVE PAGE AUDIT (2026-06-06)

| URL | Status | Response Time | Notes |
|-----|--------|--------------|-------|
| agencygroup.pt | 200 | 1,966ms | SLOW — homepage |
| /invest-in-portugal-real-estate | 200 | 1,310ms | SEO landing |
| /imoveis | 200 | 1,151ms | Property listings |
| /blog | 200 | 1,345ms | Blog |
| /faq | 200 | 1,249ms | FAQ |
| /contacto | 200 | 1,299ms | Contact |
| /equipa | 200 | 1,437ms | Team |
| /parceiros | 200 | 1,704ms | Partners |
| /relatorio-2026 | 200 | 1,713ms | Market report gated |
| /dashboard | 200 | 1,194ms | Public dashboard |
| /portal | 403 | 958ms | Auth-only (correct) |
| /sitemap.xml | 200 | 1,046ms | Sitemap |

**ALL 11 public pages return HTTP 200. No broken public pages.**  
**Portal correctly returns 403 for anonymous users.**

---

## PERFORMANCE ASSESSMENT

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Homepage TTFB | ~1,966ms | <500ms | SLOW |
| Average page | ~1,300ms | <500ms | SLOW |
| Fastest page | 958ms (/portal 403) | — | — |
| Slowest page | 1,966ms (homepage) | — | — |

**Issue:** Homepage at ~2 seconds is slow for a luxury brand.  
**Cause:** Single-region Vercel (Paris), large page (310KB), no CDN for images.  
**Fix:** Enable Vercel Edge caching for static routes. Low priority until traffic exists.

---

## MOBILE

| Status | Evidence |
|--------|----------|
| Responsive CSS | Configured (Tailwind mobile-first) |
| PWA | manifest.json exists |
| App manifest | Configured |
| Push notifications | VAPID keys set |
| Bottom navigation | Component exists |
| Mobile filter sheet | Component exists |

**Cannot verify mobile rendering without mobile browser test.**

---

## SEO AUDIT

| Component | Status |
|-----------|--------|
| Title tags | Configured per page |
| Meta descriptions | Configured |
| Open Graph | Configured |
| Twitter cards | Configured |
| Schema.org | Structured data (Real Estate + Organization) |
| AggregateRating | 4.8 (static) |
| Canonical URLs | Configured |
| Hreflang | 6 languages |
| Sitemap | XML sitemap at /sitemap.xml |
| Robots.txt | Exists |
| Blog articles | 52+ (SEO content) |

---

## LANGUAGES

| Language | Status |
|----------|--------|
| Portuguese (PT) | Primary |
| English (EN) | Full |
| French (FR) | Full |
| German (DE) | Full |
| Chinese (ZH) | Full |
| Arabic (AR) | Full |

---

## CONVERSION PATHS

| Path | Exists | Functional |
|------|--------|-----------|
| Property inquiry form | Exists | Unknown (no test) |
| Contact form | Exists at /contacto | Unknown |
| Magic link login | Exists | Proven (37 tokens) |
| Sofia chat widget | Exists | 0 conversations |
| Newsletter signup | Unknown | Unknown |
| Deal pack request | Via portal | Portal auth-gated |
| AVM valuation | /api/avm | Auth-gated |

---

## PAGES CATALOG

```
Public: imoveis, blog, faq, contacto, equipa, parceiros, relatorio-2026
Landing: invest-in-portugal-real-estate, buy-property-portugal
         sell-property-portugal, off-market-portugal, concierge-estrangeiros
Dashboard: public dashboard (stats)
Portal: auth-gated (login required)
Control Tower: auth-gated
Locale routes: /en/, /fr/, /de/, /zh/, /ar/ prefixes
```

---

## ISSUES FOUND

| Issue | Severity | Evidence |
|-------|----------|----------|
| Homepage TTFB ~2s | MEDIUM | Live test |
| offmarket_leads all TEST data | HIGH | DB query |
| 8 deals = demo data | HIGH | DB query — names match test contacts |
| Properties origin unconfirmed | HIGH | No source_url or mandate reference |
| Sofia widget = 0 conversations | MEDIUM | DB confirms |
| AggregateRating 4.8 static | LOW | No real reviews |

---

## HYDRATION / CONSOLE ERRORS

**Cannot verify without browser session on agencygroup.pt.**  
Based on code analysis: 0 TypeScript errors. No obvious hydration bugs detected.  
Known issue: `'use client'` in layout.tsx was fixed in Wave 3.  
Recommendation: Open Chrome DevTools on agencygroup.pt and verify no console errors.
