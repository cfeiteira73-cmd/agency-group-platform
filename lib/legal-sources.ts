// =============================================================================
// Agency Group — Fontes de dados legais aprovadas
// Referência mestre: o que está permitido e o que está banido
// =============================================================================

export type SourceStatus = 'active' | 'pending_credentials' | 'pending_contract' | 'unavailable'
export type SourceType = 'api_oficial' | 'api_licenciada' | 'api_publica' | 'portal_publico' | 'feed_licenciado'

export interface DataSource {
  name: string
  type: SourceType
  description: string
  url: string
  cost: string
  status: SourceStatus
  legalBasis?: string
  envVars?: string[]
  notes?: string
}

// ─── FONTES APROVADAS ─────────────────────────────────────────────────────────

export const APPROVED_SOURCES: DataSource[] = [
  {
    name: 'Idealista API Oficial',
    type: 'api_oficial',
    description: 'API REST OAuth2 da Idealista para pesquisa e detalhe de imóveis em Portugal/Espanha',
    url: 'https://developers.idealista.com',
    cost: 'Gratuita para portais com AMI',
    status: 'pending_credentials',
    legalBasis: 'Contrato API com Idealista (AMI 22506)',
    envVars: ['IDEALISTA_API_KEY', 'IDEALISTA_SECRET'],
    notes: 'Pedir acesso em developers.idealista.com com NIF da agência e número AMI 22506',
  },
  {
    name: 'Casafari API',
    type: 'api_licenciada',
    description: 'Agregador de dados imobiliários Portugal/Espanha — preços, histórico, comparáveis',
    url: 'https://www.casafari.com/api',
    cost: '€200–500/mês',
    status: 'pending_contract',
    legalBasis: 'Contrato de licença Casafari',
    envVars: ['CASAFARI_API_KEY'],
    notes: 'Alternativa premium ao Idealista API — dados de comparáveis mais ricos',
  },
  {
    name: 'e-Leilões.pt',
    type: 'portal_publico',
    description: 'Portal oficial de leilões judiciais do Estado Português (OSAE)',
    url: 'https://www.e-leiloes.pt',
    cost: 'Gratuito (dados públicos)',
    status: 'active',
    legalBasis: 'Dados públicos — art.º 5.º Diretiva Dados do Setor Público (DSMD)',
  },
  {
    name: 'Portal das Finanças — Leilões Fiscais',
    type: 'portal_publico',
    description: 'Vendas coercivas de imóveis por dívidas fiscais (Autoridade Tributária)',
    url: 'https://vendas.portaldasfinancas.gov.pt',
    cost: 'Gratuito (dados públicos)',
    status: 'active',
    legalBasis: 'Dados públicos AT — art.º 5.º DSMD',
  },
  {
    name: 'Citius — Vendas Judiciais',
    type: 'portal_publico',
    description: 'Portal do Ministério da Justiça — vendas executivas e insolvências',
    url: 'https://www.citius.mj.pt',
    cost: 'Gratuito (dados públicos)',
    status: 'active',
    legalBasis: 'Dados públicos MJ — acesso livre por lei',
  },
  {
    name: 'INE API',
    type: 'api_publica',
    description: 'Instituto Nacional de Estatística — índices de preços, NUTS3, transacções',
    url: 'https://www.ine.pt/ine/json_indicador',
    cost: 'Gratuito',
    status: 'active',
    legalBasis: 'API pública INE — dados abertos Estado Português',
    notes: 'Implementado em lib/ine-api.ts',
  },
  {
    name: 'Banco de Portugal — Taxas Euribor',
    type: 'api_publica',
    description: 'Taxas de juro, Euribor, spreads bancários',
    url: 'https://bpstat.bportugal.pt',
    cost: 'Gratuito',
    status: 'active',
    legalBasis: 'Dados públicos Banco de Portugal',
  },
  {
    name: 'SIIAMB — Licenças Urbanismo',
    type: 'api_publica',
    description: 'Sistema de Informação de Impacte Ambiental — dados de licenciamento',
    url: 'https://siiamb.apambiente.pt',
    cost: 'Gratuito',
    status: 'active',
    legalBasis: 'Dados públicos APA',
  },
]

// ─── FONTES BANIDAS ────────────────────────────────────────────────────────────

export const BANNED_SOURCES: string[] = [
  // Scrapers de terceiros que violam ToS da Idealista
  'dz_omar/idealista-scraper-api',
  'dz-omar~idealista-scraper',
  'dtrungtin/idealista-scraper',
  'idealista-scraper',
  // Scrapers que violam ToS da Imovirtual
  'epctex~imovirtual-scraper',
  'epctex/imovirtual-scraper',
  'imovirtual-scraper',
  // Scrapers genéricos sem validação legal
  'compass/google-maps-scraper',
]

// ─── UTILITIES ────────────────────────────────────────────────────────────────

export function isSourceBanned(actorName: string): boolean {
  return BANNED_SOURCES.some(banned =>
    actorName.toLowerCase().includes(banned.toLowerCase())
  )
}

export function getActiveApprovedSources(): DataSource[] {
  return APPROVED_SOURCES.filter(s => s.status === 'active')
}

export function getPendingSources(): DataSource[] {
  return APPROVED_SOURCES.filter(s => s.status === 'pending_credentials' || s.status === 'pending_contract')
}

// Status resumo para logging/monitoring
export function getLegalComplianceStatus() {
  return {
    approved_active: getActiveApprovedSources().length,
    pending_credentials: APPROVED_SOURCES.filter(s => s.status === 'pending_credentials').length,
    pending_contract: APPROVED_SOURCES.filter(s => s.status === 'pending_contract').length,
    banned_count: BANNED_SOURCES.length,
    compliance: 'CONFORME — todos os scrapers ilegais removidos em 2026-04-13',
    next_action: 'Pedir credenciais Idealista API em developers.idealista.com com AMI 22506',
  }
}
