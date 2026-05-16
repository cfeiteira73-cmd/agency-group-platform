// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'

export interface HeroRotationState {
  current_hero: string
  next_hero: string
  rotation_interval_hours: number
  last_rotated_at: Date
  rotation_count: number
  performance_data: Record<string, { ctr: number; inquiries: number }>
}

const DEFAULT_INTERVAL_HOURS = 8

class HeroRotationController {
  private static instance: HeroRotationController
  private states = new Map<string, HeroRotationState>()
  private candidates = new Map<string, string[]>()

  private constructor() {}

  static getInstance(): HeroRotationController {
    if (!HeroRotationController.instance) {
      HeroRotationController.instance = new HeroRotationController()
    }
    return HeroRotationController.instance
  }

  private selectBestCandidate(
    candidateIds: string[],
    excludeId: string,
    performanceData: Record<string, { ctr: number; inquiries: number }>
  ): string {
    const pool = candidateIds.filter((id) => id !== excludeId)
    if (pool.length === 0) return excludeId

    pool.sort((a, b) => {
      const pa = performanceData[a]
      const pb = performanceData[b]
      const scoreA = (pa?.ctr ?? 0) * 0.6 + (pa?.inquiries ?? 0) * 0.4
      const scoreB = (pb?.ctr ?? 0) * 0.6 + (pb?.inquiries ?? 0) * 0.4
      return scoreB - scoreA
    })

    return pool[0]
  }

  setCandidates(orgId: string, submissionIds: string[]): void {
    this.candidates.set(orgId, submissionIds)
  }

  async getCurrentHero(orgId: string): Promise<string> {
    const state = this.states.get(orgId)
    if (!state) {
      const pool = this.candidates.get(orgId) ?? []
      return pool[0] ?? ''
    }

    const intervalMs = state.rotation_interval_hours * 60 * 60 * 1000
    const elapsed = Date.now() - state.last_rotated_at.getTime()
    if (elapsed >= intervalMs) {
      const rotated = await this.rotate(orgId)
      return rotated.current_hero
    }

    return state.current_hero
  }

  async rotate(orgId: string): Promise<HeroRotationState> {
    const pool = this.candidates.get(orgId) ?? []
    const existing = this.states.get(orgId)
    const performanceData = existing?.performance_data ?? {}

    const current = existing?.next_hero ?? pool[0] ?? ''
    const next = this.selectBestCandidate(pool, current, performanceData)

    const newState: HeroRotationState = {
      current_hero: current,
      next_hero: next,
      rotation_interval_hours: existing?.rotation_interval_hours ?? DEFAULT_INTERVAL_HOURS,
      last_rotated_at: new Date(),
      rotation_count: (existing?.rotation_count ?? 0) + 1,
      performance_data: performanceData,
    }

    this.states.set(orgId, newState)

    logger.info('[HeroRotationController] rotated', {
      orgId,
      new_hero: current,
      next_hero: next,
      rotation_count: newState.rotation_count,
    })

    return newState
  }

  recordHeroPerformance(
    orgId: string,
    submissionId: string,
    ctr: number,
    inquiries: number
  ): void {
    const state = this.states.get(orgId)
    const performanceData = state?.performance_data ?? {}

    const existing = performanceData[submissionId] ?? { ctr: 0, inquiries: 0 }
    performanceData[submissionId] = {
      ctr: (existing.ctr + ctr) / 2,
      inquiries: existing.inquiries + inquiries,
    }

    if (state) {
      this.states.set(orgId, { ...state, performance_data: performanceData })
    }

    logger.info('[HeroRotationController] performance recorded', {
      orgId,
      submission_id: submissionId,
      ctr,
      inquiries,
    })
  }
}

export const heroRotationController = HeroRotationController.getInstance()
