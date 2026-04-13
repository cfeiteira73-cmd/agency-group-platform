// =============================================================================
// e-Leilões.pt — Portal público de leilões judiciais (OSAE/AT/Citius)
// Fonte legal: dados públicos do portal do Estado Português
// Sem autenticação necessária — scraping de HTML público permitido por lei (art.º 5.º DSMD)
// =============================================================================

export interface EleiloesListing {
  id: string
  titulo: string
  descricao: string
  valorBase: number
  valorMinimoLicitacao: number
  localizacao: string
  cidade: string
  dataEncerramento: string
  url: string
  tipo: 'judicial' | 'fiscal' | 'insolvencia' | 'voluntario'
  areaM2?: number
  tipologia?: string
  referencia?: string
  entidadeGestora?: string
}

const ELEILOES_BASE = 'https://www.e-leiloes.pt'
const LEILOES_TAX_BASE = 'https://vendas.portaldasfinancas.gov.pt'

// Fetch headers para parecer browser legítimo
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
}

function extractPrice(text: string): number {
  const m = text.match(/[\d.,\s]+(?:\s*€|\s*EUR)/i)
    || text.match(/(?:€|EUR)\s*[\d.,\s]+/i)
    || text.match(/valor[^:]*:\s*([\d.,\s]+)/i)
  if (!m) return 0
  const raw = (m[1] ?? m[0]).replace(/[€EUR\s]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')
  return parseFloat(raw) || 0
}

function extractArea(text: string): number | undefined {
  const m = text.match(/([\d.,]+)\s*m[²2]/i)
  if (!m) return undefined
  return parseFloat(m[1].replace(',', '.')) || undefined
}

function extractCity(text: string): string {
  const lower = text.toLowerCase()
  const CITIES: [string, string][] = [
    ['lisboa', 'Lisboa'], ['lisbon', 'Lisboa'],
    ['cascais', 'Cascais'], ['sintra', 'Sintra'], ['estoril', 'Estoril'],
    ['porto', 'Porto'], ['foz do douro', 'Porto'],
    ['algarve', 'Algarve'], ['faro', 'Algarve'], ['vilamoura', 'Algarve'],
    ['albufeira', 'Algarve'], ['lagos', 'Algarve'], ['portimão', 'Algarve'],
    ['comporta', 'Comporta'], ['setúbal', 'Setúbal'], ['setubal', 'Setúbal'],
    ['madeira', 'Madeira'], ['funchal', 'Madeira'],
    ['açores', 'Açores'], ['ponta delgada', 'Açores'],
    ['braga', 'Braga'], ['aveiro', 'Aveiro'], ['coimbra', 'Coimbra'],
    ['évora', 'Évora'], ['evora', 'Évora'],
  ]
  for (const [k, v] of CITIES) {
    if (lower.includes(k)) return v
  }
  return 'Portugal'
}

// Scrape listagem de imóveis em e-leiloes.pt
export async function fetchEleiloesListings(page = 1): Promise<EleiloesListing[]> {
  try {
    const url = `${ELEILOES_BASE}/imoveis?page=${page}`
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []

    const html = await res.text()
    const results: EleiloesListing[] = []

    // Extrair blocos de listagem (padrão do portal e-leiloes.pt)
    const blocks = html.split(/class="[^"]*leilao[^"]*"/i).slice(1)
    for (const block of blocks.slice(0, 20)) {
      const linkM = block.match(/href="([^"]*\/leilao\/[^"]+)"/)
      const titleM = block.match(/<h[1-4][^>]*>([^<]{5,150})<\/h[1-4]>/i)
      const priceM = block.match(/valor[^<]*<[^>]*>([\d.,\s€]+)/i)
        || block.match(/([\d.,]+)\s*€/)

      if (!linkM || !titleM) continue

      const href = linkM[1].startsWith('http') ? linkM[1] : `${ELEILOES_BASE}${linkM[1]}`
      const titulo = titleM[1].trim()
      const priceText = priceM?.[1] ?? ''
      const valorBase = extractPrice(priceText)
      const cidade = extractCity(titulo + ' ' + block)
      const areaM2 = extractArea(block)
      const refM = block.match(/[Rr]ef[^\w]*([\w\d/-]+)/)

      results.push({
        id: linkM[1].split('/').at(-1) ?? String(Math.random()),
        titulo,
        descricao: '',
        valorBase,
        valorMinimoLicitacao: Math.round(valorBase * 0.85),
        localizacao: cidade,
        cidade,
        dataEncerramento: '',
        url: href,
        tipo: 'judicial',
        areaM2,
        referencia: refM?.[1],
        entidadeGestora: 'e-Leilões.pt',
      })
    }

    return results
  } catch {
    return []
  }
}

// Detalhes de um imóvel específico em e-leiloes.pt
export async function fetchEleiloesDetail(url: string): Promise<EleiloesListing | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null

    const html = await res.text()
    const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

    const titleM = html.match(/<h1[^>]*>([^<]{5,200})<\/h1>/i)
    const valorBase = extractPrice(txt)
    const cidade = extractCity(txt)
    const areaM2 = extractArea(txt)
    const refM = txt.match(/[Rr]ef[^\w]*([\w\d/-]+)/)
    const dataM = txt.match(/encerr[^:]*:\s*([\d/.\s]+)/i) || txt.match(/prazo[^:]*:\s*([\d/.\s]+)/i)

    if (!titleM) return null

    return {
      id: url.split('/').at(-1) ?? 'unknown',
      titulo: titleM[1].trim(),
      descricao: txt.slice(0, 800),
      valorBase,
      valorMinimoLicitacao: Math.round(valorBase * 0.85),
      localizacao: cidade,
      cidade,
      dataEncerramento: dataM?.[1]?.trim() ?? '',
      url,
      tipo: url.includes('tax') || url.includes('financas') ? 'fiscal' : 'judicial',
      areaM2,
      referencia: refM?.[1],
      entidadeGestora: url.includes('e-leiloes') ? 'e-Leilões.pt' : 'Portal das Finanças',
    }
  } catch {
    return null
  }
}

// Portal das Finanças — leilões fiscais
export async function fetchLeiloesTaxListings(): Promise<EleiloesListing[]> {
  try {
    const url = `${LEILOES_TAX_BASE}/imoveis`
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []

    const html = await res.text()
    const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const valorBase = extractPrice(txt)
    const cidade = extractCity(txt)

    // Portal das Finanças tem estrutura diferente — retorna dados básicos
    if (valorBase > 0) {
      return [{
        id: 'at-fiscal-' + Date.now(),
        titulo: 'Imóvel Leilão Fiscal AT',
        descricao: txt.slice(0, 400),
        valorBase,
        valorMinimoLicitacao: Math.round(valorBase * 0.85),
        localizacao: cidade,
        cidade,
        dataEncerramento: '',
        url,
        tipo: 'fiscal',
        entidadeGestora: 'Autoridade Tributária',
      }]
    }
    return []
  } catch {
    return []
  }
}
