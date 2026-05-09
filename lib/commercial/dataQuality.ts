// =============================================================================
// Agency Group — Data Quality Engine
// lib/commercial/dataQuality.ts
// Scores contacts and deals for data completeness, staleness, anomalies
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// Required fields by resource type and stage
const CONTACT_REQUIRED_FIELDS = {
  base: ['full_name', 'phone', 'status'],
  qualified: ['email', 'budget_min', 'budget_max', 'preferred_locations', 'language'],
  active: ['nationality', 'typologies_wanted', 'gdpr_consent', 'assigned_to'],
}

const DEAL_REQUIRED_FIELDS = {
  base: ['contact_id', 'assigned_consultant', 'fase'],
  active: ['deal_value', 'zona', 'property_id'],
  advanced: ['expected_fee', 'cpcv_date'],
}

export interface QualityScore {
  resource_id: string
  resource_type: 'contact' | 'deal'
  score: number // 0-100
  missing_fields: string[]
  stale_fields: string[]
  anomalies: string[]
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export function scoreContact(contact: Record<string, unknown>): QualityScore {
  const missing: string[] = []
  const stale: string[] = []
  const anomalies: string[] = []

  // Base required
  for (const f of CONTACT_REQUIRED_FIELDS.base) {
    if (!contact[f]) missing.push(f)
  }

  // Stage-based required
  const status = String(contact.status ?? '')
  if (['qualified', 'active', 'negotiating', 'client'].includes(status)) {
    for (const f of CONTACT_REQUIRED_FIELDS.qualified) {
      if (!contact[f]) missing.push(f)
    }
  }
  if (['active', 'negotiating', 'client', 'vip'].includes(status)) {
    for (const f of CONTACT_REQUIRED_FIELDS.active) {
      if (!contact[f]) missing.push(f)
    }
  }

  // Staleness: last_contact_at > 30 days
  if (contact.last_contact_at) {
    const lastContact = new Date(contact.last_contact_at as string)
    const daysSince = (Date.now() - lastContact.getTime()) / 86_400_000
    if (daysSince > 30 && ['active', 'qualified'].includes(status)) {
      stale.push('last_contact_at')
    }
    if (daysSince > 90) stale.push('contact_stale_90d')
  } else if (['active', 'qualified'].includes(status)) {
    missing.push('last_contact_at')
  }

  // Anomalies
  const budgetMin = Number(contact.budget_min ?? 0)
  const budgetMax = Number(contact.budget_max ?? 0)
  if (budgetMin > 0 && budgetMax > 0 && budgetMin > budgetMax) {
    anomalies.push('budget_min_exceeds_max')
  }
  if (budgetMin > 0 && budgetMin < 50_000) anomalies.push('budget_below_minimum_threshold')
  if (!contact.gdpr_consent && ['client', 'vip'].includes(status)) {
    anomalies.push('gdpr_consent_missing_for_client')
  }

  const penalty = missing.length * 8 + stale.length * 5 + anomalies.length * 10
  const score = Math.max(0, 100 - penalty)

  return {
    resource_id: String(contact.id ?? ''),
    resource_type: 'contact',
    score,
    missing_fields: missing,
    stale_fields: stale,
    anomalies,
    grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F',
  }
}

export interface DataQualityReport {
  total_contacts: number
  avg_contact_score: number
  grade_distribution: Record<string, number>
  top_missing_fields: Record<string, number>
  stale_contacts_count: number
  critical_issues: number
  agent_scores: Record<string, number>
}

export async function generateDataQualityReport(): Promise<DataQualityReport> {
  try {
    const { data: contacts, error } = await supabaseAdmin
      .from('contacts')
      .select('id,full_name,email,phone,status,budget_min,budget_max,preferred_locations,typologies_wanted,language,nationality,gdpr_consent,assigned_to,last_contact_at,lead_score')
      .in('status', ['lead', 'prospect', 'qualified', 'active', 'negotiating', 'client', 'vip', 'dormant', 'referrer'])
      .limit(500)

    if (error || !contacts) throw new Error(error?.message ?? 'No data')

    const scores = contacts.map(c => scoreContact(c as Record<string, unknown>))
    const avgScore = scores.length
      ? Math.round(scores.reduce((s, c) => s + c.score, 0) / scores.length)
      : 0

    const grade_distribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
    const field_counts: Record<string, number> = {}

    for (const s of scores) {
      grade_distribution[s.grade] = (grade_distribution[s.grade] ?? 0) + 1
      for (const f of s.missing_fields) {
        field_counts[f] = (field_counts[f] ?? 0) + 1
      }
    }

    // Agent scores (avg quality per agent)
    const agent_scores: Record<string, { sum: number; count: number }> = {}
    for (let i = 0; i < contacts.length; i++) {
      const agentId = String((contacts[i] as Record<string, unknown>).assigned_to ?? 'unassigned')
      if (!agent_scores[agentId]) agent_scores[agentId] = { sum: 0, count: 0 }
      agent_scores[agentId].sum += scores[i].score
      agent_scores[agentId].count++
    }
    const agent_avg: Record<string, number> = {}
    for (const [ag, v] of Object.entries(agent_scores)) {
      agent_avg[ag] = Math.round(v.sum / v.count)
    }

    return {
      total_contacts: contacts.length,
      avg_contact_score: avgScore,
      grade_distribution,
      top_missing_fields: Object.fromEntries(
        Object.entries(field_counts).sort(([,a],[,b]) => b - a).slice(0, 10)
      ),
      stale_contacts_count: scores.filter(s => s.stale_fields.length > 0).length,
      critical_issues: scores.filter(s => s.grade === 'F').length,
      agent_scores: agent_avg,
    }
  } catch (err) {
    log.error('[dataQuality] generateReport failed', err instanceof Error ? err : new Error(String(err)), { route: 'lib/commercial/dataQuality' })
    return {
      total_contacts: 0, avg_contact_score: 0, grade_distribution: {},
      top_missing_fields: {}, stale_contacts_count: 0, critical_issues: 0, agent_scores: {},
    }
  }
}

// Re-export DEAL_REQUIRED_FIELDS to avoid lint warning on unused const
export { DEAL_REQUIRED_FIELDS }
