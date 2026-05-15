# LEARNING_SYSTEM_REPORT — SH-ROS Ω∞∞
**Agency Group | Institutional Autonomous Revenue OS**
**Report Date:** 2026-05-15 | **Auditor:** SH-ROS Internal Audit Engine v1.0
**Classification:** Engineering Truth — No Optimism Bias

---

## Executive Summary

The SH-ROS Learning Engine (Ω-9) is one of the most architecturally sophisticated components in the platform. It implements a closed-loop learning system: outcome events flow from `outcomeTracker` → weight updates in `reinforcementWeightStore` → calibration via `confidenceCalibrator` → governance approval via `learningGovernance` → deployment via `scoringEvolutionTracker`. The system is designed to improve agent decision quality over time without requiring manual model retraining. The governance layer (5-tier approval) prevents runaway adaptation and ensures human oversight on significant weight changes. Feedback loop risks are mitigated by weight bounds (0.5–1.5) and drift detection at a 15% threshold.

The primary honesty constraint on this system: **it requires a minimum of 100 outcome events for statistically significant calibration, and it is unknown whether this threshold has been reached in production.** Until that threshold is crossed, all learned weights are effectively bootstrapped priors, not empirically validated parameters. This is not an architectural flaw — it is an honest statement about what the system can deliver at current data volume.

**Learning System Score: 86/100**

---

## Score Breakdown

| Dimension | Score | Notes |
|---|---|---|
| Module Completeness | 19/20 | All 7 modules implemented |
| Feedback Loop Safety | 17/20 | Weight bounds + drift detection; no runaway risk |
| Governance Layer Quality | 18/20 | 5-tier approval; audit trail |
| Calibration Accuracy | 15/20 | Platt scaling correct; data volume uncertain |
| Minimum Data Requirements | 17/20 | Threshold defined; production volume unknown |
| **TOTAL** | **86/100** | |

---

## All Learning Modules Inventory

### Module 1: outcomeTracker (`lib/learning/outcomeTracking.ts`)

**Purpose:** Records the final outcome of every agent decision — deal won, deal lost, visit no-show, offer rejected — and links it back to the originating score, agent, and workflow.

**Implementation:** Event-driven listener on `deal_won`, `deal_lost`, `visit_completed`, `offer_rejected` events. Persists outcome records to `learning_events` table with full provenance chain (event_id → agent_id → score_at_decision → actual_outcome).

**Current Status:** Operational
**Known Gap:** Outcome attribution latency — a deal that takes 90 days to close means the learning signal arrives 90 days after the agent decision. This creates a 90-day minimum lag before the system can learn from current deal cohorts. **Short-term learning (visit quality, follow-up response rates) has faster feedback; deal-close learning is inherently slow in luxury real estate.**

### Module 2: reinforcementWeightStore (`lib/learning/reinforcementWeights.ts`)

**Purpose:** Maintains the current weight vector for scoring model parameters. Applies reinforcement signal (positive for winning outcome, negative for losing outcome) to update weights within defined bounds.

**Weight Bounds:** 0.5 (minimum) to 1.5 (maximum) per weight dimension
**Update Rule:** Bounded gradient update — weights cannot move more than 0.05 per update cycle
**Persistence:** Weights stored in database; versioned with timestamp and triggering outcome_id

**Implementation Analysis:**
- Bounds prevent any single signal from catastrophically shifting the scoring model
- The 0.05 per-cycle update limit provides natural learning rate control
- Version history allows weight rollback if a drift event is detected
- **Gap:** No automatic rollback trigger if a weight reaches its bound (0.5 or 1.5). A weight at a bound should trigger a governance review rather than silently stopping updates.

**Current Status:** Operational

### Module 3: confidenceCalibrator (`lib/learning/confidenceCalibration.ts`)

**Purpose:** Calibrates agent confidence scores using Platt scaling — a logistic regression layer that maps raw confidence output to true probability estimates.

**Algorithm:** Platt scaling fits a sigmoid function to (raw_confidence, actual_outcome) pairs. This converts overconfident or underconfident raw scores into calibrated probability estimates.

**Implementation Analysis:**
- Platt scaling is appropriate for binary outcome calibration (won/lost)
- Requires at least 50–100 outcome pairs per agent for the logistic regression to converge meaningfully
- Currently calibrates per-agent — correct, since different agents have different confidence biases
- **Gap:** No multi-class calibration for intermediate outcomes (offer_rejected, negotiation_stalled). Calibration currently treats everything as binary win/loss.

**Current Status:** Operational
**Data Requirement:** 50–100 outcome events per agent type

### Module 4: scoringEvolutionTracker (`lib/learning/scoringEvolution.ts`)

**Purpose:** Tracks the historical evolution of scoring model parameters over time. Provides the governance layer and analytics warehouse with a versioned history of how the model has changed.

**Implementation Analysis:**
- Full versioned history with timestamp, weight_delta, triggering_event, and governance_approval_id
- Enables regression analysis: if conversion rates drop after a weight update, the tracker provides the audit trail to identify and revert the change
- **Gap:** No automated performance regression test runs after each weight update. Governance approves the weight change, but there is no automated smoke test that validates the updated model against a holdout set before full deployment.

**Current Status:** Operational

### Module 5: learningGovernance (`lib/learning/learningGovernance.ts`)

**Purpose:** The approval gate for all weight updates. Implements a 5-tier approval framework based on the magnitude and scope of the proposed change.

**5-Tier Approval Framework:**

| Tier | Change Magnitude | Approval Required | Auto-Deploy |
|---|---|---|---|
| Tier 1 | <1% weight change | Automated audit log only | Yes |
| Tier 2 | 1–5% weight change | System flag + 24h review window | Yes after 24h |
| Tier 3 | 5–15% weight change | Operator acknowledgment required | No |
| Tier 4 | 15–30% weight change | Admin review required | No |
| Tier 5 | >30% change or drift detected | Engineering review required | No |

**Implementation Analysis:**
- Governance layer is well-designed — it scales oversight proportionally to risk
- Tier 5 correctly captures drift events (15% threshold in `driftDetector.ts`)
- **Gap:** Governance decisions are stored in the database but there is no email/Slack notification for Tier 3+ approvals. An operator could miss a pending approval indefinitely without a push notification.

**Current Status:** Operational

### Module 6: roiOptimizer (`lib/learning/roiOptimization.ts`)

**Purpose:** Uses outcome data to optimize the allocation of agent effort across the pipeline. Computes the ROI of each agent type and workflow, then recommends reallocation of agent capacity to higher-ROI activities.

**Implementation Analysis:**
- ROI computation uses the same attribution model as `revenueAttribution.ts` — inherits the heuristic attribution limitation documented in the Economic Efficiency Report
- Optimization recommendations are generated but not automatically applied — operator must review and approve reallocation
- **Gap:** No A/B testing framework. ROI comparisons are observational, not causal. Two workflows cannot be simultaneously tested against a control cohort.

**Current Status:** Operational

### Module 7: executionLearner (`lib/learning/executionLearning.ts`)

**Purpose:** Learns from execution trace data — timing, retry counts, failure modes — to improve orchestrator routing decisions. Identifies which agent implementations produce faster, more reliable execution paths for different event types.

**Implementation Analysis:**
- Execution learning has a faster feedback loop than outcome learning (hours vs. days/months)
- Learns execution quality metrics: latency, retry rate, timeout rate, DLQ rate per agent per event type
- Feeds back into `EVENT_AGENT_ROUTING` configuration in `lib/runtime/types.ts`
- **Gap:** Currently learns routing preferences but cannot modify the routing table autonomously — routing changes require a governance approval (Tier 3+). This is the correct safety constraint, but it means execution optimization operates on a slow human-approval cadence.

**Current Status:** Operational

---

## Accuracy Metrics

| Metric | Current State | Target |
|---|---|---|
| Outcome attribution accuracy | Heuristic (~70%) | Deterministic (>90%) |
| Confidence calibration accuracy | Unknown (data volume insufficient) | Brier score <0.15 |
| Weight update convergence | Not yet measurable | Stable within 500 outcome events |
| Drift detection sensitivity | 15% threshold | Tunable per market |
| Approval workflow latency | Unknown (no monitoring) | Tier 1: <1min; Tier 3: <24h |

---

## Known Feedback Loop Risks

### Risk 1: Slow outcome signal in luxury real estate
**Description:** Deals take 30–180 days to close. The learning system's outcome signal is inherently delayed. In a market with long deal cycles, the model is always learning from decisions made 1–6 months ago. If market conditions change rapidly (interest rate shock, political event), the model may continue reinforcing outdated patterns for months.

**Mitigation:** `driftDetector.ts` monitors score distribution shifts against market feedback signals. If score distributions drift significantly from conversion rates, Tier 5 governance triggers a manual review.

### Risk 2: Weight bounds prevent runaway but create ceiling effects
**Description:** The 0.5–1.5 weight bounds are correct safety constraints. However, if a feature genuinely deserves a weight of 2.0 (e.g., "buyer has proof of funds" is extremely predictive), the model cannot represent this relationship. The ceiling creates a systematic underrepresentation of high-signal features.

**Mitigation:** Annual governance review of weight bounds against observed feature importance distributions.

### Risk 3: Attribution errors propagate into learning signals
**Description:** If `outcomeTracker` attributes a deal win to the wrong agent or workflow (due to heuristic attribution), the wrong weights get reinforced. Attribution accuracy directly limits learning accuracy.

**Mitigation:** Multi-touch attribution implementation (Priority 1 in Economic Efficiency Report) would materially improve learning signal quality.

---

## Minimum Data Requirements

| Module | Minimum Events | Current Status | Assessment |
|---|---|---|---|
| confidenceCalibrator | 50–100 per agent | Unknown | Likely below threshold for new agents |
| reinforcementWeightStore | >30 outcome events | Unknown | May be sufficient for high-volume agents |
| roiOptimizer | >50 per workflow type | Unknown | Likely insufficient for rare workflows |
| executionLearner | >200 per event type | Likely met for common events | Sufficient |
| scoringEvolutionTracker | No minimum | N/A — tracks history | N/A |
| learningGovernance | No minimum | N/A — approval gate | N/A |

**Critical finding:** The learning system is architecturally operational, but it is not possible to assess whether its outputs are statistically meaningful without knowing the actual outcome event counts in production. This must be measured before learning weights are treated as reliable inputs to decision-making.

**Recommendation:** Export `SELECT agent_type, COUNT(*) FROM learning_events WHERE event_type = 'outcome' GROUP BY agent_type` and compare against minimum thresholds. If any agent type is below 50 outcome events, treat its calibrated weights as priors, not posteriors.

---

## Recommendations

| Priority | Action | Impact | Effort |
|---|---|---|---|
| P1 | Measure actual outcome event counts per agent in production | Critical — establishes whether learning is trustworthy | 0.5 days |
| P2 | Add Slack/email notification for Tier 3+ governance approvals | High — prevents missed approvals | 1 day |
| P3 | Implement post-weight-update automated smoke test | High — prevents silent model regression | 2 days |
| P4 | Add multi-class calibration for intermediate outcomes | Medium — improves calibration accuracy | 3 days |
| P5 | Implement A/B holdout framework for ROI measurement | Medium — enables causal learning | 5 days |
| P6 | Add automated alert when weight reaches its bound (0.5 or 1.5) | Medium — surfaces ceiling effects | 1 day |
| P7 | Annual review of weight bounds vs. feature importance | Low — governance process | 1 day/year |

---

*This report was generated by the SH-ROS Internal Audit Engine. Learning system accuracy cannot be fully assessed without production outcome event count data. All architectural assessments are based on static code analysis as of 2026-05-15.*
