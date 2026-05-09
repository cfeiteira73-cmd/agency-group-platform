// =============================================================================
// AGENCY GROUP — Event Producers v1.0
// Type-safe factory functions — one per event type
// Use eventBus.publish(producers.leadCreated(...)) pattern
// AMI: 22506
// =============================================================================

import { eventBus } from './bus'
import type {
  LeadCreatedEvent, DealCreatedEvent, DealStageAdvancedEvent,
  MatchCreatedEvent, DistributionSentEvent, DistributionAcceptedEvent,
  DistributionRejectedEvent, ModelPromotedEvent, RollbackTriggeredEvent,
  GovernanceOverrideEvent, LeakageDetectedEvent, ClientMilestoneReachedEvent,
  ReferralCreatedEvent, AnomalyDetectedEvent, ProposalSentEvent,
  CpcvSignedEvent, DealClosedEvent, DealRejectedEvent, CallBookedEvent,
  LeadScoredEvent,
} from './types'

type Ctx = { correlation_id?: string | null; source_system?: 'api' | 'n8n' | 'cron' | 'engine' | 'agent' }

const base = (type: LeadCreatedEvent['event_type'] | DealCreatedEvent['event_type'] | DealStageAdvancedEvent['event_type'] | MatchCreatedEvent['event_type'] | DistributionSentEvent['event_type'] | DistributionAcceptedEvent['event_type'] | DistributionRejectedEvent['event_type'] | ModelPromotedEvent['event_type'] | RollbackTriggeredEvent['event_type'] | GovernanceOverrideEvent['event_type'] | LeakageDetectedEvent['event_type'] | ClientMilestoneReachedEvent['event_type'] | ReferralCreatedEvent['event_type'] | AnomalyDetectedEvent['event_type'] | ProposalSentEvent['event_type'] | CpcvSignedEvent['event_type'] | DealClosedEvent['event_type'] | DealRejectedEvent['event_type'] | CallBookedEvent['event_type'] | LeadScoredEvent['event_type'], ctx: Ctx) =>
  eventBus.createBase(type, ctx)

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
}
