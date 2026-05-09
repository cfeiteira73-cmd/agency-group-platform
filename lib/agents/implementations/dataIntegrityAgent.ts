// =============================================================================
// AGENCY GROUP — Data Integrity Agent v1.0
// Audits data quality across contacts, deals, offmarket_leads, properties
// AMI: 22506 | SH-ROS Layer: system_automation
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

export class DataIntegrityAgent extends BaseAgent {
  readonly id = 'data-integrity' as const
  readonly name = 'Data Integrity Agent'
  readonly description = 'Audits data completeness across contacts, deals, offmarket_leads, and properties — returns a quality score and fix recommendations'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    4,
    max_retries:            2,
    timeout_ms:             2000,
    require_human_approval: false,
    can_send_comms:         false,
    layer:                  'system_automation',
  }

  protected async execute(ctx: AgentContext): Promise<{ insights: AgentInsight[]; actions: AgentAction[]; metadata: Record<string, unknown> }> {
    const insights: AgentInsight[] = []
    const actions:  AgentAction[]  = []

    const issues: Array<{ table: string; count: number; issue: string }> = []
    let totalChecked = 0

    try {
      // 1. Contacts: un-contactable (no email AND no phone)
      // contacts may not have org_id — skip filter
      const { count: contactTotal } = await supabaseAdmin
        .from('contacts')
        .select('id', { count: 'exact', head: true })

      const { count: unContactable } = await supabaseAdmin
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .is('email', null)
        .is('phone', null)

      totalChecked += contactTotal ?? 0
      if ((unContactable ?? 0) > 0) {
        issues.push({ table: 'contacts', count: unContactable ?? 0, issue: 'sem email nem telefone' })
      }

      // 2. Deals: missing valor or fase
      const { count: dealTotal } = await supabaseAdmin
        .from('deals')
        .select('id', { count: 'exact', head: true })

      const { count: dealsMissingData } = await supabaseAdmin
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .or('valor.is.null,fase.is.null')

      totalChecked += dealTotal ?? 0
      if ((dealsMissingData ?? 0) > 0) {
        issues.push({ table: 'deals', count: dealsMissingData ?? 0, issue: 'valor ou fase em falta' })
      }

      // 3. Offmarket leads: unscored
      const { count: leadTotal } = await supabaseAdmin
        .from('offmarket_leads')
        .select('id', { count: 'exact', head: true })

      const { count: unscoredLeads } = await supabaseAdmin
        .from('offmarket_leads')
        .select('id', { count: 'exact', head: true })
        .is('score', null)

      totalChecked += leadTotal ?? 0
      if ((unscoredLeads ?? 0) > 0) {
        issues.push({ table: 'offmarket_leads', count: unscoredLeads ?? 0, issue: 'score IS NULL' })
      }

      // 4. Properties: missing price_per_m2
      const { count: propTotal } = await supabaseAdmin
        .from('properties')
        .select('id', { count: 'exact', head: true })

      const { count: missingPpm2 } = await supabaseAdmin
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .is('price_per_m2', null)

      totalChecked += propTotal ?? 0
      if ((missingPpm2 ?? 0) > 0) {
        issues.push({ table: 'properties', count: missingPpm2 ?? 0, issue: 'price_per_m2 IS NULL' })
      }

      // Compute quality score
      const totalErrors = issues.reduce((s, i) => s + i.count, 0)
      const errorPct    = totalChecked > 0 ? (totalErrors / totalChecked) * 100 : 0
      const qualityScore = Math.round(Math.max(0, 100 - errorPct))

      // Generate per-issue insights
      for (const issue of issues) {
        const severity = issue.count > 20 ? 'critical' : issue.count > 5 ? 'warning' : 'info'
        insights.push({
          type:               'data_quality_issue',
          summary:            `${issue.table}: ${issue.count} registos com ${issue.issue}`,
          severity,
          confidence:         1.0,
          revenue_impact_eur: issue.count * 100,
          entity_type:        issue.table,
          entity_id:          null,
          evidence:           { table: issue.table, count: issue.count, issue: issue.issue },
        })
        actions.push({
          type:               'create_task',
          description:        `Corrigir dados em ${issue.table}: ${issue.count} registos com ${issue.issue}`,
          entity_type:        issue.table,
          entity_id:          null,
          payload:            { table: issue.table, affected_count: issue.count, issue: issue.issue },
          risk:               'low',
          requires_approval:  false,
        })
      }

      // Overall quality insight
      insights.push({
        type:               'data_quality_score',
        summary:            `Qualidade de dados: ${qualityScore}/100 — ${totalErrors} erros em ${totalChecked} registos`,
        severity:           qualityScore >= 90 ? 'info' : qualityScore >= 75 ? 'warning' : 'critical',
        confidence:         0.95,
        revenue_impact_eur: totalErrors * 100,
        entity_type:        'data_layer',
        entity_id:          null,
        evidence:           { quality_score: qualityScore, total_errors: totalErrors, total_checked: totalChecked, error_pct: Math.round(errorPct * 10) / 10 },
      })

      return {
        insights,
        actions,
        metadata: { org_id: ctx.org_id, quality_score: qualityScore, total_errors: totalErrors, total_checked: totalChecked, issues },
      }
    } catch (err) {
      return {
        insights: [{
          type: 'agent_error', summary: `Erro ao verificar integridade de dados: ${String(err)}`,
          severity: 'warning', confidence: 1, revenue_impact_eur: null,
          entity_type: 'system', entity_id: null, evidence: {},
        }],
        actions: [],
        metadata: { org_id: ctx.org_id },
      }
    }
  }
}
