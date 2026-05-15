// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: Adaptive Interface Engine
// Dynamically adjusts UI complexity based on user role and usage count
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type ComplexityLevel = 'simplified' | 'standard' | 'advanced'

export interface InterfaceConfig {
  level: ComplexityLevel
  show_ai_explanations: boolean
  show_raw_scores: boolean
  collapse_secondary_metrics: boolean
  guided_mode: boolean
  max_visible_actions: number
  show_revenue_attribution: boolean
}

// ─── Complexity Thresholds ────────────────────────────────────────────────────

const COMPLEXITY_THRESHOLDS: Record<ComplexityLevel, number> = {
  simplified: 0,
  standard: 10,
  advanced: 50,
}

// ─── Class ────────────────────────────────────────────────────────────────────

class AdaptiveInterfaceEngine {
  getConfig(userId: string, role: string, usageCount: number): InterfaceConfig {
    // Determine level from usage count
    let level: ComplexityLevel = 'simplified'
    if (usageCount >= COMPLEXITY_THRESHOLDS.advanced) {
      level = 'advanced'
    } else if (usageCount >= COMPLEXITY_THRESHOLDS.standard) {
      level = 'standard'
    }

    // Executives always start at standard minimum
    if (role === 'executive' && level === 'simplified') {
      level = 'standard'
    }

    logger.info('[AdaptiveInterface] getConfig', { user_id: userId, role, usage_count: usageCount, level })

    return this._buildConfig(level)
  }

  getConfigForRole(role: 'agent' | 'broker' | 'executive'): InterfaceConfig {
    switch (role) {
      case 'agent':
        return this._buildConfig('simplified')
      case 'broker':
        return this._buildConfig('standard')
      case 'executive':
        return this._buildConfig('standard')
    }
  }

  promoteComplexity(userId: string, currentLevel: ComplexityLevel): ComplexityLevel {
    const order: ComplexityLevel[] = ['simplified', 'standard', 'advanced']
    const idx = order.indexOf(currentLevel)
    const next: ComplexityLevel = idx < order.length - 1 ? order[idx + 1] : currentLevel

    logger.info('[AdaptiveInterface] promoteComplexity', {
      user_id: userId,
      from: currentLevel,
      to: next,
    })

    return next
  }

  private _buildConfig(level: ComplexityLevel): InterfaceConfig {
    switch (level) {
      case 'simplified':
        return {
          level,
          show_ai_explanations: true,
          show_raw_scores: false,
          collapse_secondary_metrics: true,
          guided_mode: true,
          max_visible_actions: 3,
          show_revenue_attribution: false,
        }
      case 'standard':
        return {
          level,
          show_ai_explanations: true,
          show_raw_scores: true,
          collapse_secondary_metrics: false,
          guided_mode: false,
          max_visible_actions: 6,
          show_revenue_attribution: true,
        }
      case 'advanced':
        return {
          level,
          show_ai_explanations: false,
          show_raw_scores: true,
          collapse_secondary_metrics: false,
          guided_mode: false,
          max_visible_actions: 12,
          show_revenue_attribution: true,
        }
    }
  }
}

export const adaptiveInterfaceEngine = new AdaptiveInterfaceEngine()
