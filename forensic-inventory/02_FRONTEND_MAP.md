# 02 — FRONTEND MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## SUMMARY

| Metric | Count |
|--------|-------|
| Total pages (page.tsx files) | 142 |
| Blog articles | 55 |
| App folder groups | 44 top-level |
| Languages supported | 6 (PT, EN, FR, DE, AR, ZH) |
| Control Tower sub-pages | 29 |
| Dashboard sub-pages | 10 |
| Portal sub-pages | 10 |

---

## PAGE MAP BY SECTION

### PUBLIC MARKETING PAGES

| URL | Purpose | Audience | Auth | Status |
|-----|---------|----------|------|--------|
| / | Homepage — hero, properties, Sofia | All visitors | None | Live |
| /avm | Automated Valuation Model | Sellers/buyers | None | Live |
| /buy-property-portugal | Landing page — buy | Buyers | None | Live |
| /contacto | Contact form | All | None | Live |
| /equipa | Team page | All | None | Live |
| /faq | Frequently Asked Questions | All | None | Live |
| /imprensa | Press page | Media | None | Live |
| /invest-in-portugal-real-estate | EN investor landing | International | None | Live |
| /investir | PT investment page | PT investors | None | Live |
| /off-market | Off-market properties page | Buyers | Auth | Live |
| /off-market-portugal | EN off-market landing | International | None | Live |
| /onboarding | User onboarding | New users | Auth | Live |
| /parceiros | Partners page | Developers/brokers | None | Live |
| /privacy | Privacy policy | All | None | Live |
| /relatorio-2026 | Market report 2026 | Investors | None | Live |
| /reports | Reports listing | All | None | Live |
| /unsupported-browser | Browser compatibility | Legacy users | None | Live |
| /vender | Sell property landing | Sellers | None | Live |
| /vender-imovel-portugal | PT sell guide | PT sellers | None | Live |
| /vendidos | Sold properties | All | None | Live |
| /white-label | White label offer | Partners | None | Live |
| /concierge-estrangeiros | Foreign buyer concierge | Expats | None | Live |
| /casos-de-sucesso | Success cases | All | None | Live |

### PROPERTY PAGES

| URL | Purpose | Data Source | Status |
|-----|---------|-------------|--------|
| /imoveis | Property listing | DB (55 properties) + static | Live, DB FIXED |
| /imoveis/[id] | Property detail | DB | Live |
| /imoveis/premium/[id] | Premium property detail | DB | Live |
| /zonas | Zone listing | Static | Live |
| /zonas/[zona] | Zone detail page | Static + DB | Live |

### BLOG (55 articles)

| URL Pattern | Language | Topic |
|------------|---------|-------|
| /blog | Listing page | — | Live |
| /blog/buying-property-portugal-2026 | EN | Buyer guide |
| /blog/luxury-property-lisbon | EN | Luxury |
| /blog/best-areas-lisbon-expats-2026 | EN | Expat guide |
| /blog/golden-visa-portugal-alternatives-2026 | EN | Visa |
| /blog/nhr-portugal-2026-guide | EN | Tax |
| /blog/american-buyers-guide-portugal-2026 | EN | US buyers |
| /blog/algarve-golden-triangle-2026 | EN | Algarve |
| /blog/lisbon-vs-porto-investment-2026 | EN | Market |
| /blog/comprar-casa-portugal-2026 | PT | Buy guide |
| /blog/mercado-luxo-portugal-2026 | PT | Luxury market |
| /blog/mais-valias-imoveis-portugal-2026 | PT | Tax |
| /blog/nhr-ifici-2026-guia-completo | PT | NHR |
| /blog/investir-imoveis-portugal | PT | Invest |
| /blog/investir-madeira-2026 | PT | Madeira |
| /blog/investir-imoveis-comporta-2026 | PT | Comporta |
| /blog/acores-investimento-imobiliario-2026 | PT | Azores |
| /blog/investir-immobilier-algarve-2026 | FR | Algarve FR |
| /blog/acheter-appartement-lisbonne-guide | FR | Lisbon FR |
| /blog/acheter-maison-cascais-portugal | FR | Cascais FR |
| /blog/vendre-bien-portugal-guide | FR | Sell FR |
| /blog/acheter-villa-algarve-2026 | FR | Algarve FR |
| /blog/acheter-appartement-porto-france | FR | Porto FR |
| /blog/regime-ifici-nhr-france-portugal | FR | Tax FR |
| /blog/comprare-casa-portogallo-guida | IT | Buy IT |
| + 30 more articles | Mix | Various topics |

### AUTH PAGES

| URL | Purpose | Status |
|-----|---------|--------|
| /auth/login | Magic link login | Live |
| /auth/error | Auth error handler | Live |
| /auth/reset-password | Password reset | Live |
| /auth/reset-password/confirm | Confirm reset | Live |

### PORTAL (auth-gated)

| URL | Purpose | Data Source | Status |
|-----|---------|-------------|--------|
| /portal | Portal homepage/redirect | — | Live |
| /portal/login | Portal login | Auth | Live |
| /portal/analytics/adoption | Adoption metrics | API | Live |
| /portal/analytics/financial | Financial analytics | API | Live |
| /portal/analytics/growth | Growth analytics | API | Live |
| /portal/analytics/moat | Moat metrics | API | Live |
| /portal/analytics/performance | Performance | API | Live |
| /portal/analytics/win-loss | Win/loss analysis | API | Live |
| /portal/ops/brand | Brand operations | API | Live |
| /portal/ops/playbooks | Operations playbooks | API | Live |

### DASHBOARD (auth-gated)

| URL | Purpose | Status |
|-----|---------|--------|
| /dashboard | Main dashboard | Live |
| /dashboard/actions | Actions feed | Live |
| /dashboard/conversion-command | Conversion ops | Live |
| /dashboard/daily-brief | Daily briefing | Live |
| /dashboard/executive | Executive view | Live |
| /dashboard/onboarding | Setup wizard | Live |
| /dashboard/properties | Properties management | Live |
| /dashboard/properties/[id] | Property detail | Live |
| /dashboard/properties/new | Add property | Live |
| /dashboard/simulations | What-if scenarios | Live |

### CONTROL TOWER (29 pages — ops only)

| URL | Purpose |
|-----|---------|
| /control-tower | Overview |
| /control-tower/agents | Agent management |
| /control-tower/agents/[agent_id] | Agent detail |
| /control-tower/ai-timeline | AI decision log |
| /control-tower/ceo | CEO view |
| /control-tower/compliance | Compliance status |
| /control-tower/dashboard | Operations dashboard |
| /control-tower/distributed | Distributed systems |
| /control-tower/economics | Financial economics |
| /control-tower/economics/[tenant_id] | Tenant economics |
| /control-tower/events | Event stream |
| /control-tower/events/[event_id] | Event detail |
| /control-tower/forensics | Forensic analysis |
| /control-tower/governance | Governance rules |
| /control-tower/graph | Network graph |
| /control-tower/incidents | Incidents |
| /control-tower/infra | Infrastructure |
| /control-tower/learning | AI learning |
| /control-tower/memory | System memory |
| /control-tower/observability | Observability |
| /control-tower/orchestration | Workflow orchestration |
| /control-tower/queue | Job queue |
| /control-tower/recovery | DR recovery |
| /control-tower/replay | Event replay |
| /control-tower/revenue | Revenue dashboard |
| /control-tower/security | Security ops |
| /control-tower/self-healing | Self-healing |
| /control-tower/settings | Settings |
| /control-tower/tenants | Tenant management |
| /control-tower/workflows | n8n-style workflows |

### MULTILINGUAL PAGES

| URL | Language | Status |
|-----|---------|--------|
| /en | English homepage | Live |
| /en/zones/[zona] | English zone pages | Live |
| /fr | French homepage | Live |
| /de | German homepage | Live |
| /ar | Arabic homepage | Live |
| /zh | Chinese homepage | Live |

### SPECIAL PAGES

| URL | Purpose |
|-----|---------|
| /investor-intelligence | Investor portal |
| /investor-intelligence/success | Post-signup |
| /experience/broker | Broker experience |
| /experience/digest | Digest view |
| /experience/executive | Executive mode |
| /experience/operator | Operator mode |
| /collection/[token] | Share collection |
| /deal/[ref] | Deal detail (public ref) |
| /agente/[slug] | Agent profile page |
| /admin | Admin interface |

---

## VISUAL SYSTEM

| Component | Framework | Status |
|-----------|-----------|--------|
| Design system | Custom (AG Elite) | Live |
| CSS | Tailwind CSS v4 | Live |
| Animations | GSAP 3.14.2 | Live |
| Maps | Leaflet 1.9.4 | Live |
| Dark mode | Full dark mode support | Live |
| PWA | Service worker + VAPID | Live |
| i18n | next-intl v3.25 | Live |
| Fonts | Custom AG Elite typography | Live |

---

## FORMS AND CTAs

| Form | Purpose | Destination |
|------|---------|-------------|
| Sofia chat widget | AI buyer qualification | /api/sofia-agent/chat |
| Contact form /contacto | Lead capture | /api/contacto |
| AVM valuation form | Property valuation | /api/avm |
| Newsletter/email capture | Lead generation | /api/alerts/push |
| Off-market access form | Gated lead capture | /api/auth/offmarket |
| Investor intelligence form | Institutional lead | /api/investor-intelligence |
| Magic link login | Authentication | /api/auth/send |
| Property submission | Seller lead | /api/property-ai/submit |

---

*Evidence: file system scan of app/ directory — 2026-06-11*
