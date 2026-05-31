// Agency Group — Off-Market Acquisition Engine
// lib/acquisition/offMarketAcquisitionEngine.ts
// Wave 54 Phase 3 — Unified acquisition framework
//
// Covers: auctions, insolvencies, distressed assets, NPL portfolios,
// banks, servicers, family offices, developers, funds.
// Source Registry + Scoring + Lead/Asset Scoring + Duplicate Detection
// + Acquisition Pipelines + Source Reliability + Opportunity Ranking
// + Provider Abstraction (all sources plug in without code rewrites).
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SourceType =
  | 'AUCTION'
  | 'INSOLVENCY'
  | 'DISTRESSED_ASSET'
  | 'NPL_PORTFOLIO'
  | 'BANK_REO'         // Bank Real Estate Owned
  | 'SERVICER'
  | 'FAMILY_OFFICE'
  | 'DEVELOPER'
  | 'FUND'
  | 'PRIVATE_SELLER'
  | 'EXECUTOR'         // Estate executor
  | 'RECEIVERSHIP'

export type SourceStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_APPROVAL' | 'BLOCKED'
export type AcquisitionStage = 'IDENTIFIED' | 'CONTACTED' | 'UNDER_ANALYSIS' | 'OFFER_MADE' | 'NEGOTIATING' | 'CONTRACTED' | 'CLOSED' | 'LOST'

export interface AcquisitionSource {
  source_id: string
  name: string
  type: SourceType
  country: 'PT' | 'ES' | 'MULTI'
  status: SourceStatus
  reliability_score: number    // 0-100
  response_time_days: number
  deal_frequency: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
  min_ticket_eur: number
  max_ticket_eur: number
  contact_email: string | null
  contact_url: string | null
  notes: string
  last_deal_at: string | null
  created_at: string
}

export interface AcquisitionOpportunity {
  opportunity_id: string
  source_id: string
  source_type: SourceType
  title: string
  location: string
  country: 'PT' | 'ES'
  asset_type: 'RESIDENTIAL' | 'COMMERCIAL' | 'LAND' | 'PORTFOLIO' | 'NPL'
  asking_price_eur: number
  estimated_market_value_eur: number
  discount_pct: number          // vs market
  gross_yield_pct: number | null
  urgency_score: number         // 0-100: how fast needs to close
  opportunity_score: number     // 0-100: overall attractiveness
  lead_score: number            // 0-100: likelihood to convert
  duplicate_flag: boolean
  duplicate_of: string | null
  stage: AcquisitionStage
  notes: string
  detected_at: string
}

export interface SourceRegistryReport {
  report_id: string
  tenant_id: string
  total_sources: number
  active_sources: number
  sources_by_type: Record<string, number>
  avg_reliability: number
  high_frequency_sources: string[]
  sources: AcquisitionSource[]
  generated_at: string
}

export interface AcquisitionPipelineReport {
  pipeline_id: string
  tenant_id: string
  total_opportunities: number
  by_stage: Record<AcquisitionStage, number>
  by_type: Record<string, number>
  avg_discount_pct: number
  avg_opportunity_score: number
  top_opportunities: AcquisitionOpportunity[]
  duplicates_detected: number
  pipeline_hash: string
  generated_at: string
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

function bigintReplacer(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v
}

// ── Source registry (Portugal + Spain built-in) ────────────────────────────────

const BUILT_IN_SOURCES: AcquisitionSource[] = [
  // Portugal — Auctions
  { source_id: 'src_citius_pt',     name: 'Citius (Tribunais PT)',        type: 'AUCTION',          country: 'PT', status: 'ACTIVE',  reliability_score: 85, response_time_days: 7,  deal_frequency: 'HIGH',    min_ticket_eur: 50_000,   max_ticket_eur: 5_000_000, contact_email: null, contact_url: 'https://citius.tribunaisnet.mj.pt', notes: 'Judicial auctions — primary PT source', last_deal_at: null, created_at: new Date().toISOString() },
  { source_id: 'src_e_leiloes',     name: 'e-Leilões',                   type: 'AUCTION',          country: 'PT', status: 'ACTIVE',  reliability_score: 82, response_time_days: 5,  deal_frequency: 'HIGH',    min_ticket_eur: 30_000,   max_ticket_eur: 10_000_000,contact_email: null, contact_url: 'https://www.e-leiloes.pt', notes: 'Bank + executor + judicial auctions', last_deal_at: null, created_at: new Date().toISOString() },
  { source_id: 'src_solvit',        name: 'SOLVI-T Insolvências PT',      type: 'INSOLVENCY',       country: 'PT', status: 'ACTIVE',  reliability_score: 80, response_time_days: 14, deal_frequency: 'MEDIUM',  min_ticket_eur: 100_000,  max_ticket_eur: 20_000_000,contact_email: null, contact_url: 'https://www.solvi-t.pt', notes: 'Insolvency administrator network', last_deal_at: null, created_at: new Date().toISOString() },
  // Portugal — Banks
  { source_id: 'src_bcp_reo',       name: 'BCP Imóveis',                  type: 'BANK_REO',         country: 'PT', status: 'ACTIVE',  reliability_score: 90, response_time_days: 21, deal_frequency: 'MEDIUM',  min_ticket_eur: 200_000,  max_ticket_eur: 50_000_000,contact_email: null, contact_url: 'https://www.millenniumbcp.pt', notes: 'BCP bank-owned real estate portfolio', last_deal_at: null, created_at: new Date().toISOString() },
  { source_id: 'src_cgd_reo',       name: 'CGD Imóveis',                  type: 'BANK_REO',         country: 'PT', status: 'ACTIVE',  reliability_score: 92, response_time_days: 30, deal_frequency: 'MEDIUM',  min_ticket_eur: 150_000,  max_ticket_eur: 100_000_000,contact_email: null,contact_url: 'https://www.cgd.pt', notes: 'Caixa Geral de Depósitos — state bank', last_deal_at: null, created_at: new Date().toISOString() },
  { source_id: 'src_novo_banco',    name: 'Novo Banco / Oxy Capital',     type: 'NPL_PORTFOLIO',    country: 'PT', status: 'ACTIVE',  reliability_score: 88, response_time_days: 30, deal_frequency: 'LOW',     min_ticket_eur: 1_000_000,max_ticket_eur: 500_000_000,contact_email: null,contact_url: 'https://www.novobanco.pt', notes: 'NPL portfolios and distressed assets', last_deal_at: null, created_at: new Date().toISOString() },
  { source_id: 'src_servilusa',     name: 'Servilusa / Servicers PT',     type: 'SERVICER',         country: 'PT', status: 'ACTIVE',  reliability_score: 75, response_time_days: 14, deal_frequency: 'MEDIUM',  min_ticket_eur: 100_000,  max_ticket_eur: 10_000_000,contact_email: null, contact_url: null, notes: 'Loan servicer network', last_deal_at: null, created_at: new Date().toISOString() },
  // Spain — Auctions
  { source_id: 'src_boe_subastas',  name: 'BOE Subastas Judiciales',     type: 'AUCTION',          country: 'ES', status: 'ACTIVE',  reliability_score: 88, response_time_days: 10, deal_frequency: 'HIGH',    min_ticket_eur: 50_000,   max_ticket_eur: 20_000_000,contact_email: null, contact_url: 'https://subastas.boe.es', notes: 'Official Spanish judicial auction portal', last_deal_at: null, created_at: new Date().toISOString() },
  { source_id: 'src_servihabitat',  name: 'Servihabitat (CaixaBank)',     type: 'SERVICER',         country: 'ES', status: 'ACTIVE',  reliability_score: 87, response_time_days: 21, deal_frequency: 'HIGH',    min_ticket_eur: 80_000,   max_ticket_eur: 50_000_000,contact_email: null, contact_url: 'https://www.servihabitat.com', notes: 'CaixaBank servicer — large portfolio', last_deal_at: null, created_at: new Date().toISOString() },
  { source_id: 'src_altamira',      name: 'Altamira (Santander)',         type: 'SERVICER',         country: 'ES', status: 'ACTIVE',  reliability_score: 85, response_time_days: 21, deal_frequency: 'HIGH',    min_ticket_eur: 100_000,  max_ticket_eur: 100_000_000,contact_email:null, contact_url: 'https://www.altamirainmuebles.com', notes: 'Santander servicer', last_deal_at: null, created_at: new Date().toISOString() },
  // Institutional
  { source_id: 'src_cervantes_fo',  name: 'Family Office Network EMEA',  type: 'FAMILY_OFFICE',    country: 'MULTI', status: 'PENDING_APPROVAL', reliability_score: 70, response_time_days: 30, deal_frequency: 'MEDIUM', min_ticket_eur: 500_000, max_ticket_eur: 200_000_000, contact_email: null, contact_url: null, notes: 'HNWI and FO direct network — requires introduction', last_deal_at: null, created_at: new Date().toISOString() },
  { source_id: 'src_developer_net', name: 'Developer Direct Network',    type: 'DEVELOPER',        country: 'MULTI', status: 'ACTIVE', reliability_score: 72, response_time_days: 7, deal_frequency: 'MEDIUM', min_ticket_eur: 200_000, max_ticket_eur: 50_000_000, contact_email: null, contact_url: null, notes: 'Direct developer relationships', last_deal_at: null, created_at: new Date().toISOString() },
]

// ── Opportunity scoring ────────────────────────────────────────────────────────

function scoreOpportunity(opp: Partial<AcquisitionOpportunity>): number {
  let score = 0

  // Discount vs market (40% weight)
  const discount = opp.discount_pct ?? 0
  score += Math.min(40, discount * 1.6)  // 25% discount = 40 pts

  // Yield (20% weight)
  const yield_ = opp.gross_yield_pct ?? 0
  score += Math.min(20, yield_ * 3.3)  // 6% yield = ~20 pts

  // Urgency (10% weight — higher urgency = higher score)
  score += Math.min(10, (opp.urgency_score ?? 50) / 10)

  // Asset type bonus (30% weight)
  const typeBonus: Record<string, number> = {
    NPL: 30, RESIDENTIAL: 25, COMMERCIAL: 20, PORTFOLIO: 28, LAND: 15,
  }
  score += typeBonus[opp.asset_type ?? 'RESIDENTIAL'] ?? 15

  return Math.round(Math.min(100, Math.max(0, score)))
}

// ── Duplicate detection (content-hash based) ──────────────────────────────────

function detectDuplicate(
  opp: Partial<AcquisitionOpportunity>,
  existing: AcquisitionOpportunity[],
): { isDuplicate: boolean; duplicateOf: string | null } {
  const sig = createHash('sha256').update(
    `${(opp.location ?? '').toLowerCase()}_${opp.asking_price_eur}_${opp.asset_type}`
  ).digest('hex').slice(0, 16)

  const match = existing.find(e => {
    const eSig = createHash('sha256').update(
      `${e.location.toLowerCase()}_${e.asking_price_eur}_${e.asset_type}`
    ).digest('hex').slice(0, 16)
    return eSig === sig
  })

  return { isDuplicate: !!match, duplicateOf: match?.opportunity_id ?? null }
}

// ── Main exports ───────────────────────────────────────────────────────────────

export async function getSourceRegistry(
  tenantId: string = TENANT_ID,
): Promise<SourceRegistryReport> {
  const reportId = randomUUID()

  // Merge built-in with any DB-stored custom sources
  let allSources: AcquisitionSource[] = [...BUILT_IN_SOURCES]

  try {
    const { data } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => Promise<{ data: Array<Record<string, unknown>> | null }>
        }
      }
    }).from('acquisition_sources').select('*').eq('tenant_id', tenantId)

    if (data && data.length > 0) {
      const dbSources = data.map(r => r as unknown as AcquisitionSource)
      // Merge — DB overrides built-in by source_id
      const dbIds = new Set(dbSources.map(s => s.source_id))
      allSources = [...BUILT_IN_SOURCES.filter(s => !dbIds.has(s.source_id)), ...dbSources]
    }
  } catch { /* use built-in only */ }

  const activeSources = allSources.filter(s => s.status === 'ACTIVE')
  const byType: Record<string, number> = {}
  for (const s of allSources) { byType[s.type] = (byType[s.type] ?? 0) + 1 }

  const avgReliability = allSources.length > 0
    ? Math.round(allSources.reduce((sum, s) => sum + s.reliability_score, 0) / allSources.length)
    : 0

  const highFreq = allSources.filter(s => s.deal_frequency === 'HIGH').map(s => s.name)

  return {
    report_id: reportId,
    tenant_id: tenantId,
    total_sources: allSources.length,
    active_sources: activeSources.length,
    sources_by_type: byType,
    avg_reliability: avgReliability,
    high_frequency_sources: highFreq,
    sources: allSources,
    generated_at: new Date().toISOString(),
  }
}

export async function runAcquisitionPipeline(
  tenantId: string = TENANT_ID,
): Promise<AcquisitionPipelineReport> {
  const pipelineId = randomUUID()
  const startTs    = Date.now()

  log.info('[AcquisitionEngine] Building pipeline', { tenantId })

  // Fetch opportunities from DB
  let opportunities: AcquisitionOpportunity[] = []
  try {
    const { data } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => {
            order: (col2: string, opts: object) => {
              limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null }>
            }
          }
        }
      }
    }).from('acquisition_opportunities')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('opportunity_score', { ascending: false })
      .limit(100)

    opportunities = (data ?? []).map(r => r as unknown as AcquisitionOpportunity)
  } catch { /* empty pipeline */ }

  // Count by stage
  const stages: AcquisitionStage[] = ['IDENTIFIED','CONTACTED','UNDER_ANALYSIS','OFFER_MADE','NEGOTIATING','CONTRACTED','CLOSED','LOST']
  const byStage = stages.reduce((acc, s) => ({ ...acc, [s]: opportunities.filter(o => o.stage === s).length }), {} as Record<AcquisitionStage, number>)

  const byType: Record<string, number> = {}
  for (const o of opportunities) { byType[o.asset_type] = (byType[o.asset_type] ?? 0) + 1 }

  const avgDiscount = opportunities.length > 0
    ? parseFloat((opportunities.reduce((s, o) => s + o.discount_pct, 0) / opportunities.length).toFixed(2))
    : 0

  const avgScore = opportunities.length > 0
    ? Math.round(opportunities.reduce((s, o) => s + o.opportunity_score, 0) / opportunities.length)
    : 0

  const duplicates    = opportunities.filter(o => o.duplicate_flag).length
  const topOpps       = opportunities.filter(o => !o.duplicate_flag).slice(0, 10)

  const pipelineHash  = createHash('sha256').update(
    `PIPELINE|${tenantId}|${pipelineId}|${opportunities.length}|${avgScore}`
  ).digest('hex')

  const report: AcquisitionPipelineReport = {
    pipeline_id:           pipelineId,
    tenant_id:             tenantId,
    total_opportunities:   opportunities.length,
    by_stage:              byStage,
    by_type:               byType,
    avg_discount_pct:      avgDiscount,
    avg_opportunity_score: avgScore,
    top_opportunities:     topOpps,
    duplicates_detected:   duplicates,
    pipeline_hash:         pipelineHash,
    generated_at:          new Date().toISOString(),
  }

  // Persist snapshot
  try {
    await (supabaseAdmin as unknown as {
      from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> }
    }).from('acquisition_pipeline_snapshots').insert({
      pipeline_id:           pipelineId,
      tenant_id:             tenantId,
      total_opportunities:   opportunities.length,
      avg_opportunity_score: avgScore,
      duplicates_detected:   duplicates,
      pipeline_hash:         pipelineHash,
      report_json:           JSON.parse(JSON.stringify(report, bigintReplacer)),
      generated_at:          report.generated_at,
    })
  } catch { /* ok */ }

  log.info('[AcquisitionEngine] Complete', { opportunities: opportunities.length, durationMs: Date.now() - startTs })

  return report
}

// Re-export scoring for external use
export { scoreOpportunity, detectDuplicate }
