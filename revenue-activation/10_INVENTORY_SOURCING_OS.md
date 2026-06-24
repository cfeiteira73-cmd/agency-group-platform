# Phase 10 — Inventory Sourcing Operating System
**Date:** 2026-06-24  
**Status:** ✅ SYSTEM READY — CARLOS OUTREACH NEEDED

## Current Inventory System Status
- Agency Group can handle **10 mandates TODAY** without code changes
- Portal inventory section: ✅ Implemented
- Off-market leads system: ✅ Live (`offmarket_leads` table)
- Score engine: ✅ Cron at 7:00 UTC weekdays
- AVM (Automated Valuation): ✅ Running

## Inventory Connector Leads — Ready to Call
**File:** `exports/revenue-activation/INVENTORY_CONNECTORS_PORTUGAL.csv`  
**Rows:** 142 leads (architects, developers, lawyers, brokers in PT/ES)

### Top Personas for Mandate Sourcing
| Persona | Strategy |
|---------|---------|
| Architect | "Working with client who wants turnkey project in Lisbon — do you know anyone selling?" |
| Real Estate Lawyer | "Looking for pre-probate/estate sale mandates in Cascais/Lisboa" |
| Property Developer | "Interested in exclusivity on units before launch — contact your pipeline?" |
| Local Broker | "Co-agency opportunity — 50% split on any deal you bring us" |

## Mandate Sourcing Playbook (10 Mandates in 30 Days)

### Day 1-3: Warm Network
1. List every property owner Carlos knows personally
2. WhatsApp each: "Tens algo para vender nos próximos 12 meses?"
3. Target: €500K–€3M, Lisbon/Cascais/Algarve/Porto/Madeira

### Day 4-7: Cold LinkedIn to Inventory Connectors
1. Open `INVENTORY_CONNECTORS_PORTUGAL.csv`
2. Connect to top 50 (score > 50) on LinkedIn
3. Message script (after connect):
   > "Olá [Name], somos Agency Group (AMI 22506) — especializados em imóveis premium €500K-€3M. 
   > Tenho compradores ativos a procurar imóveis em Lisboa/Cascais. 
   > Têm mandatos disponíveis para parceria? Partilhamos comissão 50/50."

### Day 8-14: Cold Call Campaign
1. Use phone numbers from `INVENTORY_CONNECTORS_PORTUGAL.csv`
2. Target: lawyers, notaries, architects
3. Script: "Tenho comprador norte-americano com orçamento €1M+ a procurar imóvel em Lisboa..."
4. Goal: 5 calls/day = 35 calls = 3-5 leads

### Week 2-3: Real Estate Lawyers / Notaries
- Estate sales, divorce, inheritance — all generate forced sellers
- Top cities: Lisboa, Cascais, Sintra, Porto, Algarve
- Message: "Parceria para mandatos de venda urgente — comissão partilhada"

## Current Mandate Target (Realistic)
| Type | Target Count | Timeline |
|------|-------------|---------|
| Warm network | 2-3 | Week 1 |
| Cold connector outreach | 3-5 | Week 2-3 |
| Lawyer/notary referrals | 2-3 | Month 1 |
| **Total** | **7-11** | 30 days |

## Off-Market Pipeline (Already Coded)
The `offmarket_leads` table is connected to:
- `/api/offmarket-leads/score` — daily scoring (cron active)
- `/api/offmarket-leads/[id]/deal-eval` — deal evaluation
- `/api/offmarket-leads/[id]/call-script` — call script generator

Carlos can add properties directly via the portal without any code work.

## Key Properties to Target First
- **Lisbon prime**: Chiado, Príncipe Real, Avenida da Liberdade, Campo de Ourique
- **Cascais**: town center, Birre, Estoril
- **Algarve**: Quinta do Lago, Vale do Lobo, Lagos
- **Porto**: Foz do Douro, Bonfim renovation plays

## Verdict
Inventory system is operational. 10 mandates in 30 days is achievable with 5 calls/day + LinkedIn outreach. **No code needed.**
