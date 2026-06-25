# 16 — REVENUE SYSTEM FORENSIC
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Revenue Reality

| Metric | Value |
|--------|-------|
| Real revenue | **€0** |
| Real deals | **0** |
| Real buyers | **0** |
| Days live | **62** |
| Commission rate | **5%** |
| First commission target | **€75,000** (on €1.5M property) |

---

## Revenue Machine Architecture

The platform has built a complete revenue machine. It just has no fuel.

```
ACQUISITION → QUALIFICATION → PRESENTATION → OFFER → CLOSE → COMMISSION

Acquisition:
  ├── capital_profiles (7,342 institutional buyers)
  ├── leads (18,042 sourced leads)
  ├── Sofia widget (website)
  └── WhatsApp (inactive)

Qualification:
  ├── Sofia AI (0 conversations)
  ├── AVM valuation tool
  └── CRM pipeline (28 contacts, demo)

Presentation:
  ├── Property listings (55 demo)
  ├── Off-market section
  └── Deal packs (code complete)

Offer → Close:
  ├── Commission calculator
  ├── Mortgage calculator
  ├── Legal templates (Consultor Jurídico AI)
  └── CPCV/Escritura tracking

Commission:
  ├── Deal expected_fee tracking
  ├── IRS withholding (25%) calculation
  └── Pipeline value reporting
```

---

## Deal Tracking System

### deal_packs (API-driven)

| Feature | Status |
|---------|--------|
| Create deal pack | ✅ |
| Property + buyer match | ✅ |
| PDF generation | ✅ (via HeyGen/PDF) |
| Email to buyer | ✅ (via Resend) |
| Deal pack view RPC | ✅ |

### Pipeline Value Calculation

```typescript
// lib/constants/pipeline.ts (corrected commit 8aa4f63)
pipeline_value = sum(deal_value × commission_rate × stage_probability)

// Current state with 8 demo deals:
// ~€9.44M calculated (all demo)
// Real pipeline value: €0
```

### Commission Breakdown

| Stage | Probability | On €1.5M deal |
|-------|------------|---------------|
| Angariação | 10% | €7,500 |
| Proposta Enviada | 20% | €15,000 |
| CPCV Assinado | 70% | €52,500 |
| Escritura Concluída | 100% | €75,000 |

---

## Revenue Path Analysis

### Path 1: Institutional Outreach (Fastest)
```
67 emails → 3 replies → 1 meeting → 1 offer → €75K in 60-90 days
Investment: 90 minutes, €0
```

### Path 2: Developer Co-Agency
```
3 calls → 1 agreement → 1 property → 1 showing → 1 offer → €75K in 60-90 days
Investment: 3 calls, €0
```

### Path 3: n8n Automation Scale
```
Deploy n8n → 3,164 sequences → 150 opens → 15 replies → 5 meetings → 2 offers → €150K in 90-120 days
Investment: 4 hours, €15/month
```

---

## Revenue System Components (All Built)

| Component | Route/File | Status |
|-----------|-----------|--------|
| Commission calculator | `/dashboard/simulations` | ✅ |
| Mortgage calculator | `/api/mortgage` + `/avm` | ✅ |
| AVM valuation | `/api/avm` (Anthropic-powered) | ✅ |
| Deal tracking | `/api/deals` | ✅ |
| Expected fee tracking | `deals.expected_fee` column | ✅ |
| Reporting (daily) | `/api/reporting/daily` | ✅ |
| Revenue loop (3x/day) | `/api/automation/revenue-loop` | ✅ |
| Alerts for hot buyers | `/api/alerts/push` | ✅ Fixed |
| Deal packs | `/api/deal` | ✅ |
| Legal templates | `/dashboard` Jurídico | ✅ |
| Investor intelligence | `/investor-intelligence` | ✅ |
| KPI dashboard | `/dashboard/executive` | ✅ |

---

## What's Missing for Revenue

| Gap | Owner | Time | Cost |
|-----|-------|------|------|
| First email to 67 contacts | Carlos | 90 min | €0 |
| First developer co-agency call | Carlos | 3 calls | €0 |
| WhatsApp activation | Carlos + Code | 3-4 hours | €0 |
| Apollo enrichment | Carlos | 30 min | €49 |
| n8n Railway deployment | Code | 4 hours | €15/mo |
| First real property in DB | Carlos | After co-agency | €0 |

**Total to first deal: ~10 hours of work + €64/month**

---

## Stripe Integration

A Stripe integration exists (`20260417_001_stripe_subscriptions.sql`, env vars `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). This is for potential future subscription/platform-fee revenue, not for the core real estate commission model.

**Status**: Built but not activated (no subscriptions needed for current model).

---

*Evidence: reverse-engineering/16_REVENUE_SYSTEM_FORENSIC (missing from reverse-eng) | commission calculator tests (2222/2222 passing) | pipeline.ts corrected 8aa4f63 | €0 revenue confirmed multiple audits*
