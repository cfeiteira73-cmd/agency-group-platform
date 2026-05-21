// Agency Group — RL Reward Function
// lib/ml/rewardFunction.ts
// TypeScript strict — 0 errors
//
// Reinforcement-learning reward signal for property-investor matching.
// Each recommendation action opens an "episode"; when the deal closes (or is
// lost) the episode is completed and a scalar reward in [-0.1, 1] is recorded.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RLAction = 'recommend' | 'rank_high' | 'rank_low' | 'reject'

export interface RLState {
  property_id: string
  investor_id: string
  tenant_id: string
  property_price_eur: number
  investor_capital_available_eur: number | null
  match_score: number
  liquidity_score: number | null
  competition_count: number
  market_phase: 'hot' | 'warm' | 'cold'
  days_on_market: number
}

export interface RLEpisode {
  id: string
  tenant_id: string
  property_id: string
  investor_id: string
  action: RLAction
  state: RLState
  action_taken_at: string
  reward: number | null
  actual_profit_eur: number | null
  time_to_close_days: number | null
  liquidity_efficiency: number | null
  outcome_recorded_at: string | null
  episode_complete: boolean
}

export interface RewardComponents {
  profit_component: number
  speed_component: number
  liquidity_component: number
  total_reward: number
}

export interface DealOutcomeForReward {
  won: boolean
  actual_profit_eur: number
  time_to_close_days: number
  expected_time_to_close_days: number
  max_possible_profit_eur: number
}

export interface RewardSignal {
  episode_id: string
  reward: RewardComponents
  actual_profit_eur: number
  time_to_close_days: number
}

// ---------------------------------------------------------------------------
// computeReward — pure function, no I/O
// ---------------------------------------------------------------------------

export function computeReward(outcome: DealOutcomeForReward): RewardComponents {
  const { won, actual_profit_eur, time_to_close_days, expected_time_to_close_days, max_possible_profit_eur } = outcome

  const profit_component = won
    ? Math.min(1, actual_profit_eur / Math.max(1, max_possible_profit_eur))
    : -0.1

  const speed_component = won
    ? Math.max(0, 1 - (time_to_close_days / Math.max(1, expected_time_to_close_days)) * 0.5)
    : 0

  const liquidity_component = won
    ? Math.max(0, 1 - time_to_close_days / 90)
    : 0

  const total_reward =
    profit_component * 0.6 +
    speed_component * 0.25 +
    liquidity_component * 0.15

  return { profit_component, speed_component, liquidity_component, total_reward }
}

// ---------------------------------------------------------------------------
// createEpisode — insert into rl_episodes, return RLEpisode
// ---------------------------------------------------------------------------

export async function createEpisode(state: RLState, action: RLAction): Promise<RLEpisode> {
  const id  = randomUUID()
  const now = new Date().toISOString()

  const { data, error } = await (supabaseAdmin as any)
    .from('rl_episodes')
    .insert({
      id,
      tenant_id:        state.tenant_id,
      property_id:      state.property_id,
      investor_id:      state.investor_id,
      action,
      state,
      action_taken_at:  now,
      reward:           null,
      actual_profit_eur: null,
      time_to_close_days: null,
      liquidity_efficiency: null,
      outcome_recorded_at: null,
      episode_complete: false,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`[rewardFunction] createEpisode failed: ${error?.message ?? 'no data'}`)
  }

  return rowToEpisode(data)
}

// ---------------------------------------------------------------------------
// recordReward — find open episode, compute reward, complete it
// ---------------------------------------------------------------------------

export async function recordReward(
  propertyId: string,
  investorId: string,
  tenantId: string,
  outcome: DealOutcomeForReward,
): Promise<RewardSignal | null> {
  try {
    // Find the most-recent open episode for this property/tenant pair.
    // investorId may be empty string when called from feedbackLoop; match
    // on property_id + tenant_id first, optionally narrow by investor.
    let query = (supabaseAdmin as any)
      .from('rl_episodes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .eq('episode_complete', false)
      .order('action_taken_at', { ascending: false })
      .limit(1)

    if (investorId) {
      query = query.eq('investor_id', investorId)
    }

    const { data: episodeRows, error: fetchErr } = await query

    if (fetchErr) {
      log.warn('[rewardFunction] recordReward — fetch episode failed', {
        error: fetchErr.message,
        property_id: propertyId,
      } as any)
      return null
    }

    const episodeRow = (episodeRows as Record<string, unknown>[] | null)?.[0]
    if (!episodeRow) {
      // No open episode for this pair — not an error, just nothing to close
      return null
    }

    const episode = rowToEpisode(episodeRow)
    const rewardComponents = computeReward(outcome)
    const now = new Date().toISOString()

    const { error: updateErr } = await (supabaseAdmin as any)
      .from('rl_episodes')
      .update({
        reward:               rewardComponents.total_reward,
        actual_profit_eur:    outcome.actual_profit_eur,
        time_to_close_days:   outcome.time_to_close_days,
        liquidity_efficiency: rewardComponents.liquidity_component,
        outcome_recorded_at:  now,
        episode_complete:     true,
      })
      .eq('id', episode.id)

    if (updateErr) {
      log.warn('[rewardFunction] recordReward — update failed', {
        error:      updateErr.message,
        episode_id: episode.id,
      } as any)
      return null
    }

    log.info('[rewardFunction] recordReward — episode completed', {
      episode_id:    episode.id,
      total_reward:  rewardComponents.total_reward,
      won:           outcome.won,
      profit_eur:    outcome.actual_profit_eur,
      days_to_close: outcome.time_to_close_days,
    } as any)

    return {
      episode_id:        episode.id,
      reward:            rewardComponents,
      actual_profit_eur: outcome.actual_profit_eur,
      time_to_close_days: outcome.time_to_close_days,
    }
  } catch (err) {
    log.error('[rewardFunction] recordReward — unexpected error', err instanceof Error ? err : undefined, {
      property_id: propertyId,
      tenant_id:   tenantId,
    })
    return null
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rowToEpisode(row: Record<string, unknown>): RLEpisode {
  return {
    id:                   row['id'] as string,
    tenant_id:            row['tenant_id'] as string,
    property_id:          row['property_id'] as string,
    investor_id:          row['investor_id'] as string,
    action:               row['action'] as RLAction,
    state:                row['state'] as RLState,
    action_taken_at:      row['action_taken_at'] as string,
    reward:               (row['reward'] as number | null) ?? null,
    actual_profit_eur:    (row['actual_profit_eur'] as number | null) ?? null,
    time_to_close_days:   (row['time_to_close_days'] as number | null) ?? null,
    liquidity_efficiency: (row['liquidity_efficiency'] as number | null) ?? null,
    outcome_recorded_at:  (row['outcome_recorded_at'] as string | null) ?? null,
    episode_complete:     (row['episode_complete'] as boolean) ?? false,
  }
}
