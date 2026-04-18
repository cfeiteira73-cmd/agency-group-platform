// deltaHelpers.ts
// Tiny render-helpers for ScoreDelta trend badges.
// Pure functions, no React imports, no side-effects.

import type { ScoreDelta, ScoreTrend } from './scoringMemory'

export interface DeltaBadgeConfig {
  symbol: string   // '▲' | '▼' | '→' | 'NEW'
  label: string    // e.g. '+12pts' or '-5pts' or '→' or 'NOVO'
  color: string    // CSS color string
  show: boolean    // false when trend==='new' and no previous
}

export function getDeltaBadge(delta: ScoreDelta | null | undefined): DeltaBadgeConfig {
  if (!delta || delta.trend === 'new') {
    return { symbol: '●', label: 'NOVO', color: 'rgba(201,169,110,.7)', show: false }
  }
  if (delta.trend === 'improving') {
    const pts = delta.delta !== null ? `+${delta.delta}pts` : ''
    return { symbol: '▲', label: pts, color: '#6fcf97', show: true }
  }
  if (delta.trend === 'declining') {
    const pts = delta.delta !== null ? `${delta.delta}pts` : ''
    return { symbol: '▼', label: pts, color: '#ef4444', show: true }
  }
  // stable
  return { symbol: '→', label: 'estável', color: 'rgba(244,240,230,.4)', show: true }
}
