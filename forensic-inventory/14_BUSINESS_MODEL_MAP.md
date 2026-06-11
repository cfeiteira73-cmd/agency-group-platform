# 14 — BUSINESS MODEL MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## CURRENT STATE

| Metric | Value |
|--------|-------|
| Revenue (2026 to date) | €0 |
| Deals closed | 0 (real) |
| Commission earned | €0 |
| Active mandates | 0 verified |

---

## REVENUE MODEL

### Primary: Transaction Commissions

| Segment | Typical Price | Commission (5%) | Gross Per Deal |
|---------|--------------|----------------|----------------|
| Residential €100K-€500K | €300K avg | 5% | €15,000 |
| Mainstream luxury €500K-€2M | €1.2M avg | 5% | €60,000 |
| Prime luxury €2M-€5M | €3M avg | 5% | €150,000 |
| Ultra luxury €5M-€10M | €7M avg | 5% | €350,000 |
| Institutional €10M+ | €20M avg | 3-5% | €600,000+ |

### Commission Split Structure

| Scenario | Split | Agency Keeps |
|----------|-------|-------------|
| Sole agency | 100/0 | 5% of deal |
| Co-agency (buy side) | 50/50 | 2.5% of deal |
| Co-agency (sell side) | 50/50 | 2.5% of deal |
| Exclusive developer | 100/0 | 5% of deal |
| Partner closed | Varies | 1.5-3% |

### Payment Timing (Portuguese law)
- 50% at CPCV (Contrato Promessa Compra e Venda)
- 50% at Escritura (final deed)

---

## CUSTOMER TYPES

### Buyers (Demand Side)

| Type | Budget | Count in CRM |
|------|--------|-------------|
| American HNWI | €1M-€5M | ~3,010 |
| British family | €800K-€3M | ~882 |
| French investor | €500K-€2M | ~748 |
| Middle East | €2M-€20M | ~504 |
| Family Office | €5M-€100M | ~1,701 |
| Fund / Institutional | €10M-€500M | ~900 |
| Wealth Manager (client) | €500K-€5M | ~1,470 |
| Domestic Portuguese | €150K-€500K | ~260 |
| Brazilian | €200K-€800K | ~220 |

### Sellers (Supply Side)

| Type | Typical Asset | Commission Source |
|------|--------------|------------------|
| Developer | New build units | Buy side 5% |
| Private seller | €500K-€5M villa | Both sides |
| Bank / NPL portfolio | Distressed | Both sides |
| Fund exit | €5M+ commercial | Negotiated |
| Foreign seller | Investment property | Full 5% |

### Partners (Distribution)

| Type | Revenue Model | Status |
|------|--------------|--------|
| Co-agency broker | Split commission | 0 active |
| Developer (co-sell) | Exclusive agreement | 0 active |
| Wealth manager (intro) | 0.5-1% referral | 0 active |
| Lawyer (intro) | Fixed fee | 0 active |

---

## GEOGRAPHIC REVENUE MODEL

| Geography | Median Price | Target Segment | Annual Target |
|-----------|------------|----------------|--------------|
| Lisbon (prime) | €5,000/m² | HNWI, expat | €2M+ deals |
| Cascais | €4,713/m² | British, French | €1.5M+ deals |
| Algarve | €3,941/m² | North American | €1.5M+ deals |
| Porto | €3,643/m² | Investment | €500K+ deals |
| Madeira | €3,760/m² | Digital nomad | €300K+ deals |
| Azores | €1,952/m² | Lifestyle | €150K+ deals |

---

## ADDITIONAL REVENUE STREAMS (CONFIGURED, NOT ACTIVE)

### Stripe Integration
- Configured: Stripe ^22.0.2 + stripe-js
- Routes: /api/stripe/checkout, /api/stripe/portal, /api/stripe/webhook
- Current use: None
- Potential: SaaS licensing, premium data subscriptions

### White Label (configured)
- Page: /white-label
- Pitch: License the Agency Group technology to other real estate agencies
- Revenue: Monthly license fee
- Status: Page live, no clients

### Data Intelligence Subscriptions
- Market intelligence reports (/relatorio-2026)
- Institutional data feeds
- Status: Content live, no subscription model active

### Concierge Services
- Page: /concierge-estrangeiros
- Potential: Premium service for foreign buyers
- Status: Page live, no active cases

---

## REVENUE FORECASTS

### Scenario 1: Conservative (90-day activation)
```
Q3 2026: €0 (activation phase)
Q4 2026: €75,000 (1 deal at €1.5M)
2027 H1: €300,000 (4 deals)
2027 H2: €450,000 (6 deals)
2027 Total: €750,000
```

### Scenario 2: Base Case (12 months)
```
2026: €150,000 (2 deals)
2027: €750,000 (10 deals, mix)
2028: €1.5M (15 deals + agent network)
```

### Scenario 3: Scale Case (3 years)
```
2026: €150,000
2027: €1.2M
2028: €3M
2029: €6M (white label + 5+ agents)
```

---

## UNIT ECONOMICS

| Metric | Target |
|--------|--------|
| Customer acquisition cost | €500-€2,000 (outreach-driven) |
| Time to first contact reply | 14 days |
| Contact to visit rate | 15% |
| Visit to offer rate | 40% |
| Offer to close rate | 70% |
| Overall conversion: CRM to deal | ~0.5-1% |
| Revenue per deal | €75,000 avg (conservative) |
| Deals needed for €1M | ~13 |

---

*Evidence: business model analysis, CLAUDE.md market data, code analysis — 2026-06-11*
