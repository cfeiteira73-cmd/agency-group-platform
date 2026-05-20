// =============================================================================
// AGENCY GROUP — Event Producers v1.0
// Type-safe factory functions — one per event type
// Use eventBus.publish(producers.leadCreated(...)) pattern
// AMI: 22506
// =============================================================================

import { eventBus } from './bus'
import type {
  EventType,
  LeadCreatedEvent, DealCreatedEvent, DealStageAdvancedEvent,
  MatchCreatedEvent, DistributionSentEvent, DistributionAcceptedEvent,
  DistributionRejectedEvent, ModelPromotedEvent, RollbackTriggeredEvent,
  GovernanceOverrideEvent, LeakageDetectedEvent, ClientMilestoneReachedEvent,
  ReferralCreatedEvent, AnomalyDetectedEvent, ProposalSentEvent,
  CpcvSignedEvent, DealClosedEvent, DealRejectedEvent, CallBookedEvent,
  LeadScoredEvent,
  // Wave 19 — new event types
  PropertyIngestedEvent, PropertyScoredEvent, LeadQualifiedEvent,
  DealUpdatedEvent, RevenueRecognizedEvent,
  AIRequestedEvent, AIExecutedEvent, AIBilledEvent,
  SystemFailureEvent, SystemRecoveryEvent,
  CommissionCalculatedEvent, InvestorCreatedEvent, PropertyNormalizedEvent,
  PropertyEnrichedEvent, MarketSnapshotGeneratedEvent, DealLineageTracedEvent,
} from './types'

type Ctx = { correlation_id?: string | null; source_system?: 'api' | 'n8n' | 'cron' | 'engine' | 'agent' }

const base = (type: EventType, ctx: Ctx) => eventBus.createBase(type, ctx)

export const producers = {
  leadCreated:            (p: LeadCreatedEvent['payload'],            ctx: Ctx = {}) => ({ event_type: 'lead_created'             as const, ...base('lead_created', ctx),             payload: p } satisfies LeadCreatedEvent),
  dealCreated:            (p: DealCreatedEvent['payload'],            ctx: Ctx = {}) => ({ event_type: 'deal_created'             as const, ...base('deal_created', ctx),             payload: p } satisfies DealCreatedEvent),
  dealStageAdvanced:      (p: DealStageAdvancedEvent['payload'],      ctx: Ctx = {}) => ({ event_type: 'deal_stage_advanced'      as const, ...base('deal_stage_advanced', ctx),      payload: p } satisfies DealStageAdvancedEvent),
  matchCreated:           (p: MatchCreatedEvent['payload'],           ctx: Ctx = {}) => ({ event_type: 'match_created'            as const, ...base('match_created', ctx),            payload: p } satisfies MatchCreatedEvent),
  distributionSent:       (p: DistributionSentEvent['payload'],       ctx: Ctx = {}) => ({ event_type: 'distribution_sent'        as const, ...base('distribution_sent', ctx),        payload: p } satisfies DistributionSentEvent),
  distributionAccepted:   (p: DistributionAcceptedEvent['payload'],   ctx: Ctx = {}) => ({ event_type: 'distribution_accepted'    as const, ...base('distribution_accepted', ctx),    payload: p } satisfies DistributionAcceptedEvent),
  distributionRejected:   (p: DistributionRejectedEvent['payload'],   ctx: Ctx = {}) => ({ event_type: 'distribution_rejected'    as const, ...base('distribution_rejected', ctx),    payload: p } satisfies DistributionRejectedEvent),
  modelPromoted:          (p: ModelPromotedEvent['payload'],          ctx: Ctx = {}) => ({ event_type: 'model_promoted'           as const, ...base('model_promoted', ctx),           payload: p } satisfies ModelPromotedEvent),
  rollbackTriggered:      (p: RollbackTriggeredEvent['payload'],      ctx: Ctx = {}) => ({ event_type: 'rollback_triggered'       as const, ...base('rollback_triggered', ctx),       payload: p } satisfies RollbackTriggeredEvent),
  governanceOverride:     (p: GovernanceOverrideEvent['payload'],     ctx: Ctx = {}) => ({ event_type: 'governance_override'      as const, ...base('governance_override', ctx),      payload: p } satisfies GovernanceOverrideEvent),
  leakageDetected:        (p: LeakageDetectedEvent['payload'],        ctx: Ctx = {}) => ({ event_type: 'leakage_detected'         as const, ...base('leakage_detected', ctx),         payload: p } satisfies LeakageDetectedEvent),
  clientMilestoneReached: (p: ClientMilestoneReachedEvent['payload'], ctx: Ctx = {}) => ({ event_type: 'client_milestone_reached' as const, ...base('client_milestone_reached', ctx), payload: p } satisfies ClientMilestoneReachedEvent),
  referralCreated:        (p: ReferralCreatedEvent['payload'],        ctx: Ctx = {}) => ({ event_type: 'referral_created'         as const, ...base('referral_created', ctx),         payload: p } satisfies ReferralCreatedEvent),
  anomalyDetected:        (p: AnomalyDetectedEvent['payload'],        ctx: Ctx = {}) => ({ event_type: 'anomaly_detected'         as const, ...base('anomaly_detected', ctx),         payload: p } satisfies AnomalyDetectedEvent),
  proposalSent:           (p: ProposalSentEvent['payload'],           ctx: Ctx = {}) => ({ event_type: 'proposal_sent'            as const, ...base('proposal_sent', ctx),            payload: p } satisfies ProposalSentEvent),
  cpcvSigned:             (p: CpcvSignedEvent['payload'],             ctx: Ctx = {}) => ({ event_type: 'cpcv_signed'              as const, ...base('cpcv_signed', ctx),              payload: p } satisfies CpcvSignedEvent),
  dealClosed:             (p: DealClosedEvent['payload'],             ctx: Ctx = {}) => ({ event_type: 'deal_closed'              as const, ...base('deal_closed', ctx),              payload: p } satisfies DealClosedEvent),
  dealRejected:           (p: DealRejectedEvent['payload'],           ctx: Ctx = {}) => ({ event_type: 'deal_rejected'            as const, ...base('deal_rejected', ctx),            payload: p } satisfies DealRejectedEvent),
  callBooked:             (p: CallBookedEvent['payload'],             ctx: Ctx = {}) => ({ event_type: 'call_booked'              as const, ...base('call_booked', ctx),              payload: p } satisfies CallBookedEvent),
  leadScored:             (p: LeadScoredEvent['payload'],             ctx: Ctx = {}) => ({ event_type: 'lead_scored'              as const, ...base('lead_scored', ctx),              payload: p } satisfies LeadScoredEvent),
  // Wave 19 — Compass-level event backbone
  propertyIngested:       (p: PropertyIngestedEvent['payload'],       ctx: Ctx = {}) => ({ event_type: 'property_ingested'        as const, ...base('property_ingested', ctx),        payload: p } satisfies PropertyIngestedEvent),
  propertyScored:         (p: PropertyScoredEvent['payload'],         ctx: Ctx = {}) => ({ event_type: 'property_scored'          as const, ...base('property_scored', ctx),          payload: p } satisfies PropertyScoredEvent),
  leadQualified:          (p: LeadQualifiedEvent['payload'],          ctx: Ctx = {}) => ({ event_type: 'lead_qualified'           as const, ...base('lead_qualified', ctx),           payload: p } satisfies LeadQualifiedEvent),
  dealUpdated:            (p: DealUpdatedEvent['payload'],            ctx: Ctx = {}) => ({ event_type: 'deal_updated'             as const, ...base('deal_updated', ctx),             payload: p } satisfies DealUpdatedEvent),
  revenueRecognized:      (p: RevenueRecognizedEvent['payload'],      ctx: Ctx = {}) => ({ event_type: 'revenue_recognized'       as const, ...base('revenue_recognized', ctx),       payload: p } satisfies RevenueRecognizedEvent),
  aiRequested:            (p: AIRequestedEvent['payload'],            ctx: Ctx = {}) => ({ event_type: 'ai_requested'             as const, ...base('ai_requested', ctx),             payload: p } satisfies AIRequestedEvent),
  aiExecuted:             (p: AIExecutedEvent['payload'],             ctx: Ctx = {}) => ({ event_type: 'ai_executed'              as const, ...base('ai_executed', ctx),              payload: p } satisfies AIExecutedEvent),
  aiBilled:               (p: AIBilledEvent['payload'],               ctx: Ctx = {}) => ({ event_type: 'ai_billed'                as const, ...base('ai_billed', ctx),                payload: p } satisfies AIBilledEvent),
  systemFailure:          (p: SystemFailureEvent['payload'],          ctx: Ctx = {}) => ({ event_type: 'system_failure'           as const, ...base('system_failure', ctx),           payload: p } satisfies SystemFailureEvent),
  systemRecovery:         (p: SystemRecoveryEvent['payload'],         ctx: Ctx = {}) => ({ event_type: 'system_recovery'          as const, ...base('system_recovery', ctx),          payload: p } satisfies SystemRecoveryEvent),
  // Wave 22 — European Intelligence Infrastructure
  commissionCalculated:    (p: CommissionCalculatedEvent['payload'],    ctx: Ctx = {}) => ({ event_type: 'commission_calculated'    as const, ...base('commission_calculated', ctx),    payload: p } satisfies CommissionCalculatedEvent),
  investorCreated:         (p: InvestorCreatedEvent['payload'],         ctx: Ctx = {}) => ({ event_type: 'investor_created'         as const, ...base('investor_created', ctx),         payload: p } satisfies InvestorCreatedEvent),
  propertyNormalized:      (p: PropertyNormalizedEvent['payload'],      ctx: Ctx = {}) => ({ event_type: 'property_normalized'      as const, ...base('property_normalized', ctx),      payload: p } satisfies PropertyNormalizedEvent),
  propertyEnriched:        (p: PropertyEnrichedEvent['payload'],        ctx: Ctx = {}) => ({ event_type: 'property_enriched'        as const, ...base('property_enriched', ctx),        payload: p } satisfies PropertyEnrichedEvent),
  marketSnapshotGenerated: (p: MarketSnapshotGeneratedEvent['payload'], ctx: Ctx = {}) => ({ event_type: 'market_snapshot_generated' as const, ...base('market_snapshot_generated', ctx), payload: p } satisfies MarketSnapshotGeneratedEvent),
  dealLineageTraced:       (p: DealLineageTracedEvent['payload'],       ctx: Ctx = {}) => ({ event_type: 'deal_lineage_traced'      as const, ...base('deal_lineage_traced', ctx),      payload: p } satisfies DealLineageTracedEvent),
}

/** Convenience: produce + publish in one call */
export const emit = {
  leadCreated:            async (p: LeadCreatedEvent['payload'],            ctx?: Ctx) => void eventBus.publish(producers.leadCreated(p, ctx)),
  dealCreated:            async (p: DealCreatedEvent['payload'],            ctx?: Ctx) => void eventBus.publish(producers.dealCreated(p, ctx)),
  dealStageAdvanced:      async (p: DealStageAdvancedEvent['payload'],      ctx?: Ctx) => void eventBus.publish(producers.dealStageAdvanced(p, ctx)),
  matchCreated:           async (p: MatchCreatedEvent['payload'],           ctx?: Ctx) => void eventBus.publish(producers.matchCreated(p, ctx)),
  distributionSent:       async (p: DistributionSentEvent['payload'],       ctx?: Ctx) => void eventBus.publish(producers.distributionSent(p, ctx)),
  distributionAccepted:   async (p: DistributionAcceptedEvent['payload'],   ctx?: Ctx) => void eventBus.publish(producers.distributionAccepted(p, ctx)),
  distributionRejected:   async (p: DistributionRejectedEvent['payload'],   ctx?: Ctx) => void eventBus.publish(producers.distributionRejected(p, ctx)),
  modelPromoted:          async (p: ModelPromotedEvent['payload'],          ctx?: Ctx) => void eventBus.publish(producers.modelPromoted(p, ctx)),
  rollbackTriggered:      async (p: RollbackTriggeredEvent['payload'],      ctx?: Ctx) => void eventBus.publish(producers.rollbackTriggered(p, ctx)),
  governanceOverride:     async (p: GovernanceOverrideEvent['payload'],     ctx?: Ctx) => void eventBus.publish(producers.governanceOverride(p, ctx)),
  leakageDetected:        async (p: LeakageDetectedEvent['payload'],        ctx?: Ctx) => void eventBus.publish(producers.leakageDetected(p, ctx)),
  clientMilestoneReached: async (p: ClientMilestoneReachedEvent['payload'], ctx?: Ctx) => void eventBus.publish(producers.clientMilestoneReached(p, ctx)),
  referralCreated:        async (p: ReferralCreatedEvent['payload'],        ctx?: Ctx) => void eventBus.publish(producers.referralCreated(p, ctx)),
  anomalyDetected:        async (p: AnomalyDetectedEvent['payload'],        ctx?: Ctx) => void eventBus.publish(producers.anomalyDetected(p, ctx)),
  proposalSent:           async (p: ProposalSentEvent['payload'],           ctx?: Ctx) => void eventBus.publish(producers.proposalSent(p, ctx)),
  cpcvSigned:             async (p: CpcvSignedEvent['payload'],             ctx?: Ctx) => void eventBus.publish(producers.cpcvSigned(p, ctx)),
  dealClosed:             async (p: DealClosedEvent['payload'],             ctx?: Ctx) => void eventBus.publish(producers.dealClosed(p, ctx)),
  dealRejected:           async (p: DealRejectedEvent['payload'],           ctx?: Ctx) => void eventBus.publish(producers.dealRejected(p, ctx)),
  callBooked:             async (p: CallBookedEvent['payload'],             ctx?: Ctx) => void eventBus.publish(producers.callBooked(p, ctx)),
  leadScored:             async (p: LeadScoredEvent['payload'],             ctx?: Ctx) => void eventBus.publish(producers.leadScored(p, ctx)),
  // Wave 19 — Compass-level event backbone
  propertyIngested:       async (p: PropertyIngestedEvent['payload'],       ctx?: Ctx) => void eventBus.publish(producers.propertyIngested(p, ctx)),
  propertyScored:         async (p: PropertyScoredEvent['payload'],         ctx?: Ctx) => void eventBus.publish(producers.propertyScored(p, ctx)),
  leadQualified:          async (p: LeadQualifiedEvent['payload'],          ctx?: Ctx) => void eventBus.publish(producers.leadQualified(p, ctx)),
  dealUpdated:            async (p: DealUpdatedEvent['payload'],            ctx?: Ctx) => void eventBus.publish(producers.dealUpdated(p, ctx)),
  revenueRecognized:      async (p: RevenueRecognizedEvent['payload'],      ctx?: Ctx) => void eventBus.publish(producers.revenueRecognized(p, ctx)),
  aiRequested:            async (p: AIRequestedEvent['payload'],            ctx?: Ctx) => void eventBus.publish(producers.aiRequested(p, ctx)),
  aiExecuted:             async (p: AIExecutedEvent['payload'],             ctx?: Ctx) => void eventBus.publish(producers.aiExecuted(p, ctx)),
  aiBilled:               async (p: AIBilledEvent['payload'],               ctx?: Ctx) => void eventBus.publish(producers.aiBilled(p, ctx)),
  systemFailure:          async (p: SystemFailureEvent['payload'],          ctx?: Ctx) => void eventBus.publish(producers.systemFailure(p, ctx)),
  systemRecovery:         async (p: SystemRecoveryEvent['payload'],         ctx?: Ctx) => void eventBus.publish(producers.systemRecovery(p, ctx)),
  // Wave 22 — European Intelligence Infrastructure
  commissionCalculated:    async (p: CommissionCalculatedEvent['payload'],    ctx?: Ctx) => void eventBus.publish(producers.commissionCalculated(p, ctx)),
  investorCreated:         async (p: InvestorCreatedEvent['payload'],         ctx?: Ctx) => void eventBus.publish(producers.investorCreated(p, ctx)),
  propertyNormalized:      async (p: PropertyNormalizedEvent['payload'],      ctx?: Ctx) => void eventBus.publish(producers.propertyNormalized(p, ctx)),
  propertyEnriched:        async (p: PropertyEnrichedEvent['payload'],        ctx?: Ctx) => void eventBus.publish(producers.propertyEnriched(p, ctx)),
  marketSnapshotGenerated: async (p: MarketSnapshotGeneratedEvent['payload'], ctx?: Ctx) => void eventBus.publish(producers.marketSnapshotGenerated(p, ctx)),
  dealLineageTraced:       async (p: DealLineageTracedEvent['payload'],       ctx?: Ctx) => void eventBus.publish(producers.dealLineageTraced(p, ctx)),
}
