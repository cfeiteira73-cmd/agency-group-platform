// =============================================================================
// Agency Group — Observability barrel export
// lib/observability/index.ts
//
// Re-exports the full public surface of the observability layer:
//   - Correlation ID generation, extraction, and propagation
//   - Business telemetry (events, API routes, revenue, AI, circuit breakers)
//
// Usage:
//   import { generateCorrelationId, trackBusinessEvent } from '@/lib/observability'
// =============================================================================

export {
  generateCorrelationId,
  getRequestCorrelationId,
  getHeaderCorrelationId,
  buildCorrelationHeaders,
  withCorrelation,
  cronCorrelationId,
  shortCorrelationId,
} from './correlation'

export {
  trackBusinessEvent,
  trackApiRoute,
  trackRevenueEvent,
  trackAICall,
  trackCircuitBreaker,
} from './telemetry'

export {
  getUnifiedTimeline,
  type TimelineEntry,
  type UnifiedTimelineRequest,
} from './unifiedTimeline'

export {
  getSystemTimeline,
  type ObservabilityMode,
  type KernelTimelineRequest,
  type KernelTimelineResponse,
} from './kernel'
