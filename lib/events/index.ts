// =============================================================================
// AGENCY GROUP — Event Bus Public API
// Usage: import { emit, eventBus, producers } from '@/lib/events'
// =============================================================================

export { eventBus } from './bus'
export { producers, emit } from './producers'
export type { AnyPlatformEvent, EventType, BaseEvent } from './types'
export type * from './types'
