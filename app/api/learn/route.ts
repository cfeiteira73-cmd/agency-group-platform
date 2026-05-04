import { NextRequest, NextResponse } from 'next/server'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NotionPropertyValue {
  type:   string
  number?: number
  title?:  Array<{ plain_text: string }>
  rich_text?: Array<{ plain_text: string }>
  select?: { name: string }
  date?:   { start: string }
}

interface NotionPage {
  id:         string
  properties: Record<string, NotionPropertyValue>
  created_time: string
}

interface NotionQueryResponse {
  results:     NotionPage[]
  has_more:    boolean
  next_cursor: string | null
}

interface DealRecord {
  id:                  string
  zona:                string
  tipologia:           string
  area:                number | null
  preco_final:         number | null
  preco_avm_estimado:  number | null
  data_fecho:          string | null
}

interface ZoneCalibration {
  zona:            string
  deals:           number
  desvio_medio_pct: number
  factor:          number
  status:          'calibrado' | 'insuficiente' | 'demo'
  desvios:         number[]
}

// ─── Notion fetch helpers ─────────────────────────────────────────────────────

const NOTION_DB_ID  = process.env.NOTION_LEARN_DB_ID ?? 'b5693a14ca8c43fa8645606363594662'
const NOTION_API    = 'https://api.notion.com/v1'
const NOTION_VER    = '2022-06-28'

/** Extract a plain string from a Notion property */
function extractString(prop: NotionPropertyValue | undefined): string {
  if (!prop) return ''
  if (prop.type === 'title'     && prop.title)     return prop.title[0]?.plain_text     ?? ''
  if (prop.type === 'rich_text' && prop.rich_text) return prop.rich_text[0]?.plain_text ?? ''
  if (prop.type === 'select'    && prop.select)     return prop.select.name              ?? ''
  return ''
}

/** Extract a number from a Notion property */
function extractNumber(prop: NotionPropertyValue | undefined): number | null {
  if (!prop || prop.type !== 'number') return null
  return prop.number ?? null
}

/** Extract a date string from a Notion property */
function extractDate(prop: NotionPropertyValue | undefined): string | null {
  if (!prop || prop.type !== 'date') return null
  return prop.date?.start ?? null
}

/** Fetch all pages from a Notion database (handles pagination) */
async function fetchAllDeals(token: string): Promise<DealRecord[]> {
  const records: DealRecord[] = []
  let cursor: string | null   = null
  let page                    = 0

  do {
    page++
    if (page > 20) break // safety: max 20 pages (2000 records)

    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        and: [
          {
            property: 'preco_final',
            number:   { is_not_empty: true },
          },
          {
            property: 'zona',
            rich_text: { is_not_empty: true },
          },
        ],
      },
    }
    if (cursor) body.start_cursor = cursor

    const res = await fetch(`${NOTION_API}/databases/${NOTION_DB_ID}/query`, {
      method:  'POST',
      headers: {
        Authorization:    `Bearer ${token}`,
        'Notion-Version': NOTION_VER,
        'Content-Type':   'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Notion API erro ${res.status}: ${errText}`)
    }

    const data: NotionQueryResponse = await res.json()

    for (const page of data.results) {
      const props = page.properties

      // Support common property name variants
      const zona = extractString(
        props['zona'] ?? props['Zona'] ?? props['ZONA']
      )
      const tipologia = extractString(
        props['tipologia'] ?? props['Tipologia'] ?? props['TIPOLOGIA']
      )
      const area = extractNumber(
        props['area'] ?? props['Area'] ?? props['área'] ?? props['Área']
      )
      const preco_final = extractNumber(
        props['preco_final'] ?? props['Preço Final'] ?? props['preco'] ?? props['Preco']
      )
      const preco_avm_estimado = extractNumber(
        props['preco_avm_estimado'] ?? props['AVM'] ?? props['Valor AVM'] ?? props['avm']
      )
      const data_fecho = extractDate(
        props['data_fecho'] ?? props['Data Fecho'] ?? props['data'] ?? props['Data']
      )

      if (zona && preco_final !== null && preco_avm_estimado !== null) {
        records.push({
          id:                page.id,
          zona,
          tipologia,
          area,
          preco_final,
          preco_avm_estimado,
          data_fecho,
        })
      }
    }

    cursor = data.next_cursor
  } while (cursor)

  return records
}

/** Calculate calibration factors from deal records */
function computeCalibration(deals: DealRecord[]): ZoneCalibration[] {
  const zonaMap = new Map<string, number[]>()

  for (const deal of deals) {
    if (!deal.zona || !deal.preco_final || !deal.preco_avm_estimado) continue
    if (deal.preco_avm_estimado === 0) continue

    const desvio = (deal.preco_final - deal.preco_avm_estimado) / deal.preco_avm_estimado

    if (!zonaMap.has(deal.zona)) zonaMap.set(deal.zona, [])
    zonaMap.get(deal.zona)!.push(desvio)
  }

  const calibracoes: ZoneCalibration[] = []

  for (const [zona, desvios] of zonaMap.entries()) {
    const n            = desvios.length
    const mean         = desvios.reduce((s, d) => s + d, 0) / n
    const mean_pct     = parseFloat((mean * 100).toFixed(2))
    const factor       = parseFloat((1 + mean).toFixed(4))
    const status: ZoneCalibration['status'] = n >= 3 ? 'calibrado' : 'insuficiente'

    calibracoes.push({
      zona,
      deals:            n,
      desvio_medio_pct: mean_pct,
      factor,
      status,
      desvios:          desvios.map(d => parseFloat((d * 100).toFixed(2))),
    })
  }

  // Sort: most deals first
  calibracoes.sort((a, b) => b.deals - a.deals)

  return calibracoes
}

/** Overall precision from calibrations */
function calcPrecisao(calibracoes: ZoneCalibration[]): string {
  if (calibracoes.length === 0) return 'N/A'
  const allDesvios = calibracoes.flatMap(c => c.desvios.map(d => Math.abs(d)))
  if (allDesvios.length === 0) return 'N/A'
  const mae = allDesvios.reduce((s, d) => s + d, 0) / allDesvios.length
  return `±${mae.toFixed(1)}%`
}

// ─── Demo response (used when NOTION_TOKEN not configured) ───────────────────

const DEMO_RESPONSE = {
  success:  true,
  fonte:    'DEMO — Configure NOTION_TOKEN para dados reais',
  calibracao: [
    {
      zona:             'Lisboa',
      deals:            3,
      desvio_medio_pct: -1.8,
      factor:           0.982,
      status:           'calibrado',
      desvios:          [-2.1, -1.4, -1.9],
    },
    {
      zona:             'Cascais',
      deals:            2,
      desvio_medio_pct: 2.1,
      factor:           1.021,
      status:           'insuficiente',
      desvios:          [1.8, 2.4],
    },
    {
      zona:             'Comporta',
      deals:            1,
      desvio_medio_pct: -4.2,
      factor:           0.958,
      status:           'insuficiente',
      desvios:          [-4.2],
    },
    {
      zona:             'Porto — Foz/Nevogilde',
      deals:            4,
      desvio_medio_pct: 0.7,
      factor:           1.007,
      status:           'calibrado',
      desvios:          [0.5, 1.2, -0.3, 1.4],
    },
    {
      zona:             'Algarve',
      deals:            2,
      desvio_medio_pct: 3.5,
      factor:           1.035,
      status:           'insuficiente',
      desvios:          [2.8, 4.2],
    },
  ],
  resumo: {
    total_deals:         12,
    zonas_calibradas:    2,
    zonas_insuficientes: 3,
    precisao_media:      '±2.7%',
    ultima_actualizacao: '2026-03-30',
  },
  info: {
    como_activar: 'Defina NOTION_TOKEN no ficheiro .env.local com o token de integração Notion.',
    notion_db:    `https://www.notion.so/${NOTION_DB_ID}`,
    campos_necessarios: [
      'zona (text/select)',
      'preco_final (number — €)',
      'preco_avm_estimado (number — €)',
      'tipologia (text/select — opcional)',
      'area (number — m², opcional)',
      'data_fecho (date — opcional)',
    ],
    nota: 'A calibração precisa de mínimo 3 deals por zona para status "calibrado". Com mais dados o AVM melhora automaticamente.',
  },
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  try {
    const token = process.env.NOTION_TOKEN

    // ── No token: return demo data ────────────────────────────────────────────
    if (!token) {
      return NextResponse.json(DEMO_RESPONSE)
    }

    // ── Token set: fetch real data from Notion ────────────────────────────────
    let deals: DealRecord[]

    try {
      deals = await fetchAllDeals(token)
    } catch (notionErr) {
      const msg = notionErr instanceof Error ? notionErr.message : 'Erro Notion desconhecido'
      return NextResponse.json(
        {
          error:        `Erro ao aceder ao Notion: ${msg}`,
          sugestao:     'Verifique se NOTION_TOKEN está correcto e a integração tem acesso à base de dados.',
          notion_db:    `https://www.notion.so/${NOTION_DB_ID}`,
        },
        { status: 502 }
      )
    }

    if (deals.length === 0) {
      return NextResponse.json({
        success:    true,
        fonte:      'Notion — base de dados acessível mas sem deals com dados completos',
        calibracao: [],
        resumo: {
          total_deals:         0,
          zonas_calibradas:    0,
          zonas_insuficientes: 0,
          precisao_media:      'N/A',
          ultima_actualizacao: new Date().toISOString().split('T')[0],
        },
        info: {
          nota:               'Adicione deals com campos: zona, preco_final, preco_avm_estimado.',
          campos_necessarios: [
            'zona (text/select)',
            'preco_final (number — €)',
            'preco_avm_estimado (number — €)',
          ],
        },
      })
    }

    const calibracao        = computeCalibration(deals)
    const zonas_calibradas  = calibracao.filter(c => c.status === 'calibrado').length
    const zonas_insuf       = calibracao.filter(c => c.status === 'insuficiente').length
    const precisao          = calcPrecisao(calibracao)

    // Strip the raw desvios array from the public response
    const calibracaoPublic = calibracao.map(({ desvios: _d, ...rest }) => rest)

    const learnRes = NextResponse.json({
      success:    true,
      fonte:      `Notion — ${deals.length} deals processados`,
      calibracao: calibracaoPublic,
      resumo: {
        total_deals:         deals.length,
        zonas_calibradas,
        zonas_insuficientes: zonas_insuf,
        precisao_media:      precisao,
        ultima_actualizacao: new Date().toISOString().split('T')[0],
      },
      deals_raw: deals.map(d => ({
        id:                  d.id,
        zona:                d.zona,
        tipologia:           d.tipologia,
        preco_final:         d.preco_final,
        preco_avm_estimado:  d.preco_avm_estimado,
        desvio_pct:          d.preco_final && d.preco_avm_estimado && d.preco_avm_estimado !== 0
          ? parseFloat((((d.preco_final - d.preco_avm_estimado) / d.preco_avm_estimado) * 100).toFixed(2))
          : null,
        data_fecho:          d.data_fecho,
      })),
      info: {
        nota:      'Factores de calibração automáticos. Mínimo 3 deals por zona para status "calibrado".',
        contacto:  'geral@agencygroup.pt — AMI 22506',
      },
      correlation_id: corrId,
    })
    learnRes.headers.set('x-correlation-id', corrId)
    return learnRes
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno no servidor' },
      { status: 500 }
    )
  }
}
