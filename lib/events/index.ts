// =============================================================================
// AGENCY GROUP — Event Bus Public API
// Usage: import { emit, eventBus, producers } from '@/lib/events'
// =============================================================================

export { eventBus } from './bus'
export { producers, emit } from './producers'
export type { AnyPlatformEvent, EventType, BaseEvent } from './types'
export type * from './types'
export { isEventPoisoned } from './bus'
export {
  generatePartitionKey,
  generateReplayToken,
  getNextGlobalSeq,
  enrichEvent,
  getStreamKey,
  getConsumerGroup,
  CURRENT_REGION,
} from './globalOrdering'
export type { StreamPublishResult, StreamEntry, EventStreamBackbone } from './streamBackbone'
export {
  RedisStreamsAdapter,
  InMemoryStreamAdapter,
  KafkaStreamAdapter,
  getStreamBackbone,
} from './streamBackbone'
