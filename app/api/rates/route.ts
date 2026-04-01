import { NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RatesData {
  euribor_6m:   number
  euribor_12m:  number
  euribor_3m:   number
  fx:           Record<string, number>
  updated_at:   string
  next_update:  string
  sources:      string[]
}

// ─── Fallback — valores actuais confirmados ───────────────────────────────────
// Euribor muda apenas nas reuniões BCE (a cada 6-8 semanas)
// Actualizar manualmente quando BCE anunciar nova taxa

const EURIBOR_6M_CONFIRMED  = parseFloat(process.env.EURIBOR_6M  ?? '0.0295')
const EURIBOR_12M_CONFIRMED = parseFloat(process.env.EURIBOR_12M ?? '0.0278')
const EURIBOR_3M_CONFIRMED  = parseFloat(process.env.EURIBOR_3M  ?? '0.0310')

const FALLBACK: RatesData = {
  euribor_6m:  EURIBOR_6M_CONFIRMED,
  euribor_12m: EURIBOR_12M_CONFIRMED,
  euribor_3m:  EURIBOR_3M_CONFIRMED,
  fx:          { EUR: 1, GBP: 0.86, USD: 1.09, CHF: 0.97, AED: 4.00, BRL: 5.60, CNY: 7.85 },
  updated_at:  new Date().toISOString(),
  next_update: new Date(Date.now() + 4 * 3600_000).toISOString(),
  sources:     ['env-fallback'],
}

// ─── Standard fetch headers to avoid ECB bot protection ──────────────────────

const ECB_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
  'User-Agent': 'Mozilla/5.0 (compatible; AgencyGroupBot/1.0; +https://agencygroup.pt)',
  'Cache-Control': 'no-cache',
}

// ─── ECB SDMX-JSON — multiple series key formats ─────────────────────────────

async function fetchECBEuribor(months: '3M' | '6M' | '12M'): Promise<number> {
  // Different series key variants to try (ECB changes these occasionally)
  const keyMap = {
    '3M':  ['B.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA', 'B.U2.EUR.RT0.MM.EURIBOR3MD.HSTA'],
    '6M':  ['B.U2.EUR.RT0.MM.EURIBOR6MD_.HSTA', 'B.U2.EUR.RT0.MM.EURIBOR6MD.HSTA'],
    '12M': ['B.U2.EUR.RT0.MM.EURIBOR1YD_.HSTA',  'B.U2.EUR.RT0.MM.EURIBOR1YD.HSTA'],
  }

  const baseUrl = 'https://data-api.ecb.europa.eu/service/data/FM'

  for (const key of keyMap[months]) {
    const url = `${baseUrl}/${key}?lastNObservations=1&format=jsondata&detail=dataonly`
    try {
      const res = await fetch(url, {
        headers: ECB_HEADERS,
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      })
      if (!res.ok) continue

      const json = await res.json()
      const series   = json?.dataSets?.[0]?.series
      const firstSeries = series ? (Object.values(series)[0] as { observations: Record<string, number[]> }) : null
      const obs = firstSeries?.observations
      if (!obs) continue

      // observations keys are integer indices — get the last one
      const lastIdx = Object.keys(obs).sort((a, b) => parseInt(b) - parseInt(a))[0]
      const value   = obs[lastIdx]?.[0]
      if (value == null || isNaN(value) || value <= 0) continue

      return value / 100 // BCE publishes in % → decimal
    } catch { continue }
  }

  throw new Error(`ECB Euribor ${months} — all variants failed`)
}

// ─── FX via Frankfurter (fonte oficial: dados BCE, actualizado diariamente) ───
// AED está indexado ao USD à taxa fixa 3.6725 desde 1997 (peg oficial UAE)

async function fetchFrankfurterFX(): Promise<Record<string, number>> {
  const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=GBP,USD,CHF,BRL,CNY', {
    headers: { 'User-Agent': 'AgencyGroupBot/1.0' },
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`)
  const json = await res.json()
  if (!json.rates) throw new Error('Frankfurter — no rates')

  // AED peg to USD: 1 USD = 3.6725 AED (fixo desde 1997)
  const usd = json.rates.USD as number
  const aed = usd ? parseFloat((usd * 3.6725).toFixed(4)) : FALLBACK.fx.AED

  return { EUR: 1, ...json.rates, AED: aed }
}

// ─── FX backup — ExchangeRate-API ────────────────────────────────────────────

async function fetchExchangeRateApiFX(): Promise<Record<string, number>> {
  const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR', {
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`ExchangeRate-API HTTP ${res.status}`)
  const json = await res.json()
  const r = json.rates
  const usd = r.USD as number
  const aed = r.AED ?? (usd ? parseFloat((usd * 3.6725).toFixed(4)) : FALLBACK.fx.AED)
  return { EUR: 1, GBP: r.GBP, USD: usd, CHF: r.CHF, AED: aed, BRL: r.BRL, CNY: r.CNY ?? 7.85 }
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const sources: string[] = []
  let euribor_6m  = EURIBOR_6M_CONFIRMED
  let euribor_12m = EURIBOR_12M_CONFIRMED
  let euribor_3m  = EURIBOR_3M_CONFIRMED
  let fx          = FALLBACK.fx

  await Promise.all([
    // Euribor 6M — fonte BCE
    fetchECBEuribor('6M')
      .then(v => { euribor_6m = v;  sources.push('BCE-live-Euribor6M') })
      .catch(() => sources.push('env-Euribor6M')),

    // Euribor 12M — fonte BCE
    fetchECBEuribor('12M')
      .then(v => { euribor_12m = v; sources.push('BCE-live-Euribor12M') })
      .catch(() => sources.push('env-Euribor12M')),

    // Euribor 3M — fonte BCE
    fetchECBEuribor('3M')
      .then(v => { euribor_3m = v;  sources.push('BCE-live-Euribor3M') })
      .catch(() => sources.push('env-Euribor3M')),

    // FX — Frankfurter (BCE) com fallback para ExchangeRate-API
    fetchFrankfurterFX()
      .then(r => { fx = r; sources.push('Frankfurter-BCE-FX') })
      .catch(() =>
        fetchExchangeRateApiFX()
          .then(r => { fx = r; sources.push('ExchangeRate-API-FX') })
          .catch(() => sources.push('env-FX'))
      ),
  ])

  const now  = new Date()
  const data: RatesData = {
    euribor_6m,
    euribor_12m,
    euribor_3m,
    fx,
    updated_at:  now.toISOString(),
    next_update: new Date(now.getTime() + 4 * 3600_000).toISOString(),
    sources,
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=14400, stale-while-revalidate=3600',
    },
  })
}
