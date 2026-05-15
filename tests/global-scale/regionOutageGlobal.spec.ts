// AGENCY GROUP — SH-ROS Global Scale | AMI: 22506
// regionOutageGlobal.spec.ts — Multi-region outage simulation
import { describe, it, expect, vi, beforeEach } from 'vitest'

const REGIONS = ['eu-west', 'us-east', 'ap-south'] as const
type Region = typeof REGIONS[number]
type CircuitState = 'closed' | 'open' | 'half-open'
type SystemStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL'

interface RegionHealth {
  region: Region
  healthyWorkers: number
  totalWorkers: number
  available: boolean
}

interface CircuitBreaker {
  region: Region
  state: CircuitState
  consecutiveErrors: number
  lastErrorAt: number
  lastSuccessAt: number
}

// Build a multi-region circuit breaker system
function buildRegionController() {
  const regions: Record<Region, RegionHealth> = {
    'eu-west':  { region: 'eu-west',  healthyWorkers: 8,  totalWorkers: 8,  available: true },
    'us-east':  { region: 'us-east',  healthyWorkers: 8,  totalWorkers: 8,  available: true },
    'ap-south': { region: 'ap-south', healthyWorkers: 8,  totalWorkers: 8,  available: true },
  }

  const breakers: Record<Region, CircuitBreaker> = {
    'eu-west':  { region: 'eu-west',  state: 'closed', consecutiveErrors: 0, lastErrorAt: 0, lastSuccessAt: Date.now() },
    'us-east':  { region: 'us-east',  state: 'closed', consecutiveErrors: 0, lastErrorAt: 0, lastSuccessAt: Date.now() },
    'ap-south': { region: 'ap-south', state: 'closed', consecutiveErrors: 0, lastErrorAt: 0, lastSuccessAt: Date.now() },
  }

  const OPEN_THRESHOLD = 5       // errors before open
  const HALF_OPEN_AFTER_MS = 30_000
  const replayAuthBlocked = new Set<Region>()
  let primaryRegion: Region = 'eu-west'

  function recordError(region: Region, now: number): CircuitState {
    const b = breakers[region]
    b.consecutiveErrors++
    b.lastErrorAt = now

    if (b.consecutiveErrors >= OPEN_THRESHOLD && b.state === 'closed') {
      b.state = 'open'
      regions[region].available = false
    }
    return b.state
  }

  function recordSuccess(region: Region, now: number): CircuitState {
    const b = breakers[region]
    b.consecutiveErrors = 0
    b.lastSuccessAt = now
    if (b.state === 'half-open') {
      b.state = 'closed'
      regions[region].available = true
    }
    return b.state
  }

  function tryHalfOpen(region: Region, now: number): boolean {
    const b = breakers[region]
    if (b.state === 'open' && (now - b.lastErrorAt) >= HALF_OPEN_AFTER_MS) {
      b.state = 'half-open'
      return true
    }
    return false
  }

  function routeRequest(now: number): Region | null {
    // Try current primary
    if (regions[primaryRegion].available && breakers[primaryRegion].state === 'closed') {
      return primaryRegion
    }
    // Failover: find first available non-primary
    for (const r of REGIONS) {
      if (r !== primaryRegion && regions[r].available && breakers[r].state === 'closed') {
        return r
      }
    }
    // Try half-open regions
    for (const r of REGIONS) {
      if (breakers[r].state === 'half-open') return r
    }
    return null
  }

  function blockReplayAuth(region: Region) {
    replayAuthBlocked.add(region)
  }

  function unblockReplayAuth(region: Region) {
    replayAuthBlocked.delete(region)
  }

  function isReplayAuthBlocked(region: Region): boolean {
    return replayAuthBlocked.has(region)
  }

  function systemStatus(): SystemStatus {
    const available = REGIONS.filter(r => regions[r].available).length
    if (available === REGIONS.length) return 'HEALTHY'
    if (available === 0) return 'CRITICAL'
    return available === 1 ? 'CRITICAL' : 'DEGRADED'
  }

  function setPrimary(r: Region) { primaryRegion = r }
  function getBreaker(r: Region) { return breakers[r] }
  function getRegion(r: Region) { return regions[r] }
  function killWorkers(r: Region, count: number) {
    regions[r].healthyWorkers = Math.max(0, regions[r].healthyWorkers - count)
    if (regions[r].healthyWorkers === 0) regions[r].available = false
  }
  function restoreWorkers(r: Region, count: number) {
    regions[r].healthyWorkers = Math.min(regions[r].totalWorkers, regions[r].healthyWorkers + count)
    if (regions[r].healthyWorkers > 0) regions[r].available = true
  }

  return {
    recordError, recordSuccess, tryHalfOpen,
    routeRequest, blockReplayAuth, unblockReplayAuth, isReplayAuthBlocked,
    systemStatus, setPrimary, getBreaker, getRegion, killWorkers, restoreWorkers,
  }
}

describe('Global Scale: Multi-Region Outage Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('circuit breaker opens after 5 consecutive errors from eu-west', () => {
    const ctrl = buildRegionController()
    const now = Date.now()

    // 4 errors — breaker still closed
    for (let i = 0; i < 4; i++) {
      const state = ctrl.recordError('eu-west', now + i * 100)
      expect(state).toBe('closed')
    }

    // 5th error — breaker opens
    const state5 = ctrl.recordError('eu-west', now + 500)
    expect(state5).toBe('open')
    expect(ctrl.getBreaker('eu-west').state).toBe('open')
    expect(ctrl.getRegion('eu-west').available).toBe(false)
  })

  it('traffic reroutes to us-east within simulated 30s failover window', () => {
    const ctrl = buildRegionController()
    const now = Date.now()

    // Bring eu-west down: 5 errors → circuit opens
    for (let i = 0; i < 5; i++) ctrl.recordError('eu-west', now + i * 100)
    expect(ctrl.getBreaker('eu-west').state).toBe('open')
    expect(ctrl.getRegion('eu-west').available).toBe(false)

    // Block replay auth on downed region
    ctrl.blockReplayAuth('eu-west')
    expect(ctrl.isReplayAuthBlocked('eu-west')).toBe(true)

    // Request routing should now land on us-east or ap-south
    const routed = ctrl.routeRequest(now + 1000)
    expect(routed).not.toBeNull()
    expect(routed).not.toBe('eu-west')
    expect(['us-east', 'ap-south']).toContain(routed)

    // Verify us-east is still healthy
    expect(ctrl.getRegion('us-east').available).toBe(true)
    expect(ctrl.getBreaker('us-east').state).toBe('closed')
  })

  it('2-region simultaneous outage drives system to CRITICAL status', () => {
    const ctrl = buildRegionController()
    const now = Date.now()

    // Take down eu-west and us-east
    for (let i = 0; i < 5; i++) ctrl.recordError('eu-west', now + i)
    for (let i = 0; i < 5; i++) ctrl.recordError('us-east', now + i)

    expect(ctrl.getBreaker('eu-west').state).toBe('open')
    expect(ctrl.getBreaker('us-east').state).toBe('open')

    const status = ctrl.systemStatus()
    expect(status).toBe('CRITICAL')

    // Only ap-south still routes
    const routed = ctrl.routeRequest(now + 1000)
    expect(routed).toBe('ap-south')
  })

  it('eu-west recovery: circuit half-open after 30s, closed after success', () => {
    const ctrl = buildRegionController()
    const now = Date.now()

    // Open the eu-west circuit
    for (let i = 0; i < 5; i++) ctrl.recordError('eu-west', now + i * 100)
    expect(ctrl.getBreaker('eu-west').state).toBe('open')

    // 29 seconds later — still open
    const tooEarly = now + 29_000
    const transitioned29 = ctrl.tryHalfOpen('eu-west', tooEarly)
    expect(transitioned29).toBe(false)
    expect(ctrl.getBreaker('eu-west').state).toBe('open')

    // 30 seconds later — transitions to half-open
    const t30s = now + 30_500
    const transitioned30 = ctrl.tryHalfOpen('eu-west', t30s)
    expect(transitioned30).toBe(true)
    expect(ctrl.getBreaker('eu-west').state).toBe('half-open')

    // Probe succeeds → circuit closes
    const finalState = ctrl.recordSuccess('eu-west', t30s + 100)
    expect(finalState).toBe('closed')
    expect(ctrl.getRegion('eu-west').available).toBe(true)

    // Replay auth can now be unblocked
    ctrl.blockReplayAuth('eu-west') // was blocked during outage
    ctrl.unblockReplayAuth('eu-west')
    expect(ctrl.isReplayAuthBlocked('eu-west')).toBe(false)
  })

  it('replay authorization is blocked during region outage and unblocked on recovery', () => {
    const ctrl = buildRegionController()
    const now = Date.now()

    // Outage
    for (let i = 0; i < 5; i++) ctrl.recordError('eu-west', now + i * 50)
    ctrl.blockReplayAuth('eu-west')

    expect(ctrl.isReplayAuthBlocked('eu-west')).toBe(true)
    expect(ctrl.isReplayAuthBlocked('us-east')).toBe(false)   // unaffected
    expect(ctrl.isReplayAuthBlocked('ap-south')).toBe(false)  // unaffected

    // Recovery
    ctrl.tryHalfOpen('eu-west', now + 31_000)
    ctrl.recordSuccess('eu-west', now + 31_100)
    ctrl.unblockReplayAuth('eu-west')

    expect(ctrl.isReplayAuthBlocked('eu-west')).toBe(false)
  })
})
