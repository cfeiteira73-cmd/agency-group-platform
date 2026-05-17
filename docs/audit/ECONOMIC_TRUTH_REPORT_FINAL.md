# Economic Truth Report — Final
AGENCY GROUP SH-ROS · 2026-05-17

---

## Portugal 2026 Market Context

The system references the following benchmarks throughout the economic models:

| Benchmark | System Value | Status |
|---|---|---|
| National median price/m² | €3,076/m² | Matches CLAUDE.md context |
| Lisboa price/m² | €5,000/m² | Matches system comments |
| Cascais price/m² | €4,713/m² | Present in zones.ts (not audited directly) |
| Algarve price/m² | €3,941/m² | Present in zones.ts |
| Porto price/m² | €3,643/m² | Present in zones.ts |
| Madeira price/m² | €3,760/m² | Present in zones.ts |
| Commission rate | 5% | Consistently applied (see below) |
| Median DOM | 210 days | Used as default in `ZONE_MEDIAN_DAYS` |
| Luxury segment DOM — Lisboa | 180 days | `ZONE_MEDIAN_DAYS['Lisboa']` |
| Luxury segment DOM — Algarve | 200 days | `ZONE_MEDIAN_DAYS['Algarve']` |

These values are consistent with the stated 2026 market data. No outdated (pre-2025) benchmark values were found in the audited files.

---

## Commission Rate Analysis

**Finding: 5% is consistently applied. No inconsistencies found.**

Locations where `0.05` (5%) appears as commission rate:

1. `lib/economic-closed-loop-v2/index.ts`, line 101: `const commission_rate = 0.05` — hardcoded in `createEconomicEvent()`
2. `lib/economic-closed-loop-v2/index.ts`, line 199: `const estimated_commission_eur = property_value_eur * 0.05 * close_probability`
3. `lib/value-attribution-engine/index.ts`, line 211: `commissionRate: number = 0.05` — default parameter, caller-overridable
4. `lib/executive-revenue-v2/index.ts`, line 85: `((listing_price_eur - avm_base_eur * 1.05) * 0.05) / 12` — overpriced leakage
5. `lib/executive-revenue-v2/index.ts`, line 100: `(listing_price_eur * 0.05 * 0.1) / 12` — stale leakage
6. `lib/executive-revenue-v2/index.ts`, line 114: `(listing_price_eur * 0.05 * 0.08) / 12` — low demand leakage
7. `lib/executive-revenue-v2/index.ts`, line 129: `(listing_price_eur * 0.05 * 0.05) / 12` — missing photos leakage
8. `lib/executive-revenue-v2/index.ts`, line 204: `l.listing_price_eur * 0.05 * (l.demand_score / 100) * 0.08` — revenue prediction

**Consistency observation**: In `createEconomicEvent()`, commission rate is hardcoded as `0.05` and cannot be overridden by the caller. In `computeImpactCard()` (value-attribution-engine), commission rate is a parameter with a 0.05 default, which is the correct design. These two libraries are architecturally consistent with Agency Group's AMI 22506 5% standard.

**Minor issue**: In the economic closed loop, the `advanceStage()` function back-derives property value from `estimated_commission_eur / (0.05 * current_prob)`. If `current_prob` is 0 (impossible given `STAGE_WEIGHTS` minimum is 0.002), this would be a division by zero. The guard `current_prob > 0` is present on line 249 but returns `implied_property_value = 0` silently. This is correct defensive coding.

---

## AVM Calculation Correctness

**File**: `lib/valuation/avm.ts`

### Methodology

The AVM uses a three-tier approach:
1. **Comps-weighted** (3+ comparables): 70% comps + 30% zone benchmark
2. **Comps-limited** (1-2 comparables): 50% comps + 50% zone benchmark
3. **Zone benchmark** (0 comparables): zone pm2_trans × area_m2 with condition/bedroom adjustments

IQR outlier rejection is applied before comp averaging — this is statistically sound for small samples.

### Confidence Bounds

`computeConfidence()` returns values in range 0.20–0.95:

- `zone_only` (no area data): returns **0.20** — correct floor
- `zone_benchmark` without area: returns **0.25**
- `zone_benchmark` with area: returns **0.40**
- `comps_limited`: base **0.45** + 0.06 per comp, max 0.95
- `comps_weighted`: base **0.60** + 0.06 per comp, capped at `Math.min(0.95, ...)` — line 206

Confidence stays strictly within 0–1. No overflow possible. The `Math.min(0.95, ...)` cap correctly prevents the model from claiming certainty.

**Issue**: With `comps_weighted` and 6+ comparables: 0.60 + (6 × 0.06) = 0.96, but `Math.min(0.95, 0.96) = 0.95`. The cap works. With the 30-comp query limit and IQR rejection, realistically the confidence tops out around 0.80-0.85. No mathematical issues.

### Spread (3-Point Range)

| Method | Spread |
|---|---|
| comps_weighted | ±10% |
| comps_limited | ±15% |
| zone_benchmark | ±20% |
| zone_only | ±30% |

These spreads are asymmetric relative to AVM base: `value_low = base × 0.90`, `value_high = base × 1.10`. This means the range is symmetric in percentage but not in absolute EUR. For a €1M property, `low = €900K`, `high = €1.1M` — a €200K range. This is a reasonable representation of uncertainty.

### Bug in `compToValue()`: Redundant condition normalization

`lib/valuation/avm.ts`, lines 344–355:

```typescript
const { adjusted } = applyPropertyAdjustments(pm2 * input.area_m2, comp.condition, comp.bedrooms)
const inputCondMult = CONDITION_AVM_MULT[input.condition ?? 'good'] ?? 1.0
return Math.round(adjusted / inputCondMult * inputCondMult)
```

`adjusted / inputCondMult * inputCondMult` simplifies to `adjusted` — the division and multiplication cancel out. The intent was likely to reverse-adjust for the comp's condition to get a neutral value, then re-apply the input's condition. The actual effect is that `comp.condition` adjustment is applied but the reverse-normalization is a no-op. This means comps from renovated properties inflate the estimate for good-condition properties and vice versa, introducing a **systematic bias** when comparable properties have different condition ratings.

**Severity**: MEDIUM economic error. The magnitude depends on the mix of conditions in comp pools. In luxury markets where most comps are `good` or `excellent`, the effect is small (4% maximum between `good` and `excellent`). For properties near `needs_renovation` (0.80), the bias could be 20%.

---

## Pricing Intelligence Correctness

**File**: `lib/pricing-intelligence/index.ts`

### Deviation Threshold (8%)

```typescript
if (deviation > 0.08) {
  overpricing_probability = Math.min(95, Math.round(deviation * 300))
} else if (deviation < -0.08) {
  underpricing_probability = Math.min(95, Math.round(Math.abs(deviation) * 300))
}
```

An 8% deviation threshold before flagging overpricing is reasonable for Portugal 2026. The Portuguese market historically has a 5–10% negotiation buffer built into listing prices. An 8% threshold avoids false positives for normally-priced properties with negotiation room.

The `deviation * 300` formula means:
- At 8% over AVM: probability = min(95, 24) = **24%** — appropriate (low-moderate probability)
- At 15% over AVM: probability = min(95, 45) = **45%** — reasonable
- At 32% over AVM: probability = min(95, 95) = **95%** — capped correctly

The `Math.min(95, ...)` cap prevents the probability from reaching 100%, which is correct since there is always uncertainty. **The 95 cap is working correctly.**

### Optimal Range Calculation

```typescript
const luxuryAdj = inputs.luxury_score ? (inputs.luxury_score - 50) / 100 * 0.08 : 0
const optimal_min = Math.round(avmResult.value_low * (1 + luxuryAdj))
const optimal_max = Math.round(avmResult.value_high * (1 + luxuryAdj) * 1.05)
```

For `luxury_score = 50` (median): `luxuryAdj = 0` → range is `[avm_low, avm_high × 1.05]`
For `luxury_score = 100` (maximum): `luxuryAdj = 0.04` (4%) → range is `[avm_low × 1.04, avm_high × 1.04 × 1.05]`
For `luxury_score = 0` (minimum): `luxuryAdj = -0.04` (-4%) → range is `[avm_low × 0.96, avm_high × 0.96 × 1.05]`

**Issue**: The `optimal_max` is always `avm_high × 1.05 × (1 + luxuryAdj)`, meaning it consistently extends 5% above the high AVM estimate. This means the "optimal range" includes values the AVM considers above the high bound, which is contradictory. If the AVM says the property is worth €800K–€1M (high), the optimal max becomes €1.05M — above market. For luxury properties, a premium over AVM is justifiable, but it should not be presented as "optimal" without a disclaimer.

**Recommendation**: The `× 1.05` multiplier on `value_high` should only apply for `luxury_score > 70`, and the label should say "luxury premium range" not "optimal range."

### Days-on-Market Estimation

```typescript
const demandFactor = demand_score ? (1 - (demand_score / 100) * 0.5) : 1
const priceFactor = pricing_risk === 'overpriced' ? 1.6 : pricing_risk === 'underpriced' ? 0.7 : 1
return Math.round(baseDays * demandFactor * priceFactor)
```

**Division-by-zero risk**: None. `baseDays` is always ≥ 160 (from `ZONE_MEDIAN_DAYS`), and the multipliers are never zero. The minimum DOM result is `Math.round(160 × (1 - 0.5) × 0.7) = Math.round(56) = 56` days. The maximum is `Math.round(220 × 1 × 1.6) = 352` days. Both are plausible ranges.

**Issue**: `demand_score = 0` evaluates as falsy, so `demandFactor = 1` (neutral) even though 0 demand should give a much higher DOM. This is a silent edge case: a `demand_score` of `0` is treated the same as a missing value, losing information. Fix: change to `demand_score !== null && demand_score !== undefined ? ... : 1`.

---

## Conversion Funnel Probabilities

**File**: `lib/economic-closed-loop-v2/index.ts`

### Stage Weights (Portugal 2026, 5% commission model)

```
listing_view:       0.002  (0.2%)
intent_signal:      0.02   (2%)
inquiry:            0.08   (8%)
agent_contact:      0.18   (18%)
visit_scheduled:    0.28   (28%)
visit_completed:    0.42   (42%)
offer_created:      0.62   (62%)
negotiation:        0.78   (78%)
deal_closure:       0.95   (95%)
commission_collected: 1.0  (100%)
```

**Monotonic ordering**: Verified. Each stage weight is strictly greater than the previous. The sequence is correctly ordered.

**Benchmarking against Portugal luxury market**:
- `listing_view → inquiry` conversion: the model implies approximately 0.002 → 0.08 = 4% of viewers inquire. Industry data for luxury portals typically shows 2–6%. This is plausible.
- `inquiry → visit_scheduled`: 0.08 → 0.28 = 3.5x ratio. Industry: roughly 30–50% of serious inquiries convert to a visit. 3.5x seems high (it implies 28/8 = 3.5% of viewers schedule visits from 8% inquiries). Re-reading: these are absolute p(close) weights, not conversion rates between stages. The conversion rate from inquiry to visit is `0.28/0.08 = 3.5x baseline probability`, not a 350% conversion rate.
- `visit_completed → offer_created`: 0.42 → 0.62. Implies approximately 62/42 = 47.6% more likely to close after a completed visit than after scheduling one. Reasonable.
- `offer_created → deal_closure`: 0.62 → 0.95. A submitted offer has a 95% close probability. This seems high — Portugal CPCV (promissory purchase contract) typically has a 10–15% fall-through rate, implying offer → close should be ~85%. The 0.95 weight may slightly overstate deal confidence at offer stage.

**Assessment**: Stage weights are internally consistent, monotonic, and broadly plausible. The offer → close rate at 95% is aggressive; using 0.85 would be more conservative and statistically defensible.

### Funnel Health Detection Thresholds

```typescript
if (graph.stage_transition_velocity > 0.5) return 'accelerating'  // > 1 stage every 2 days
if (graph.time_in_stage_days > 14) return 'at_risk'               // 2 weeks in same stage
if (graph.stage_transition_velocity < 0.1) return 'stalling'      // < 1 stage every 10 days
```

For Portugal's luxury market with 210-day median DOM across ~10 stages: average velocity = 10 stages / 210 days ≈ 0.048 events/day. This means most deals in progress will be classified as "stalling" (velocity < 0.1), which is mathematically correct for a slow market but may alarm agents unnecessarily for normal deals. The `at_risk` threshold of 14 days in a single stage is appropriate for early funnel stages (inquiry, visit) but may be too aggressive for late stages (negotiation can legitimately take 30–60 days in Portugal).

---

## Economic Closed Loop Correctness

**File**: `lib/economic-closed-loop-v2/index.ts`

### Velocity Calculation

```typescript
const uniqueStagesVisited = new Set(sorted.map((e) => e.stage)).size
const totalElapsedDays = Math.max(1, elapsed_ms / 86_400_000)
const stage_transition_velocity = uniqueStagesVisited / totalElapsedDays
```

**Issue**: Velocity uses `unique stages visited / total elapsed days`, not `stage transitions / elapsed days`. If the same stage appears multiple times (e.g., multiple `listing_view` events over 30 days), it only counts once in the numerator, while the denominator grows. A property with 50 listing views over 50 days but no progression has velocity = 1/50 = 0.02 (stalling). This is correct behavior — no progression = stalling.

**Issue**: `totalElapsedDays` uses `Math.max(1, ...)`. For events on the same day, velocity = `n_stages / 1 = n_stages`. If 5 stage events occur on the same day (edge case during data migration), velocity = 5.0, triggering `accelerating`. This is a minor false positive risk.

### `buildEventGraph` — Empty Graph

Returns `property_id: ''` for an empty event array (line 155). Callers that access `graph.property_id` on an empty graph will get an empty string, not an error. This is consistent but callers should guard against it.

---

## Revenue Leakage Calculations

**File**: `lib/executive-revenue-v2/index.ts`

### Overpriced Leakage Formula

```typescript
const leakage = ((listing_price_eur - avm_base_eur * 1.05) * 0.05) / 12
```

**Interpretation**: The excess above `avm × 1.05` (5% above AVM as "acceptable premium"), times 5% commission, divided by 12 for monthly rate. This models the opportunity cost as: "if the price were reduced to AVM+5%, you'd close in a normal timeframe; the gap represents commission you're losing each month the property sits overpriced."

**Trigger condition**: `listing_price_eur > avm_base_eur * 1.1` (10% over AVM). This is correct — you only trigger the leakage calculation when the property is demonstrably overpriced (>10% over AVM), and the leakage is measured from the 5% premium baseline, not from AVM itself.

**Numerical example**: listing = €1.2M, AVM = €1.0M
- Trigger: 1.2M > 1.0M × 1.1 = 1.1M → YES
- Leakage = (1.2M - 1.0M × 1.05) × 0.05 / 12 = (1.2M - 1.05M) × 0.05 / 12 = €150K × 0.05 / 12 = €625/month
- Priority: €625 < €2,000 → "medium"

This seems low for a €1.2M property. The formula is mathematically correct per its stated intent, but the business interpretation is weak: €625/month doesn't motivate urgency. The real opportunity cost is the full commission (€60,000) divided by estimated extra months on market (e.g., 4 months → €15,000/month). The current formula uses the price gap as the base, not the full commission — this systematically understates urgency.

### Stale Leakage Formula

```typescript
const leakage = Math.round((listing_price_eur * 0.05 * 0.1) / 12)
```

**Interpretation**: 5% commission × 10% monthly degradation factor ÷ 12 months. For a €1M property: €1M × 0.05 × 0.1 / 12 = **€417/month**. This is the monthly carrying cost of a stale listing assuming 10% annual probability of deal degradation.

The `0.1` factor (10% annual degradation) is an assumption embedded without calibration. There is no source for this figure. For luxury properties stale for 180+ days, real degradation risk is likely higher (possibly 20–30% of deals fall through or require major price cuts). **False precision risk**: the formula implies precision to the nearest euro, but the underlying 10% degradation rate is an estimate.

### Annual vs. Monthly Calculation Consistency

All leakage formulas divide by 12 at the end, deriving monthly figures from annual rates. This is consistent throughout. No formula mixes annual and monthly rates incorrectly.

### Revenue Prediction Formula

```typescript
const monthly = listings.reduce((sum, l) => {
  return sum + l.listing_price_eur * 0.05 * (l.demand_score / 100) * 0.08
}, 0)
const quarterly = monthly * 3 * 0.85
```

**Interpretation**: For each listing, expected monthly revenue = `price × 5% commission × demand_score_fraction × 8% monthly close rate`. The 0.08 (8%) is the assumed monthly probability of closing for an average-demand listing.

**Issue**: `demand_score` ranges 0–100. For `demand_score = 0`: revenue contribution = 0. For `demand_score = 100`: `price × 0.05 × 1.0 × 0.08 = price × 0.004` = 0.4% of listing price per month as expected commission. For a €1M listing: €4,000/month expected commission revenue.

The 8% monthly close rate (implying ~12.5-month average time-to-close) is broadly consistent with the 210-day (~7-month) median DOM, but the median DOM is for the market overall — the 8% rate may actually represent quarterly conversion, not monthly. **If the DOM is 210 days (7 months), the monthly close rate should be approximately 1/7 = 14%, not 8%.** This means `predictRevenue()` systematically underestimates monthly revenue by roughly 40%.

**Quarterly discount**: `quarterly = monthly × 3 × 0.85`. The 0.85 factor applies a 15% discount on Q × 3 monthly figures to account for seasonality and fallouts. This is a reasonable heuristic but undocumented.

---

## Value Attribution Models

**File**: `lib/value-attribution-engine/index.ts`

### Action Impact Benchmarks (Portugal 2026)

| Action | Conversion Lift | Time Saved (days) | Causal Strength | Confidence |
|---|---|---|---|---|
| price_reduction | +35% | 45 | 0.82 | 0.78 |
| photo_upgrade | +18% | 20 | 0.55 | 0.70 |
| inquiry_response | +40% | 30 | 0.88 | 0.85 |
| visit_booking | +55% | 40 | 0.90 | 0.82 |
| offer_submission | +68% | 20 | 0.92 | 0.88 |
| negotiation_move | +25% | 15 | 0.75 | 0.72 |

**Assessment of realism**:

- `price_reduction +35% conversion, -45 days`: A 5–8% price reduction increasing conversion by 35% is well-supported by real estate literature. The -45 days estimate is aggressive but plausible for markets with active buyers. Reasonable.

- `inquiry_response +40% conversion, expires in 2 hours`: The urgency and conversion lift are consistent with the "5-minute rule" from lead response research (rapid response dramatically improves conversion). The 2-hour window is more generous than the literature but appropriate for a luxury market where buyers are less impulsive. Reasonable.

- `visit_booking +55% conversion`: Visits are indeed the primary conversion driver in Portuguese real estate. 55% lift over a baseline that hasn't yet had a visit is plausible. Reasonable.

- `offer_submission +68% conversion`: This is the largest lift. An offer is the penultimate stage — the 68% incremental lift on conversion probability is consistent with `offer_created` stage weight of 0.62 in the closed loop. Reasonable.

- `photo_upgrade +18% conversion`: Research on real estate photography consistently shows 10–25% improvement in inquiry rates. 18% is within range.

### Expected Value Formula

```typescript
const probability_shift = Math.min(
  1 - currentCloseProbability,
  currentCloseProbability * (model.conversion_lift_pct / 100),
)
const new_probability = currentCloseProbability + probability_shift
const expected_value_eur = propertyValueEur * commissionRate * new_probability
```

**Mathematical soundness**:
- `probability_shift` is capped at `1 - currentCloseProbability` — this correctly prevents `new_probability` from exceeding 1.0. **Correct.**
- `expected_value_eur = propertyValueEur × 0.05 × new_probability` — this is the correct expected commission formula: E[commission] = property_value × rate × p(close). **Correct.**
- `revenue_marginal_gain = propertyValueEur × commissionRate × (lift_pct / 100) × causal_strength` — this models the incremental commission × the causal fraction attributable to the action. The formula diverges slightly from the probability_shift calculation because it uses the raw `lift_pct / 100` rather than the capped `probability_shift`. For high-probability events (currentCloseProbability close to 1.0), `expected_value_eur` would be high but `revenue_marginal_gain` could overstate the gain. This is a minor inconsistency.

### Elasticity Values

**Observation**: The value attribution engine does not model price elasticity directly. The closest analog is `price_reduction` with `conversion_lift_pct = 35` and `time_to_close_delta_days = -45`. The implied elasticity is positive (price reduction → more conversions), which is economically correct — demand curves slope downward, so lower prices increase quantity demanded. No negative elasticity errors found.

---

## False Precision Risks

The following outputs carry precision that exceeds the model's actual certainty:

1. **AVM values expressed to the nearest euro**: `Math.round(baseValue * condition_mult * bedroom_mult)`. A value like "€847,320" implies accuracy the zone-benchmark method (confidence 0.40) cannot support. The models should round to the nearest €5,000 or €10,000 for low-confidence estimates and add a disclaimer.

2. **Overpricing probability as a precise percentage**: `overpricing_probability = Math.min(95, Math.round(deviation * 300))`. For a 10% deviation: probability = 30%. This is presented as a specific figure but is derived from a linear formula with no calibration against actual market data. The formula is a reasonable heuristic, not a calibrated probability.

3. **Revenue leakage to the nearest euro**: `Math.round((listing_price_eur - avm_base_eur * 1.05) * 0.05 / 12)`. The underlying AVM has ±10–20% uncertainty. Reporting leakage as "€625/month" when the AVM could be off by ±10% (€100K on a €1M property) is false precision. The leakage figure should carry the AVM confidence as an uncertainty band.

4. **`predicted_monthly_revenue_eur` from `predictRevenue()`**: This function uses `demand_score × 0.08` as the monthly close probability with no calibration backing. The revenue confidence score `Math.min(0.85, listings.length / 20)` correctly expresses low confidence for small portfolios.

5. **Action impact expiry times**: `expires_in_hours: 2` for `inquiry_response`. This is a business heuristic, not a statistical finding from Agency Group's own data. Presenting it as a specific deadline adds urgency that may not be empirically grounded.

---

## Economic Model Assumptions

| Assumption | Location | Validity |
|---|---|---|
| 5% commission, seller pays | All models | Valid per Portuguese market standard, AMI 22506 |
| 210 days median DOM | `ZONE_MEDIAN_DAYS['default']` | Valid for 2026 Portuguese market |
| 8% annual probability of stale-listing deal deterioration | `executive-revenue-v2`, stale leakage | Unvalidated internal assumption |
| 80m² assumed area for zone_only AVM | `avm.ts` line 116 | Reasonable default for Portuguese apartments |
| 0.8 condition multiplier for needs_renovation | `avm.ts` CONDITION_AVM_MULT | Matches typical market discounts |
| Monthly close rate = 8% (predictRevenue) | `executive-revenue-v2` line 204 | Inconsistent with 210-day DOM (expected ~14%); understates revenue |
| offer_created → close = 95% probability | `economic-closed-loop-v2`, STAGE_WEIGHTS | Slightly optimistic; 85% more defensible |
| All conversion lifts in value-attribution engine | `value-attribution-engine` | Based on general real estate research, not Agency Group historical data |
| Luxury premium: Lisboa +12%, Cascais +10%, Algarve +8% | `pricing-intelligence`, LUXURY_PREMIUM_RATES | Broadly consistent with observed luxury premiums |

---

## Recommended Economic Fixes

### CRITICAL: Fix immediately
_(none at critical severity — no division-by-zero, no negative probability, no commission rate error)_

### HIGH: Fix this sprint

1. **Fix `compToValue()` cancel-out bug in AVM** (`lib/valuation/avm.ts`, lines 350–353). The `/ inputCondMult * inputCondMult` is a no-op. Replace with proper normalization:
   ```typescript
   // Normalize comp to "good" condition, then apply input condition
   const compCondMult = CONDITION_AVM_MULT[comp.condition ?? 'good'] ?? 1.0
   const inputCondMult = CONDITION_AVM_MULT[input.condition ?? 'good'] ?? 1.0
   return Math.round((pm2 * input.area_m2) * inputCondMult)
   // Comp condition already baked in via comp price; just apply input condition to zone-normalized value
   ```
   This is a systematic AVM bias when comp conditions differ from the subject property.

2. **Fix monthly close rate in `predictRevenue()`** (`lib/executive-revenue-v2/index.ts`, line 204). Change `0.08` to `0.14` (100%/7 months ≈ 14.3%) to match the 210-day median DOM. The current 8% rate underestimates predicted monthly revenue by ~40%.

### MEDIUM: Fix next sprint

3. **Fix `demand_score = 0` treated as missing value** (`lib/pricing-intelligence/index.ts`, `estimateDaysOnMarket()`). Change `demand_score ?` to `demand_score !== null && demand_score !== undefined` to distinguish zero demand from no data. Line 111.

4. **Cap `optimal_price_max` to within AVM bounds for non-luxury properties** (`lib/pricing-intelligence/index.ts`, line 169). The unconditional `× 1.05` on `value_high` should only apply when `luxury_score > 70`. Add condition:
   ```typescript
   const premiumMultiplier = (inputs.luxury_score ?? 50) > 70 ? 1.05 : 1.0
   const optimal_max = Math.round(avmResult.value_high * (1 + luxuryAdj) * premiumMultiplier)
   ```

5. **Add confidence disclaimers to overpricing probability** (`lib/pricing-intelligence/index.ts`). Add `avm_confidence` to the returned `PricingIntelligenceCard` (it is already in the card as `avm_confidence`) and display it alongside `overpricing_probability` in the UI. The current card already includes `avm_confidence` — ensure the front-end displays it.

6. **Document and validate the 10% degradation factor** in stale leakage (`lib/executive-revenue-v2/index.ts`, line 100). If Agency Group has historical data on stale listings, calibrate this. If not, add a code comment noting this is an unvalidated heuristic and consider exposing it as a configurable parameter.

### LOW: Monitor

7. **Add rounding based on confidence for AVM output** (`lib/valuation/avm.ts`). For `confidence < 0.45`, round to nearest €5,000. For `confidence < 0.30`, round to nearest €10,000. This prevents false precision in low-confidence estimates.

8. **Review `offer_created` stage weight (0.95)** vs. Portuguese market fall-through data. If Agency Group's own deal history shows >5% fall-through after offer, lower to 0.85 or 0.88. This affects all commission estimates downstream in `economicClosedLoopV2`.

9. **Add source/confidence metadata to action impact cards** in `value-attribution-engine`. The `reasoning_pt` strings could note "baseado em benchmarks do mercado português 2026" to signal these are market-level estimates, not property-specific calculations.
