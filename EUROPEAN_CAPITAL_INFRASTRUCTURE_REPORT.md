# Agency Group — European Real Estate Capital Infrastructure
## Wave 41 — Full Gap Closure System

---

### System Status

```
SYSTEM_STATUS: REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE
```

Platform: Next.js 15 · TypeScript strict · Supabase PostgreSQL · AWS ECS Fargate
Regulatory: MiFID II · AML 6AMLD · GDPR · SOC2 · ISO27001 · DORA
Markets: Portugal · Espanha · Madeira · Açores
Segment: €100K–€100M · Core €500K–€3M · Commission 5%

---

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                   LAYER 5 — REGULATORY COMPLIANCE                  │
│     MiFID II · AML 6AMLD · GDPR · SOC2 · ISO27001 · DORA          │
├────────────────────────────────────────────────────────────────────┤
│                   LAYER 4 — VALIDATION GATES                        │
│   5 Blocking Gates · Production Readiness Reports · Test Suite      │
├────────────────────────────────────────────────────────────────────┤
│                   LAYER 3 — EXTERNAL MARKET SYNC                    │
│     INE · Banco de Portugal · Confidencial Imobiliário · APIs       │
├────────────────────────────────────────────────────────────────────┤
│                   LAYER 2 — LEGAL EXECUTION ENGINE                  │
│    CPCV · Escritura · IMT · Stamp Duty · Land Registry · eIDAS      │
├────────────────────────────────────────────────────────────────────┤
│                   LAYER 1 — CAPITAL EXECUTION PIPELINE              │
│  INVESTOR_BANK → PSP → ESCROW → LEGAL → NOTARY → REGISTRY → SETTLE │
└────────────────────────────────────────────────────────────────────┘
```

---

### Gap Closure Engine

The `GapClosureOrchestrator` (`lib/gap-closure/`) audits the full capital infrastructure for missing data, stale state, and misaligned records. It runs on a scheduled cadence (every 4 hours via Vercel Cron) and closes gaps in:

- **Capital Pipelines**: detects incomplete pipeline stages and triggers retry
- **Legal Workflow Stalls**: identifies workflows stuck in ACTIVE state > 48h and escalates
- **ML Drift**: detects drift_score > 0.15 and triggers auto-retraining queue
- **Compliance Gaps**: monitors compliance_reports.overall_score_pct < 60 and flags for review
- **Audit Trail Gaps**: identifies missing regulatory_audit_trail entries and backfills
- **External Data Staleness**: flags external_price_benchmarks older than 7 days for refresh

Gap closure results are persisted to `gap_closure_reports` with full evidence trail.

---

### Real Capital Execution Pipeline

```
INVESTOR_BANK → PSP → ESCROW → LEGAL → NOTARY → LAND_REGISTRY → SETTLEMENT → CONFIRMATION
```

| Stage | Description | Table |
|---|---|---|
| INVESTOR_BANK | Investor wire transfer initiated from institutional bank | `psp_payment_intents` |
| PSP | Payment Service Provider processes and validates funds | `capital_execution_pipelines` |
| ESCROW | Funds held in regulated escrow account pending legal completion | `capital_execution_pipelines` |
| LEGAL | CPCV executed, IMT/Stamp Duty calculated and verified | `legal_workflows` |
| NOTARY | Escritura Pública signed before licensed notary, eIDAS digital signature | `notary_appointments`, `eidas_signature_requests` |
| LAND_REGISTRY | Registo Predial updated — ownership transfer official | `legal_workflows` |
| SETTLEMENT | Funds released from escrow to seller net of taxes and fees | `capital_execution_pipelines` |
| CONFIRMATION | Deal closure confirmed, investor capital account updated | `capital_reality_checks` |

Every stage emits an immutable audit event to `regulatory_audit_trail` with SHA-256 hash chain integrity.

---

### Legal Execution Layer

Portuguese real estate law requires a precise sequence:

**CPCV (Contrato Promessa Compra e Venda)**
- Binding promise-to-purchase contract
- Typically 10–20% deposit
- Protected under Decreto-Lei 49/99
- Breach triggers double-deposit penalty (arras)

**Escritura Pública**
- Final notarial deed of sale
- Executed before Cartório Notarial or Casa Pronta service
- All parties physically or via eIDAS present
- IMT (Imposto Municipal sobre Transmissões) paid prior

**IMT — Imposto Municipal sobre Transmissões**
- Municipal property transfer tax: 0–7.5% progressive rate
- Calculated on higher of declared value or VPT (Valor Patrimonial Tributário)
- Must be paid and stamped before Escritura

**Imposto de Selo (Stamp Duty)**
- 0.8% on property transfers
- Additional 0.6% on mortgage deeds if applicable

**Registo Predial**
- Land Registry at Conservatória do Registo Predial
- Ownership transfer legally binding only after registration
- Digital via predial.rnp.pt since 2023

**eIDAS Signatures**
- EU Regulation 910/2014 qualified electronic signatures
- Valid across all EU member states
- Accepted for Escritura digital workflows

---

### External Market Data Layer

| Source | Data Type | Frequency | Table |
|---|---|---|---|
| INE (Instituto Nacional de Estatística) | Official transaction prices, indices | Monthly | `external_price_benchmarks` |
| Banco de Portugal | Mortgage rates, lending volumes, bank credit data | Weekly | `external_price_benchmarks` |
| Confidencial Imobiliário | Active listing prices, asking price index | Daily | `external_price_benchmarks` |
| Idealista / Imovirtual | Market supply/demand ratios | Daily | `price_comparisons` |
| SIR (Sistema de Informação do Registo) | Official registry transactions | Weekly | `external_price_benchmarks` |

All external data is fetched via authenticated API calls, stored with `fetched_at` timestamp, and marked stale after 7 days. The `EXTERNAL_MARKET_SYNC_VERIFIED` gate enforces freshness.

Market externalization reports (`market_externalization_reports`) combine all sources into a single reconciled view used by the AVM (Automated Valuation Model) and ML prediction engines.

---

### ML Reality Alignment Engine

The ML Reality Alignment Engine ensures model predictions stay anchored to real-world outcomes:

**Real Outcomes Collection**
- Every completed deal writes a `real_outcomes` record with final_price, days_on_market, investor_return_pct
- Minimum 5 real outcomes required before ML validation can pass (GATE 4)

**Drift Detection**
- `ml_reality_alignments` compares model predictions vs real outcomes
- `drift_score` = mean absolute error / mean actual value
- `drift_severity`: LOW (<0.05) · MEDIUM (0.05–0.10) · HIGH (0.10–0.20) · CRITICAL (>0.20)
- HIGH/CRITICAL drift blocks GATE 4 (ML_ALIGNED_WITH_REALITY)

**Auto-Retraining Thresholds**
- drift_score > 0.15: queues retraining job
- drift_score > 0.20 (CRITICAL): immediate alert + model rollback to last stable version
- Retraining uses only verified `real_outcomes` — no synthetic data

**ML Test (testMLPredictionVsReality)**
- avg drift_score < 0.15 required for PASS
- avg drift_score ≥ 0.15 triggers WARNING (not critical block)
- No real_outcomes = FAIL (critical)

---

### Regulatory Compliance Core

| Framework | Scope | Implementation |
|---|---|---|
| MiFID II | Investor classification (Retail/Professional/Eligible Counterparty) | `mifid_classifications` table, pre-deal suitability checks |
| AML 6AMLD | Anti-Money Laundering — enhanced due diligence for real estate | `aml_screening_results`, PEP/sanctions screening via external API |
| GDPR | Data subject rights, retention policies, right to erasure | CRON purge job, `data_subject_requests` table, Art.17+20 |
| SOC2 | Security controls audit trail | `regulatory_audit_trail`, immutable SHA-256 chain |
| ISO27001 | Information security management | Access controls, encryption at rest/transit, key rotation |
| DORA (EU 2022/2554) | Digital Operational Resilience Act — ICT risk management | Incident response runbooks, `chaos_resilience` tables, RTO/RPO tracking |

Compliance reports are generated weekly with `overall_score_pct`. Score ≥ 60% and `ready_for_institutional = true` required for GATE 5 (COMPLIANCE_APPROVED).

---

### API Surface

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/validation/system-final` | Latest production readiness report |
| GET | `/api/validation/system-final?mode=fresh` | Run fresh 5-gate readiness check |
| GET | `/api/validation/system-final?mode=status-badge` | Quick status badge (color + score) |
| GET | `/api/validation/system-final?mode=test-suite` | Latest reality test suite run |
| GET | `/api/validation/system-final?mode=run-tests` | Trigger full 7-test suite (cron-safe) |
| POST | `/api/validation/system-final` `{ action: 'run-validation' }` | Admin: run production readiness check |
| POST | `/api/validation/system-final` `{ action: 'run-tests' }` | Admin: run full test suite |

Auth: Bearer (INTERNAL_API_TOKEN) · CRON (CRON_SECRET) · NextAuth session

---

### Database Infrastructure

| Migration | Tables | Description |
|---|---|---|
| 000065 | capital_execution_pipelines, psp_payment_intents | Real capital execution pipeline stages |
| 000066 | legal_workflows, eidas_signature_requests, notary_appointments | Legal execution chain |
| 000067 | external_price_benchmarks, price_comparisons, market_externalization_reports | External market sync |
| 000068 | ml_reality_alignments, real_outcomes | ML alignment and real outcome tracking |
| 000069 | compliance_reports, mifid_classifications, aml_screening_results | Regulatory compliance core |
| 000070 | bank_reconciliation_runs, gap_closure_reports, capital_reality_checks | Gap closure and reconciliation |
| 000071 | production_readiness_reports, reality_test_suite_runs | Wave 41: system validation gates |

**Total: 35+ new tables across Wave 39–41**

---

### Production Readiness Gates

All 5 gates are blocking — production is blocked until all 5 reach PASS status.

| Gate | ID | Condition | Tables Checked |
|---|---|---|---|
| 1 | CAPITAL_FLOW_VERIFIED | ≥1 COMPLETED pipeline AND ≥1 REAL reality check | `capital_execution_pipelines`, `capital_reality_checks` |
| 2 | LEGAL_EXECUTION_VERIFIED | ≥1 progressed workflow AND ≥1 SIGNED eIDAS | `legal_workflows`, `eidas_signature_requests` |
| 3 | EXTERNAL_MARKET_SYNC_VERIFIED | ≥1 fresh benchmark (last 7d) AND ≥1 extern. report | `external_price_benchmarks`, `market_externalization_reports` |
| 4 | ML_ALIGNED_WITH_REALITY | No HIGH/CRITICAL drift AND ≥5 real outcomes | `ml_reality_alignments`, `real_outcomes` |
| 5 | COMPLIANCE_APPROVED | Score ≥60% AND institutional-ready AND ≥1 MiFID classification | `compliance_reports`, `mifid_classifications` |

**System Status Resolution:**
- All 5 PASS → `REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE`
- ≥3 PASS, 0 FAIL (some PARTIAL) → `PARTIAL_REAL`
- Any blocking FAIL → `BLOCKED`
- All 5 FAIL → `SIMULATION_ONLY`

---

### System Invariants

These invariants must hold at all times in production:

1. **Real capital flow**: Money leaves and enters the system from/to the real world. Every euro is tracked from investor bank account through PSP → escrow → settlement. No simulated payments in production.

2. **Legal execution**: Decisions result in real legal execution. CPCV and Escritura are legal documents with binding force under Portuguese law. eIDAS signatures have legal equivalence to handwritten signatures across the EU.

3. **External feedback**: All market data and price benchmarks come from external authoritative sources (INE, Banco de Portugal, Confidencial Imobiliário). No internal-only price generation in production.

4. **ML alignment**: Models are trained exclusively on verified `real_outcomes` data. No synthetic training data. Drift > 0.20 triggers automatic rollback.

5. **Immutable audit trail**: Every state transition writes to `regulatory_audit_trail` with SHA-256 hash. Chain integrity is verified on every compliance report generation.

6. **Tenant isolation**: All queries scoped by `tenant_id`. No cross-tenant data leakage. RLS enforced at database level.

---

### Wave History

| Wave | Name | Key Deliverables |
|---|---|---|
| Wave 37 | Dashboard Maximum Execution System | Executive dashboard, KPI tracking, revenue analytics, alert engine |
| Wave 38 | Autonomous Control + Observability + Automation | Control plane, SRE observability, autonomous agents, chaos resilience |
| Wave 39 | European Capital Marketplace Infrastructure | Capital execution pipeline, PSP integration, legal workflow engine, compliance core |
| Wave 40 | Global Capital Growth + Market Expansion | Market expansion engine, investor onboarding, cross-border compliance, AML 6AMLD |
| Wave 41 | Full Gap Closure — Real European Capital Infrastructure | 5-gate production readiness validator, 7-test reality suite, gap closure orchestrator, external market sync, ML reality alignment |

---

*Generated: Wave 41 — Agency Group AMI 22506 — Portugal · Espanha · Madeira · Açores*
*Segment: €100K–€100M · Core €500K–€3M · Commission 5%*
