# 03 — FRONTEND FORENSIC MAP
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Summary

| Metric | Count |
|--------|-------|
| Total pages (page.tsx) | **154** |
| Layouts (layout.tsx) | **9** |
| Blog articles | **56** |
| Supported languages | **6** (en, pt, fr, de, ar, zh) |
| Control tower pages | **~25** |
| Dashboard pages | **~10** |
| Portal pages | **~8** |
| Public marketing pages | **~15** |

---

## Page Classification

### Public Marketing (Production-Grade)

| Route | Purpose | Data Source | Commercial Grade |
|-------|---------|-------------|-----------------|
| `/` | Homepage | Static + Sofia widget | ✅ Production |
| `/imoveis` | Property listings | DB (properties table) | ✅ |
| `/imoveis/[id]` | Property detail | DB | ✅ |
| `/imoveis/premium/[id]` | Premium listings | DB | ✅ |
| `/blog` | Blog index | Static slugs | ✅ |
| `/blog/[slug]` | Blog article (56 articles) | MDX/static | ✅ |
| `/avm` | Property valuation tool | AI (Anthropic) | ✅ |
| `/zonas` | Zone guide | Static | ✅ |
| `/zonas/[zona]` | Zone detail | Static | ✅ |
| `/invest-in-portugal-real-estate` | EN investor page | Static | ✅ |
| `/buy-property-portugal` | EN buyer page | Static | ✅ |
| `/vender` | Seller guide | Static | ✅ |
| `/vender-imovel-portugal` | Sell property page | Static | ✅ |
| `/investir` | Investment guide | Static | ✅ |
| `/contacto` | Contact form | Resend | ✅ |
| `/off-market` | Off-market properties | DB | ✅ |
| `/off-market-portugal` | Off-market EN | DB | ✅ |
| `/faq` | FAQ | Static | ✅ |
| `/equipa` | Team page | Static | ✅ |
| `/parceiros` | Partners | Static | ✅ |
| `/privacy` | Privacy policy | Static | ✅ |
| `/concierge-estrangeiros` | Foreign buyer concierge | Static | ✅ |
| `/casos-de-sucesso` | Success cases | Static/Demo | ⚠️ Demo data |
| `/imprensa` | Press | Static | ✅ |
| `/vendidos` | Sold properties | DB | ✅ |
| `/relatorio-2026` | Market report | Static | ✅ |

### Multilingual Routes

| Route | Language | Status |
|-------|---------|--------|
| `/en` | English | ✅ |
| `/en/zones/[zona]` | English zones | ✅ |
| `/fr` | French | ✅ |
| `/de` | German | ✅ |
| `/ar` | Arabic | ✅ |
| `/zh` | Chinese | ✅ |

Note: Full internationalization via `messages/` folder (next-intl). 6 languages.

### Blog Articles (56 Named Slugs)

Languages: PT, EN, FR, IT, DE (mixed)

Key high-value SEO articles:
- `buying-property-portugal-2026`
- `nhr-portugal-2026-guide`
- `golden-visa-portugal-alternatives-2026`
- `lisbon-vs-porto-investment-2026`
- `luxury-villas-algarve-2026`
- `american-buyers-guide-portugal-2026`
- `acheter-appartement-lisbonne-guide` (FR)
- `comprare-casa-portogallo-guida` (IT)

### Auth Pages

| Route | Purpose | Status |
|-------|---------|--------|
| `/auth/login` | Magic link login | ✅ Fully operational |
| `/auth/error` | Auth error display | ✅ |
| `/auth/reset-password` | Password reset | ✅ |
| `/auth/reset-password/confirm` | Reset confirm | ✅ |

### Portal (Protected)

| Route | Purpose | Data Status |
|-------|---------|------------|
| `/portal` | Portal home | ✅ Real data (28 contacts) |
| `/portal/login` | Portal login | ✅ |
| `/portal/analytics/adoption` | Adoption analytics | ⚠️ Near-zero real data |
| `/portal/analytics/financial` | Financial analytics | ⚠️ 8 deals (demo) |
| `/portal/analytics/growth` | Growth analytics | ⚠️ Near-zero |
| `/portal/analytics/moat` | Competitive moat | ⚠️ Near-zero |
| `/portal/analytics/performance` | Performance | ⚠️ Near-zero |
| `/portal/analytics/win-loss` | Win/loss analysis | ⚠️ Near-zero |
| `/portal/ops/brand` | Brand ops | ✅ Static |
| `/portal/ops/playbooks` | Playbooks | ✅ Static |

### Dashboard (Protected)

| Route | Purpose | Status |
|-------|---------|--------|
| `/dashboard` | Main dashboard | ✅ Operational |
| `/dashboard/actions` | Action items | ✅ |
| `/dashboard/daily-brief` | AI daily brief | ✅ Uses AI |
| `/dashboard/executive` | Executive view | ✅ |
| `/dashboard/onboarding` | Onboarding | ✅ |
| `/dashboard/properties` | Property management | ✅ |
| `/dashboard/properties/[id]` | Property detail | ✅ |
| `/dashboard/properties/new` | Add property | ✅ |
| `/dashboard/simulations` | Financial simulations | ✅ |
| `/dashboard/conversion-command` | Conversion center | ✅ |

### Control Tower (Protected, 25 pages)

| Route | Purpose |
|-------|---------|
| `/control-tower` | Main control tower |
| `/control-tower/agents` | AI agents list |
| `/control-tower/agents/[agent_id]` | Agent detail |
| `/control-tower/ai-timeline` | AI activity timeline |
| `/control-tower/ceo` | CEO dashboard |
| `/control-tower/compliance` | Compliance monitoring |
| `/control-tower/dashboard` | System dashboard |
| `/control-tower/distributed` | Distributed systems |
| `/control-tower/economics` | Economics |
| `/control-tower/economics/[tenant_id]` | Tenant economics |
| `/control-tower/events` | Event stream |
| `/control-tower/events/[event_id]` | Event detail |
| `/control-tower/forensics` | System forensics |
| `/control-tower/governance` | Governance |
| `/control-tower/graph` | System graph |
| `/control-tower/incidents` | Incident management |
| `/control-tower/infra` | Infrastructure |
| `/control-tower/learning` | ML learning |
| `/control-tower/memory` | AI memory |
| `/control-tower/observability` | Observability |
| `/control-tower/orchestration` | Workflow orchestration |
| `/control-tower/queue` | Job queue |
| `/control-tower/recovery` | Disaster recovery |
| `/control-tower/replay` | Event replay |
| `/control-tower/revenue` | Revenue tracking |
| `/control-tower/security` | Security center |
| `/control-tower/self-healing` | Self-healing |
| `/control-tower/settings` | Settings |
| `/control-tower/tenants` | Tenant management |
| `/control-tower/workflows` | Workflow management |

### Other Pages

| Route | Purpose | Status |
|-------|---------|--------|
| `/deal/[ref]` | Deal reference page | ✅ |
| `/collection/[token]` | Saved property collection | ✅ |
| `/agente/[slug]` | Agent profile | ✅ (0 real agents) |
| `/experience` | Experience selector | ✅ |
| `/experience/broker` | Broker experience | ✅ |
| `/experience/digest` | Digest view | ✅ |
| `/experience/executive` | Executive experience | ✅ |
| `/investor-intelligence` | Investor intel | ✅ |
| `/investor-intelligence/success` | Success state | ✅ |
| `/onboarding` | User onboarding | ✅ |
| `/reports` | Reports page | ✅ |
| `/white-label` | White-label info | ✅ |
| `/admin` | Admin panel | ✅ (auth protected) |
| `/unsupported-browser` | Browser error | ✅ |

---

## SEO/Technical Observations

- **hreflang**: Implemented for 6 languages (x-default included)
- **Canonical**: Implemented per-page
- **Schema.org**: AggregateRating, Organization, RealEstateListing schemas present
- **Sitemap**: Present (auto-generated by Next.js)
- **robots.txt**: Present
- **OG images**: Dynamic via next/og
- **PWA**: Service worker + manifest in `public/`
- **Performance**: LazySection, OptimizedImage patterns used

---

## Data Reality Check

| Page Category | Real Data? | Notes |
|---------------|-----------|-------|
| Blog articles | ✅ Static content (real) | 56 articles published |
| Property listings | ✅ DB (55 seeded) | All 55 are DEMO/SEED data |
| Portal analytics | ⚠️ Near-zero | 28 contacts, 8 deals only |
| Agent profiles | ❌ 0 real agents | Template only |
| AVM | ✅ AI-powered | Real Anthropic API |
| Sofia widget | ✅ Code works | 0 real buyer conversations |

---

*Evidence: Get-ChildItem app -Recurse -Filter "page.tsx" (154 files) | git log 472a95e | 2026-06-25*
