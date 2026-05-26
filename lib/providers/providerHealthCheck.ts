// lib/providers/providerHealthCheck.ts
// Health check all configured data providers

import { isConfigured as idealistaConfigured } from './idealista/idealistaClient'
import { isConfigured as casafariConfigured } from './casafari/casafariClient'
import { isConfigured as citiusConfigured } from './citius/citiusClient'
import { getConfiguredBanks } from './npl/bankNplFeedClient'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

export interface ProviderHealth {
  provider: string
  configured: boolean
  status: 'ACTIVE' | 'NOT_CONFIGURED' | 'UNKNOWN'
  last_sync?: string
  records_count?: number
  env_vars_required: string[]
  action_required?: string
}

export interface ProviderHealthReport {
  checked_at: string
  total_providers: number
  active_count: number
  not_configured_count: number
  providers: ProviderHealth[]
  supply_coverage_pct: number
}

export async function checkAllProviders(): Promise<ProviderHealthReport> {
  const checkedAt = new Date().toISOString()

  // Check last sync times from DB
  let lastIdealistaSync: string | undefined
  let lastCasafariSync: string | undefined
  let lastCitiusSync: string | undefined

  try {
    const { data: syncRows } = await (supabaseAdmin as any)
      .from('provider_sync_logs')
      .select('provider, synced_at, records_fetched')
      .in('provider', ['IDEALISTA', 'CASAFARI', 'CITIUS'])
      .order('synced_at', { ascending: false })
      .limit(10)

    type SyncRow = { provider: string; synced_at: string; records_fetched: number }
    const syncs = (syncRows ?? []) as SyncRow[]
    lastIdealistaSync = syncs.find(s => s.provider === 'IDEALISTA')?.synced_at
    lastCasafariSync = syncs.find(s => s.provider === 'CASAFARI')?.synced_at
    lastCitiusSync = syncs.find(s => s.provider === 'CITIUS')?.synced_at
  } catch { /* table may not exist yet */ }

  const providers: ProviderHealth[] = [
    {
      provider: 'Idealista',
      configured: idealistaConfigured(),
      status: idealistaConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
      last_sync: lastIdealistaSync,
      env_vars_required: ['IDEALISTA_API_KEY', 'IDEALISTA_API_SECRET'],
      action_required: idealistaConfigured() ? undefined : 'Register at https://developers.idealista.com',
    },
    {
      provider: 'Casafari',
      configured: casafariConfigured(),
      status: casafariConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
      last_sync: lastCasafariSync,
      env_vars_required: ['CASAFARI_API_KEY'],
      action_required: casafariConfigured() ? undefined : 'Contact contact@casafari.com for API access',
    },
    {
      provider: 'Citius (Judicial Auctions)',
      configured: citiusConfigured(),
      status: citiusConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
      last_sync: lastCitiusSync,
      env_vars_required: ['CITIUS_PARTNER_KEY', 'CITIUS_BASE_URL'],
      action_required: citiusConfigured() ? undefined : 'Contact Ministério da Justiça DGPJ for data-sharing agreement',
    },
    ...getConfiguredBanks().map(bank => ({
      provider: `${bank} NPL Feed`,
      configured: true,
      status: 'ACTIVE' as const,
      env_vars_required: [`${bank}_NPL_API_KEY`, `${bank}_NPL_URL`],
    })),
    ...['NOVOBANCO', 'BCP', 'CGD', 'SANTANDER_PT']
      .filter(b => !getConfiguredBanks().includes(b))
      .map(bank => ({
        provider: `${bank} NPL Feed`,
        configured: false,
        status: 'NOT_CONFIGURED' as const,
        env_vars_required: [`${bank}_NPL_API_KEY`, `${bank}_NPL_URL`],
        action_required: `Contact ${bank} institutional relations for NPL data-sharing agreement`,
      })),
  ]

  const activeCount = providers.filter(p => p.status === 'ACTIVE').length
  const totalMajorProviders = 7  // Idealista, Casafari, Citius, 4 banks

  log.info('[providerHealthCheck] checked', { active: activeCount, total: providers.length })

  return {
    checked_at: checkedAt,
    total_providers: providers.length,
    active_count: activeCount,
    not_configured_count: providers.filter(p => p.status === 'NOT_CONFIGURED').length,
    providers,
    supply_coverage_pct: Math.round((activeCount / totalMajorProviders) * 100),
  }
}
