# CAPITAL NETWORK REPORT
Agency Group | Wave 60 | Evidence: DB migrations + route analysis

---

## BUYER DATABASE STATUS

### Tables in production (pre-Wave-47 — status unknown without live DB access)
| Table | Migration | Purpose |
|-------|-----------|---------|
| contacts | 001_initial_schema.sql | Primary CRM — buyers/sellers/agents |
| investor_capital_profiles | 000075_capital_intel.sql | Investor capital data |
| investor_segment_profiles | 000058_growth_graph.sql | Investor segmentation |
| investor_kyc_records | 000055_compliance.sql | KYC verification |

### Tables in new system (Wave 54) — EMPTY
| Table | Migration | Purpose |
|-------|-----------|---------|
| capital_profiles | 000151 | Structured buyer/investor profiles (6-dimension matching) |
| asset_opportunities | 000151 | Investment assets for matching |
| capital_matches | 000151 | Match results |

---

## BUYER CATEGORIZATION (from code)

```typescript
// lib/matching/capitalMatchingEngine.ts
export type CapitalProfile = {
  type: 'BUYER' | 'INVESTOR' | 'FAMILY_OFFICE' | 'DEVELOPER' | 'CONNECTOR' | 'FUND'
  budget_min_eur: number
  budget_max_eur: number
  preferred_locations: string[]
  preferred_asset_types: string[]  // RESIDENTIAL | COMMERCIAL | LAND | PORTFOLIO | DEVELOPMENT | NPL
  risk_tolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  target_yield_min_pct: number
  target_yield_max_pct: number
  investment_horizon_months: number
  kyc_status: 'PENDING' | 'APPROVED' | 'REJECTED'
}
```

---

## FAMILY OFFICE / CONNECTOR INFRASTRUCTURE

### Acquisition Sources Built (12 sources in code)
| Source | Country | Type | Status |
|--------|---------|------|--------|
| Citius (judicial auctions) | PT | AUCTION/SCRAPER | ✅ CODE READY — needs activation |
| e-Leilões | PT | AUCTION | ✅ CODE READY |
| SOLVI-T (insolvencies) | PT | INSOLVENCY | ✅ CODE READY |
| BCP Imóveis | PT | BANK_REO | ✅ CODE READY |
| CGD Imóveis | PT | BANK_REO | ✅ CODE READY |
| Novo Banco/Oxy | PT | NPL_PORTFOLIO | ✅ CODE READY |
| Servilusa | PT | SERVICER | ✅ CODE READY |
| BOE Subastas | ES | AUCTION | ✅ CODE READY |
| Servihabitat (CaixaBank) | ES | SERVICER | ✅ CODE READY |
| Altamira (Santander) | ES | SERVICER | ✅ CODE READY |
| Family Office Network EMEA | MULTI | FAMILY_OFFICE | ⚠️ PENDING_APPROVAL |
| Developer Direct Network | MULTI | DEVELOPER | ✅ CODE READY |

---

## INVESTOR MATCHING ROUTES

| Route | Purpose | Cron? |
|-------|---------|-------|
| /api/buyers/score | Score buyer profiles | ✅ Daily 06:15 |
| /api/automation/investor-alert | Investor opportunity alerts | ✅ Daily 08:30 |
| /api/automation/match-buyer | Buyer-property matching | On-demand |
| /api/buyer-intelligence/profile | Buyer profile enrichment | On-demand |
| /api/investors/* (12 routes) | Investor management | On-demand |
| /api/matching/capital | Capital matching engine | On-demand |
| /api/institutional-partners | Partner management | On-demand |

---

## CAPITAL COVERAGE ANALYSIS

### Geographic coverage (built into matching engine)
```
Portugal: Lisboa, Cascais, Algarve, Porto, Madeira, Açores, Sintra, Oeiras, Setúbal, Braga
Spain: Madrid, Barcelona, Valencia, Andalucia
```

### Asset type coverage
```
RESIDENTIAL (primary), COMMERCIAL, LAND, PORTFOLIO, DEVELOPMENT, NPL
```

### Ticket size coverage
```
Minimum: €30,000 (e-Leilões threshold in code)
Maximum: Unlimited (family office / institutional)
Primary sweet spot: €100K–€5M (5% commission model)
```

---

## HONEST ASSESSMENT

**What exists**: Complete infrastructure for buyer/investor management, matching, sourcing, and capital routing.

**What doesn't exist**: Any real data in the new tables. The pre-Wave-47 contacts/deals tables may have data, but the new capital infrastructure tables are empty.

**Critical action**: Migrate existing buyer contacts into `capital_profiles` table to activate the matching engine immediately.
