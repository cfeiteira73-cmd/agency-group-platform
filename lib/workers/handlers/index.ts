// Agency Group — Worker Handler Registry
// lib/workers/handlers/index.ts
//
// Exports all handlers and provides registerAllHandlers() to wire them
// into the processor's handler Map at startup.
// TypeScript strict — 0 errors

import { registerWorkerHandler } from '../processor'

import { scoringHandler }     from './scoringHandler'
import { enrichmentHandler }  from './enrichmentHandler'
import { replayHandler }      from './replayHandler'
import { dlqHandler }         from './dlqHandler'
import { followupHandler }    from './followupHandler'
import { commissionHandler }       from './commissionHandler'
import { marketIntelligenceHandler } from './marketIntelligenceHandler'

export type { ScoringJobPayload }    from './scoringHandler'
export type { EnrichmentJobPayload } from './enrichmentHandler'
export type { ReplayJobPayload }     from './replayHandler'
export type { DlqJobPayload }        from './dlqHandler'
export type { FollowupJobPayload }   from './followupHandler'
export type { CommissionJobPayload }           from './commissionHandler'
export type { MarketIntelligenceJobPayload }    from './marketIntelligenceHandler'

export {
  scoringHandler,
  enrichmentHandler,
  replayHandler,
  dlqHandler,
  followupHandler,
  commissionHandler,
  marketIntelligenceHandler,
}

/**
 * Register all worker handlers with the processor.
 * Call once at app startup (e.g., in a route module or a server-side init file).
 * Safe to call multiple times — Map.set overwrites with the same value.
 */
export function registerAllHandlers(): void {
  registerWorkerHandler('scoring',       scoringHandler)
  registerWorkerHandler('enrichment',    enrichmentHandler)
  registerWorkerHandler('replay',        replayHandler)
  registerWorkerHandler('dlq-processor', dlqHandler)
  registerWorkerHandler('followup',      followupHandler)
  registerWorkerHandler('commission',          commissionHandler)
  registerWorkerHandler('market-intelligence', marketIntelligenceHandler)
}
