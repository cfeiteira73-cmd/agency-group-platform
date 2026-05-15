// AGENCY GROUP — SH-ROS | AMI: 22506
// Executive Layer — Barrel Export
// AI Executive Layer: Digest · Narrator · Radar · Operations · Forecast · Copilot
// =============================================================================

// ─── Executive Digest ─────────────────────────────────────────────────────────
export { ExecutiveDigestEngine, executiveDigest }    from './executiveDigest'
export type {
  ExecutiveKPI,
  ExecutiveAlert,
  ExecutiveBrief,
}                                                    from './executiveDigest'

// ─── Revenue Narrator ─────────────────────────────────────────────────────────
export { RevenueNarrator, revenueNarrator }          from './revenueNarrator'
export type {
  RevenueMomentum,
  RevenueNarrative,
}                                                    from './revenueNarrator'

// ─── Opportunity Radar ────────────────────────────────────────────────────────
export { OpportunityRadar, opportunityRadar, SIGNAL_TEMPLATES } from './opportunityRadar'
export type {
  RadarSignalType,
  RadarSignal,
  RadarScan,
}                                                    from './opportunityRadar'

// ─── Operational Summarizer ───────────────────────────────────────────────────
export { OperationalSummarizer, operationalSummarizer, STANDARD_INDICATORS } from './operationalSummarizer'
export type {
  HealthStatus,
  HealthIndicator,
  OperationalSummary,
}                                                    from './operationalSummarizer'

// ─── Strategic Forecast Digest ────────────────────────────────────────────────
export { StrategicForecastDigest, strategicForecastDigest } from './strategicForecastDigest'
export type {
  ForecastScenario,
  StrategicForecast,
}                                                    from './strategicForecastDigest'

// ─── Executive Copilot ────────────────────────────────────────────────────────
export { ExecutiveCopilot, executiveCopilot, INTENT_KEYWORDS } from './executiveCopilot'
export type {
  QueryIntent,
  CopilotMessage,
  CopilotSession,
  CopilotResponse,
}                                                    from './executiveCopilot'

// ─── Convenience Layer Object ─────────────────────────────────────────────────
import { executiveDigest as _digest }             from './executiveDigest'
import { revenueNarrator as _narrator }           from './revenueNarrator'
import { opportunityRadar as _radar }             from './opportunityRadar'
import { operationalSummarizer as _ops }          from './operationalSummarizer'
import { strategicForecastDigest as _forecast }   from './strategicForecastDigest'
import { executiveCopilot as _copilot }           from './executiveCopilot'

export const executiveLayer = {
  executiveDigest:         _digest,
  revenueNarrator:         _narrator,
  opportunityRadar:        _radar,
  operationalSummarizer:   _ops,
  strategicForecastDigest: _forecast,
  executiveCopilot:        _copilot,
} as const
