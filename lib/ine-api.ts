const INE_BASE = 'https://www.ine.pt/ine/json_indicador'

export interface INEMarketData {
  medianPricePerSqm: number
  region: string
  period: string
  source: 'INE Portugal'
}

export async function fetchINEMarketData(nuts3Code: string): Promise<INEMarketData | null> {
  try {
    const url = `${INE_BASE}/pJSON?Indicadores=E_7_INVTSI_01&Geo=${nuts3Code}&Periodo=1&lang=PT`
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const data = await res.json()
    const series = data?.[0]?.Dados
    if (!series) return null
    const latest = Object.entries(series).sort().at(-1)
    if (!latest) return null
    const [period, values] = latest as [string, Array<{valor: string}>]
    const price = parseFloat(values[0]?.valor ?? '0')
    return { medianPricePerSqm: price, region: nuts3Code, period, source: 'INE Portugal' }
  } catch {
    return null
  }
}

export const NUTS3_CODES: Record<string, string> = {
  'Lisboa': 'PT170',
  'Porto': 'PT11A',
  'Algarve': 'PT150',
  'Braga': 'PT111',
  'Madeira': 'PT300',
  'Açores': 'PT200',
  'Setúbal': 'PT180',
  'Aveiro': 'PT116',
  'Coimbra': 'PT119',
}
