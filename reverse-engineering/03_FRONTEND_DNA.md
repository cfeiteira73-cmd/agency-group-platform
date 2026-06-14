# 03 — FRONTEND DNA
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## TECHNOLOGY STACK

```
Framework:    Next.js 16.2.1 (App Router)
React:        19.2.4
CSS:          Tailwind CSS v4
Animations:   GSAP 3.14.2
State:        Zustand 5.0.12
i18n:         next-intl 3.25.0 (6 languages)
Maps:         Leaflet 1.9.4
Auth:         next-auth ^5.0.0-beta.25
Monitoring:   Sentry 8.x
```

---

## ALL PAGES (142 TOTAL)

### Public Marketing Pages
| Route | Component | Purpose | Forms/CTAs | Status |
|-------|-----------|---------|------------|--------|
| / | app/page.tsx | Homepage — Agency Group | Contact form, AVM widget, Sofia chat | Live |
| /blog | app/blog/page.tsx | Blog index | None | Live |
| /blog/[slug] | app/blog/[slug]/page.tsx | 55 blog articles | None | Live, indexed |
| /imoveis | app/imoveis/page.tsx | Property listings | Search, filter | Live |
| /imoveis/[id] | app/imoveis/[id]/page.tsx | Property detail | Contact, book viewing | Live |
| /avm | app/avm/page.tsx | Free valuation tool | Valuation form | Live |
| /faq | app/faq/page.tsx | FAQ (JSON-LD) | None | Live |
| /juridico | app/juridico/page.tsx | Legal AI assistant | Query form | Live |
| /agente/[slug] | app/agente/[slug]/page.tsx | Agent profile | Contact form | Built, 0 agents |
| /pre-market | app/pre-market/page.tsx | Exclusive listings | Request access | Live |
| /neighborhood/[zone] | app/neighborhood/[zone]/page.tsx | Zone intelligence | None | Live |

### Authentication Pages
| Route | Purpose | Status |
|-------|---------|--------|
| /auth/login | Magic link entry | Active (38 uses) |
| /auth/verify | Email verification | Active |
| /auth/error | Auth errors | Active |
| /auth/logout | Session end | Active |

### Portal Pages (Auth-gated)
| Route | Purpose | Key Components |
|-------|---------|----------------|
| /portal | Portal dashboard | KPI cards, pipeline |
| /portal/contacts | CRM contacts | List, filters, search |
| /portal/deals | Deal pipeline | Kanban board |
| /portal/properties | Property list | Search, sort, filter |
| /portal/matches | AI matches | Score display |
| /portal/capital | Capital profiles | Institutional contacts |
| /portal/analytics | Analytics hub | Charts, funnels |
| /portal/settings | User settings | Profile, prefs |
| /portal/leaderboard | Agent ranking | Empty (0 agents) |
| /portal/deal-packs | Deal pack mgmt | 2 demo packs |

### Dashboard Pages
| Route | Purpose | Data Source |
|-------|---------|-------------|
| /dashboard | Main dashboard | kpi_snapshots |
| /dashboard/pipeline | Revenue pipeline | deals table |
| /dashboard/contacts | Contact overview | contacts table |
| /dashboard/properties | Property KPIs | properties table |
| /dashboard/automation | Automation status | cron logs |
| /dashboard/capital | Capital network | capital_profiles |
| /dashboard/analytics | Analytics view | analytics tables |
| /dashboard/revenue | Revenue tracking | deals + kpi |
| /dashboard/sre | System health | health checks |
| /dashboard/reports | Report center | All tables |

### Control Tower Pages (29)
| Prefix | Count | Purpose |
|--------|-------|---------|
| /control-tower/pipeline | 3 | Pipeline management |
| /control-tower/automation | 4 | n8n/cron monitoring |
| /control-tower/intelligence | 4 | AI/ML monitoring |
| /control-tower/capital | 4 | Capital operations |
| /control-tower/property | 3 | Inventory ops |
| /control-tower/crm | 3 | CRM operations |
| /control-tower/revenue | 4 | Revenue tracking |
| /control-tower/security | 2 | Security center |
| /control-tower/sre | 2 | Infrastructure |

---

## ALL FORMS

| Form | Route | Fields | Action | Working? |
|------|-------|--------|--------|---------|
| Contact form | / | name, email, phone, message | /api/contacto | Yes |
| AVM request | /avm | address, type, area, rooms | /api/avm/estimate | Yes |
| Sofia chat | All pages | text input | /api/sofia-agent/chat | Yes, 0 uses |
| Magic link login | /auth/login | email | /api/auth/send | Yes, 38 uses |
| Property filter | /imoveis | zone, type, price, area | /api/properties/public | Yes |
| Valuation submit | /imoveis/[id] | interest type | /api/contacts | Yes |
| CRM contact create | /portal/contacts | all contact fields | /api/contacts | Yes |
| Deal create | /portal/deals | deal fields | /api/deals | Yes |

---

## ALL CTAs (CALL-TO-ACTION ELEMENTS)

| CTA Text | Location | Action | Conversion Target |
|----------|----------|--------|-------------------|
| "Avaliar Imóvel" | Homepage hero | → /avm | Lead capture |
| "Falar com Sofia" | All pages (widget) | Open Sofia chat | AI qualification |
| "Ver Imóveis" | Homepage | → /imoveis | Property browsing |
| "Entrar em Contacto" | Multiple | Contact form | Lead capture |
| "Aceder ao Portal" | Nav | → /auth/login | Agent login |
| "Solicitar Acesso" | /pre-market | Request form | VIP lead |
| "Agendar Visita" | /imoveis/[id] | Visit form | Showing booking |
| "Calcular Valor" | /avm | AVM form | Seller lead |

---

## ALL MODALS

| Modal | Trigger | Content | Working? |
|-------|---------|---------|---------|
| Sofia chat widget | Float button | AI chat interface | Yes, 0 real uses |
| Property filter | Filter icon | Zone/type/price/area | Yes |
| Contact form | CTA buttons | Name/email/phone | Yes |
| Image gallery | Property photos | Lightbox viewer | Yes |
| Deal detail | Deal click | Deal information | Yes |
| Match detail | Match click | Match score/details | Yes |

---

## SEO IMPLEMENTATION

| Element | Status | Details |
|---------|--------|---------|
| Title tags | ✅ | Dynamic per page |
| Meta descriptions | ✅ | Per page |
| Canonical URLs | ✅ | Configured |
| hreflang | ✅ | 6 languages (PT/EN/FR/DE/ES/IT) |
| x-default hreflang | ✅ | PT default |
| OG images | ✅ | Dynamic (next/og) |
| JSON-LD | ✅ | RealEstateListing + Organization |
| AggregateRating | ✅ | 4.8 stars |
| robots.txt | ✅ | Created |
| sitemap | ✅ | Auto-generated |
| Blog SEO | ✅ | 55 articles, indexed |

---

## LANGUAGE CONFIGURATION (6 languages)

| Lang | Code | Coverage |
|------|------|---------|
| Portuguese | pt | Full |
| English | en | Full |
| French | fr | Full |
| German | de | Partial |
| Spanish | es | Partial |
| Italian | it | Blog only |

---

## DESIGN SYSTEM

```
Color palette: AG design system (custom)
  Primary: Gold (#C9A96E)
  Dark: Obsidian (#0A0A0A)
  Text: White/light gray on dark
  
Typography:
  Font: Custom AG system
  Sizes: Normalized (tailwind-based)
  
Components:
  AG design system (custom, NOT shadcn)
  PortalKPICards — custom design
  Bottom navigation (mobile)
  GSAP animations (hero, page transitions)
  
Responsive:
  Mobile-first
  Bottom sheet filters (mobile)
  BottomNav SVG (mobile)
```

---

## FRONTEND PERFORMANCE

| Metric | Target | Status |
|--------|--------|--------|
| HomeLoader | <400ms | Fixed (was 2800ms) |
| GSAP lazy load | On demand | Fixed |
| React Suspense | Configured | Active |
| next/image | Optimized | Active |
| Code splitting | App Router | Active |
| PWA | Service worker | Configured |
| Push notifications | VAPID | Configured, 0 sent |

---

## UNUSED FRONTEND FEATURES

| Feature | Built | Used | Notes |
|---------|-------|------|-------|
| Agent leaderboard | ✅ | ❌ | 0 agents |
| Agent profile page | ✅ | ❌ | 0 real agents |
| Investor dashboard | ✅ | ❌ | 0 investor logins |
| Partner portal | ✅ | ❌ | Partners table missing |
| Control Tower (29 pages) | ✅ | ❌ | Only Carlos, via portal |
| WhatsApp integration UI | ✅ | ❌ | INACTIVE env var |
| HeyGen video widget | ✅ | ❌ | Never invoked |
| Offline PWA mode | ✅ | ❌ | Configured, untested |

---

*Evidence: app/ directory scan, forensic-inventory/02_FRONTEND_MAP.md, Next.js config*
