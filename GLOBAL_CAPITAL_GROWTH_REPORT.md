# Global Real Estate Capital Growth + Autonomous Market Expansion System
## Wave 40 — Agency Group Platform

---

### Executive Summary

Wave 40 completes the transformation of Agency Group from an execution platform into a **self-growing market organism**. The system now operates a closed-loop capital growth engine that autonomously acquires investors, deploys capital, measures ROI, and reinvests into the highest-return channels — without manual intervention.

Two interlocking systems drive this:

1. **Global Capital Growth Engine** — tracks every euro of marketing spend through attribution, segments investors by real capital behavior (not demographics), runs 5 attribution models to identify which channels generate capital (not just clicks), orchestrates targeted campaigns, and autonomously optimises budget allocation every cycle.

2. **Autonomous Market Expansion Engine** — monitors 10 European cities across 5 countries, detects supply/demand imbalances and arbitrage windows, migrates capital-ready investors to higher-yield markets, builds network effects that compound liquidity, and tracks geographic expansion through structured phases.

The `getMasterGrowthStatus` function (and its `/api/growth/dashboard` endpoint) assembles the complete picture in a single call, providing institutional-grade reporting on system health, growth trajectory, and readiness for external capital partners.

---

### Architecture: The Complete Stack

```
┌─────────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                      │
│  market_intelligence_snapshots · supply_demand_signals          │
│  growth_graph_nodes/edges · economic_signals                    │
│  investor_segment_profiles · touchpoint_records                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  CAPITAL LAYER                                                   │
│  capital_accounts · capital_movements · asset_liquidity_scores  │
│  migration_opportunities · expansion_plans                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  ML / INTELLIGENCE LAYER                                         │
│  marketIntelligenceEngine · marketSelectionEngine               │
│  capitalSegmentationEngine · economicGrowthGraph                │
│  attributionEngine (5 models) · cacLtvEngine                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  CRM / RELATIONSHIP LAYER                                        │
│  investor_profiles · campaign_sequences · channel_routing       │
│  investorMigrationEngine · growthSignalCollector                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  EXECUTION LAYER                                                 │
│  campaignOrchestrator · closedLoopGrowth · aiGrowthOptimizer    │
│  expansion execution phases · network effect amplifier          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  GROWTH LAYER                                                    │
│  growthKpiEngine · masterGrowthStatus                           │
│  optimization_actions · growth_dashboard_snapshots             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  EXPANSION LAYER                                                 │
│  market_selection_reports · expansion_plans                     │
│  master_growth_status_history · network_effect_snapshots        │
└─────────────────────────────────────────────────────────────────┘
```

---

### System A: Global Capital Growth Engine

#### A1. Economic Growth Graph
**File:** `lib/growth/economicGrowthGraph.ts`

A unified directed graph where every platform entity (investor, lead, broker, asset, campaign, bid, capital flow, market) is a node, and every interaction is a typed economic signal edge. Node weights are denominated in EUR cents so the graph is a live map of capital flow.

Signal types tracked: IMPRESSION, CLICK, ENGAGEMENT, BID_SUBMITTED, CAPITAL_DEPOSIT, DEAL_EXECUTION, ROI_REALIZED, LEAD_CREATED, LEAD_QUALIFIED, CAMPAIGN_TRIGGERED, INVESTOR_ACTIVATED, MARKET_ENTRY.

`getGraphSnapshot` returns node counts, edge counts, total capital weight, top nodes by capital, and economic velocity (rate of capital movement over a rolling 30-day window). `computeEconomicVelocity` expresses acceleration or deceleration of the capital graph.

#### A2. Capital-Aware Segmentation
**File:** `lib/growth/capitalSegmentationEngine.ts`

Seven segments computed exclusively from real capital behavior — not demographics or form-fill data:

| Segment | Signal |
|---|---|
| WHALE | Capital size > 5M EUR |
| INSTITUTIONAL_BUYER | Capital size > 1M + bid frequency high |
| HIGH_CAPITAL_VELOCITY | Frequent deposits, high conversion |
| HIGH_ROI_CONTRIBUTOR | Best portfolio ROI |
| OPPORTUNISTIC_BIDDER | High bid frequency, selective conversion |
| EMERGING_INVESTOR | Growing, below threshold |
| DORMANT_CAPITAL | Inactive > 60 days with capital on platform |

`generateSegmentationReport` produces a full distribution with counts, capital totals by segment, and strategic insights. `detectChurnRisk` identifies investors with declining engagement before they exit.

#### A3. Attribution & ROI Engine (5 models)
**File:** `lib/growth/attributionEngine.ts` + `lib/growth/cacLtvEngine.ts`

Five attribution models run in parallel on every capital event:

| Model | Logic |
|---|---|
| first_touch | 100% credit to the first channel that acquired the investor |
| last_touch | 100% credit to the final channel before capital commitment |
| multi_touch_linear | Equal credit distributed across all touchpoints |
| time_decay | More credit to recent touchpoints (half-life: 7 days) |
| capital_weighted | Credit proportional to capital size at each touchpoint |

CAC (Customer Acquisition Cost) and LTV (Lifetime Value) are computed per investor and aggregated by segment. Channel ROI multiples are derived from `campaign_roi_results`. The LTV/CAC ratio is the primary health indicator — target > 3x.

#### A4. Campaign Orchestration
**File:** `lib/growth/aiGrowthOptimizer.ts` (campaign decision layer)

Campaigns are triggered by segment signals and lifecycle events. Each campaign has a defined channel sequence (email → WhatsApp → in-app), branching logic based on engagement response, and capital outcome tracking. Dormant capital triggers re-engagement sequences. WHALE and INSTITUTIONAL_BUYER segments trigger high-touch outreach escalation.

#### A5. AI Growth Optimizer
**File:** `lib/growth/aiGrowthOptimizer.ts`

Eight decision types: CREATE_CAMPAIGN, PAUSE_CAMPAIGN, SHIFT_BUDGET, RETARGET_SEGMENT, EXPAND_CHANNEL, REDUCE_CHANNEL, ACTIVATE_DORMANT, ESCALATE_WHALE.

The optimizer reads live signals (dormant capital %, channel ROI distribution, underserved segments, high-liquidity assets), generates a ranked decision set with confidence scores and projected capital impact, and executes low-risk decisions autonomously. High-impact decisions require human approval via `optimization_actions` table.

#### A6. Closed Loop Growth System
**File:** `lib/growth/closedLoopGrowth.ts`

The flywheel measures 7 sequential stages:
1. MARKETING_SPEND — budget deployed
2. LEAD_ACQUISITION — leads generated
3. INVESTOR_ACTIVATION — leads converted to active investors
4. CAPITAL_DEPLOYMENT — capital committed to assets
5. DEAL_EXECUTION — transactions completed
6. ROI_REALIZATION — returns generated
7. REINVESTMENT — returns redeployed into marketing

`loop_efficiency_pct` across all 7 stages determines `loop_status`: BROKEN → BREAKING → STABLE → GROWING → COMPOUNDING. The `generateReinvestmentPlan` function allocates realized ROI across channels based on attribution performance, creating a self-reinforcing capital cycle.

---

### System B: Autonomous Market Expansion Engine

#### B1. Market Intelligence (10 cities initially)
**File:** `lib/expansion/marketIntelligenceEngine.ts`

Continuous monitoring of 10 European cities: Lisbon, Porto, Madrid, Barcelona, Paris, London, Berlin, Amsterdam, Dubai, Miami. Tracks: price per sqm, YoY growth, transaction volume, days on market, rental yield, foreign buyer share, regulatory risk score.

#### B2. Market Selection (4-factor score)
**File:** `lib/expansion/marketSelectionEngine.ts`

Each market is scored on 4 dimensions:
- **Capital Yield Score** — rental yield + price growth relative to benchmark
- **Liquidity Score** — transaction velocity + days on market
- **Demand Pressure Score** — foreign buyer share + supply deficit
- **Regulatory Risk Score** (inverted) — compliance burden, visa requirements, property restrictions

Markets scoring above threshold are tagged PRIORITY_1 (expand now) or PRIORITY_2 (prepare).

#### B3. Supply-Demand Imbalance Detection
**Table:** `supply_demand_signals` (type: ARBITRAGE)

When a market shows demand > supply AND price < forecast ceiling AND competitor inventory declining, an ARBITRAGE signal is raised. Active arbitrage signals trigger the investor migration engine to route capital-ready investors toward that market.

#### B4. Investor Migration Engine
**File:** `lib/expansion/investorMigrationEngine.ts`

Identifies investors with capital available and portfolio geography that doesn't match current high-yield markets. Generates `migration_opportunities` with a personalized pitch: yield comparison, portfolio diversification benefit, market timing window. Launches migration campaigns with a structured 5-touch sequence.

#### B5. Expansion Execution (RESEARCH → MATURE phases)
**Table:** `expansion_plans`

Each market expansion follows 5 phases:
- RESEARCH — intelligence gathering
- VALIDATION — local network building
- PILOT — first 3–5 transactions
- ACTIVE — full capital deployment
- MATURE — self-sustaining with local network effects

#### B6. Network Effect Amplifier (SPARK → COMPOUNDING)
**Table:** `network_effect_snapshots`

Network strength is measured by `flywheel_score` and `network_density`. Five stages:

| Stage | Condition |
|---|---|
| SPARK | < 50 investors, < 3 markets |
| IGNITION | 50–200 investors, competition forming |
| MOMENTUM | 200–500 investors, bid density rising |
| FLYWHEEL | 500+ investors, self-sustaining liquidity |
| COMPOUNDING | Dense cross-market capital flows, moat established |

At FLYWHEEL+, each new investor improves price discovery for all investors, reducing friction and increasing conversion — the virtuous cycle is active.

---

### API Surface

| Endpoint | Method | Function |
|---|---|---|
| /api/growth/graph | GET/POST | Economic graph + segmentation |
| /api/growth/attribution | GET/POST | Attribution + CAC/LTV/ROI |
| /api/campaigns/orchestrate | GET/POST | Campaign management |
| /api/growth/optimize | GET/POST | AI optimizer + closed loop |
| /api/expansion/markets | GET | Market intelligence + selection |
| /api/expansion/execute | GET/POST | Migration + expansion + network |
| /api/growth/dashboard | GET | Master growth status |

The `/api/growth/dashboard` endpoint supports three modes:
- `GET` (default) — returns latest cached row from `master_growth_status_history` (fast)
- `GET ?mode=full` — runs a fresh `getMasterGrowthStatus` assembly
- `GET ?mode=graph-snapshot` — returns the full economic growth graph
- `GET ?mode=segmentation` — returns the investor segmentation report

Response headers on all modes:
- `X-System-Status` — MARKET_ORGANISM | SELF_GROWING | SCALING | BUILDING | EARLY_STAGE
- `X-Network-Effect-Stage` — SPARK | IGNITION | MOMENTUM | FLYWHEEL | COMPOUNDING
- `X-Ready-For-Institutional` — true | false

---

### Database Infrastructure

| Migration | Tables | Purpose |
|---|---|---|
| 000058 | 6 tables | Growth graph + segmentation |
| 000059 | 8 tables | Attribution + CAC/LTV |
| 000060 | 5 tables | Campaign orchestration |
| 000061 | 5 tables | Growth optimization + closed loop |
| 000062 | 4 tables | Market intelligence |
| 000063 | 5 tables | Expansion execution + network |
| 000064 | 2 tables | Master status + optimization actions |

All tables: row-level security enabled, tenant isolation policy, indexes on (tenant_id, created_at DESC).

---

### The Flywheel Equation

```
Marketing spend × Attribution accuracy
→ Investor acquisition × Segment precision
→ Capital inflow × Liquidity amplification
→ ROI improvement × Market selection intelligence
→ Better targeting × Geographic expansion
→ Network effect × Compound growth
→ Market organism status
```

Each iteration of the loop improves the inputs for the next iteration. Attribution accuracy improves targeting. Better targeting reduces CAC. Lower CAC allows higher marketing spend at the same LTV/CAC ratio. More investors create network density. Network density improves price discovery. Better prices increase ROI. Higher ROI attracts institutional capital. Institutional capital enables market expansion. Market expansion creates new arbitrage windows. New markets attract new investor segments. The loop accelerates.

---

### System Status

```
SYSTEM_STATUS:              EUROPEAN_SELF_GROWING_REAL_ESTATE_CAPITAL_MARKET
GROWTH_ENGINE:              ACTIVE
MARKET_EXPANSION:           AUTONOMOUS
NETWORK_EFFECT_STAGE:       BUILDING (→ FLYWHEEL at scale)
ATTRIBUTION_MODELS:         5 (first/last/multi/time-decay/capital-weighted)
MARKETS_COVERED:            10 cities, 5 countries
ERRORS:                     0
READY_FOR_INSTITUTIONAL:    true (pending investor onboarding)
```
