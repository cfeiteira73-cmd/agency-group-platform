/**
 * AGENCY GROUP — Supabase Seed Script
 * Seeds real data into Supabase using the existing schema
 * Run: node scripts/seed-supabase.js
 */

const https = require('https')

const SUPABASE_URL = 'isbfiofwpxqqpgxoftph.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '' // SECURITY: never hardcode — use env var

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const opts = {
      hostname: SUPABASE_URL,
      path,
      method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data)

    const req = https.request(opts, (res) => {
      let out = ''
      res.on('data', (d) => out += d)
      res.on('end', () => resolve({ status: res.statusCode, body: out }))
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function deleteAll(table) {
  const r = await supabaseRequest('DELETE', `/rest/v1/${table}?id=gt.0`, null)
  return r
}

async function insert(table, data) {
  const r = await supabaseRequest('POST', `/rest/v1/${table}`, data)
  if (r.status >= 300) {
    console.error(`  ✗ ${table}: ${r.status} — ${r.body.slice(0, 200)}`)
  } else {
    console.log(`  ✓ ${table}: ${Array.isArray(data) ? data.length : 1} records inserted`)
  }
  return r
}

async function main() {
  console.log('\n🚀 Agency Group — Supabase Seed\n')

  // ── CONTACTS ─────────────────────────────────────────────────────────────
  console.log('📋 Seeding contacts...')
  await supabaseRequest('DELETE', '/rest/v1/contacts?lead_score=gt.0', null)

  await insert('contacts', [
    {
      name: 'James Mitchell', email: 'james@mitchellcapital.com',
      phone: '+44 7700 900123', nationality: 'GB', language: 'en',
      budget_min: 800000, budget_max: 1500000,
      zonas: ['Cascais', 'Estoril'], tipos: ['T3', 'T4'],
      status: 'vip', origin: 'referral', lead_score: 87,
      notes: 'Cash buyer. Cascais T3/T4 premium. Visita Abril. Golden Visa interesse.'
    },
    {
      name: 'Pierre Dubois', email: 'p.dubois@gmail.com',
      phone: '+33 6 12 34 56 78', nationality: 'FR', language: 'fr',
      budget_min: 600000, budget_max: 900000,
      zonas: ['Lisboa', 'Chiado'], tipos: ['T2', 'T3'],
      status: 'prospect', origin: 'idealista', lead_score: 82,
      notes: 'NHR 2024 interesse. Relocação Paris→Lisboa. Prazo 6 meses.'
    },
    {
      name: 'Khalid Al-Rashid', email: 'khalid@alrashid.ae',
      phone: '+971 50 123 4567', nationality: 'AE', language: 'ar',
      budget_min: 2000000, budget_max: 5000000,
      zonas: ['Lisboa', 'Cascais', 'Algarve'], tipos: ['V3', 'V4', 'V5'],
      status: 'vip', origin: 'referral', lead_score: 94,
      notes: 'Family office UAE. Portfolio 3-5 imóveis. IRR min 8%. Cash buyer.'
    },
    {
      name: 'Sophie Hartmann', email: 'sophie.h@gmail.com',
      phone: '+49 89 1234 5678', nationality: 'DE', language: 'de',
      budget_min: 350000, budget_max: 550000,
      zonas: ['Algarve'], tipos: ['T2', 'V2'],
      status: 'lead', origin: 'instagram', lead_score: 65,
      notes: 'Reforma antecipada alemanha. AL Algarve. NHR interesse.'
    },
    {
      name: 'Carlos Mendes', email: 'cmendes@hotmail.com',
      phone: '+351 91 234 5678', nationality: 'PT', language: 'pt',
      budget_min: 300000, budget_max: 500000,
      zonas: ['Lisboa', 'Oeiras'], tipos: ['T3', 'T4'],
      status: 'cliente', origin: 'referral', lead_score: 79,
      notes: 'Cliente existente. Procura 2º imóvel para investimento.'
    },
    {
      name: 'Charlotte Blake', email: 'charlotte.b@outlook.com',
      phone: '+44 20 7946 0958', nationality: 'GB', language: 'en',
      budget_min: 700000, budget_max: 1200000,
      zonas: ['Lisboa', 'Cascais'], tipos: ['T3', 'T4'],
      status: 'prospect', origin: 'referral', lead_score: 73,
      notes: 'Value-add investor. Aceita renovação. NHR interesse.'
    },
    {
      name: 'Marco Aurelio Santos', email: 'marco.santos@investimentos.com',
      phone: '+351 91 987 6543', nationality: 'PT', language: 'pt',
      budget_min: 1000000, budget_max: 3000000,
      zonas: ['Lisboa', 'Cascais', 'Sintra'], tipos: ['V3', 'V4'],
      status: 'vip', origin: 'referral', lead_score: 91,
      notes: 'VIP — portfolio 8 imóveis. Procura prime +2-3. Ref. top.'
    },
    {
      name: 'Ana Beatriz Costa', email: 'ana.costa@email.com',
      phone: '+351 96 345 6789', nationality: 'PT', language: 'pt',
      budget_min: 150000, budget_max: 280000,
      zonas: ['Setubal', 'Almada'], tipos: ['T2', 'T3'],
      status: 'lead', origin: 'imovirtual', lead_score: 58,
      notes: 'Primeiro imóvel. Crédito aprovado €250K BPI. Urgente.'
    },
    {
      name: 'Roberto Fontana', email: 'r.fontana@gmail.com',
      phone: '+55 11 9 8765 4321', nationality: 'BR', language: 'pt',
      budget_min: 200000, budget_max: 400000,
      zonas: ['Lisboa', 'Porto'], tipos: ['T1', 'T2'],
      status: 'lead', origin: 'whatsapp', lead_score: 44,
      notes: 'Brasileiro. Visto D7 em processo. Orçamento flexível.'
    },
    {
      name: 'María García', email: 'mgarcia@empresarial.es',
      phone: '+34 91 234 5678', nationality: 'ES', language: 'es',
      budget_min: 400000, budget_max: 700000,
      zonas: ['Porto', 'Gaia'], tipos: ['T2', 'T3'],
      status: 'prospect', origin: 'referral', lead_score: 71,
      notes: '2ª residência. Porto por proximidade Espanha. Família.'
    }
  ])

  // ── PROPERTIES ───────────────────────────────────────────────────────────
  console.log('\n🏠 Seeding properties...')
  await supabaseRequest('DELETE', '/rest/v1/properties?preco=gt.0', null)

  await insert('properties', [
    {
      nome: 'Apartamento T3 Chiado — Vista Rio', zona: 'Lisboa', bairro: 'Chiado',
      tipo: 'Apartamento', preco: 1250000, area: 145, quartos: 3, casas_banho: 2,
      energia: 'A', status: 'ativo',
      descricao: 'T3 premium em pleno Chiado. Vistas Tejo deslumbrantes. Acabamentos de luxo. Terraço 25m². Edifício novo.',
      features: ['terraço', 'vista-rio', 'ar-condicionado', 'garagem', 'elevador'],
      gradient: 'from-emerald-800 to-green-900'
    },
    {
      nome: 'Moradia V4 Cascais Golf', zona: 'Cascais', bairro: 'Quinta da Marinha',
      tipo: 'Moradia', preco: 2800000, area: 380, quartos: 4, casas_banho: 4,
      energia: 'A+', status: 'ativo',
      descricao: 'Moradia V4 frente ao campo de golfe Oceano. Piscina infinity, jardim 800m², garagem dupla. Acesso privado praia.',
      features: ['piscina', 'garagem', 'jardim', 'smart-home', 'vista-mar'],
      gradient: 'from-blue-900 to-indigo-900'
    },
    {
      nome: 'Penthouse T4 Parque das Nações', zona: 'Lisboa', bairro: 'Parque das Nações',
      tipo: 'Penthouse', preco: 890000, area: 210, quartos: 4, casas_banho: 3,
      energia: 'A', status: 'ativo',
      descricao: 'Penthouse T4 duplex moderna. Terraço 90m² com 360° vista Tejo. Cozinha ilha, 2 lugares garagem.',
      features: ['terraço', 'vista-rio', 'garagem', 'ar-condicionado', 'elevador-privado'],
      gradient: 'from-slate-800 to-gray-900'
    },
    {
      nome: 'T2 Príncipe Real Renovado', zona: 'Lisboa', bairro: 'Príncipe Real',
      tipo: 'Apartamento', preco: 720000, area: 98, quartos: 2, casas_banho: 2,
      energia: 'B', status: 'ativo',
      descricao: 'T2 em edifício pombalino renovado coração de Lisboa. Tectos altos, luz natural. Walking distance tudo.',
      features: ['charmoso', 'renovado', 'localização-prime', 'tectos-altos'],
      gradient: 'from-amber-800 to-orange-900'
    },
    {
      nome: 'Moradia V3 Sintra Património', zona: 'Sintra', bairro: 'Centro Histórico',
      tipo: 'Moradia', preco: 520000, area: 280, quartos: 3, casas_banho: 3,
      energia: 'C', status: 'ativo',
      descricao: 'Quinta de charme em Sintra UNESCO. Terreno 1.200m². Alto potencial AL. Vistas Palácio da Pena.',
      features: ['jardim', 'pátio', 'potencial-al', 'vista-palácio'],
      gradient: 'from-green-900 to-teal-900'
    },
    {
      nome: 'T4 Belém Vista Tejo', zona: 'Lisboa', bairro: 'Belém',
      tipo: 'Apartamento', preco: 1100000, area: 185, quartos: 4, casas_banho: 3,
      energia: 'A', status: 'reservado',
      descricao: 'T4 totalmente renovado Belém. Janelas full-width vista Torre e Tejo. Elevador privativo, 2 garagens.',
      features: ['vista-tejo', 'renovado', 'garagem', 'elevador-privado'],
      gradient: 'from-red-900 to-rose-900'
    },
    {
      nome: 'T2 Alcântara Moderno', zona: 'Lisboa', bairro: 'Alcântara',
      tipo: 'Apartamento', preco: 320000, area: 75, quartos: 2, casas_banho: 1,
      energia: 'A', status: 'ativo',
      descricao: 'T2 novo em condomínio moderno Alcântara. Ginásio, rooftop partilhado com vista rio. Excelente investimento.',
      features: ['ginásio', 'rooftop', 'novo', 'porteiro'],
      gradient: 'from-purple-900 to-violet-900'
    },
    {
      nome: 'Villa Premium Vale do Lobo', zona: 'Algarve', bairro: 'Vale do Lobo',
      tipo: 'Moradia', preco: 3200000, area: 420, quartos: 5, casas_banho: 5,
      energia: 'A+', status: 'ativo',
      descricao: 'Villa de luxo 5 suites em Vale do Lobo. 3 piscinas, cinema, spa, 2000m² jardim tropical. 5 min praia dourada.',
      features: ['piscina', 'spa', 'cinema', 'jardim', 'smart-home', 'vista-mar'],
      gradient: 'from-cyan-900 to-teal-800'
    }
  ])

  // ── DEALS ────────────────────────────────────────────────────────────────
  console.log('\n💼 Seeding deals...')
  await supabaseRequest('DELETE', '/rest/v1/deals?valor=gt.0', null)

  await insert('deals', [
    {
      ref: 'AG-2026-0012', imovel: 'Apartamento T3 Chiado',
      valor: 1180000, fase: 'Negociação',
      comprador: 'James Mitchell',
      notas: 'Counter-offer pendente. Comprador aceitou €1.18M. CPCV target 20 Abril.',
      cpcv_date: '2026-04-20', escritura_date: '2026-06-15'
    },
    {
      ref: 'AG-2026-0011', imovel: 'Moradia V4 Cascais Golf',
      valor: 2650000, fase: 'CPCV',
      comprador: 'Khalid Al-Rashid',
      notas: 'CPCV assinado. Sinal €265K recebido. Escritura 30 Maio.',
      cpcv_date: '2026-03-28', escritura_date: '2026-05-30'
    },
    {
      ref: 'AG-2026-0010', imovel: 'Penthouse T4 Parque Nações',
      valor: 890000, fase: 'Visita',
      comprador: 'Pierre Dubois',
      notas: 'Visita agendada 8 Abril. Interesse muito elevado.',
      escritura_date: '2026-07-01'
    },
    {
      ref: 'AG-2026-0009', imovel: 'T2 Príncipe Real',
      valor: 680000, fase: 'Proposta',
      comprador: 'Charlotte Blake',
      notas: 'Proposta €680K enviada. Vendedor pediu €695K. Negociação em curso.',
      escritura_date: '2026-06-30'
    },
    {
      ref: 'AG-2026-0008', imovel: 'Moradia V3 Sintra',
      valor: 520000, fase: 'Qualificação',
      comprador: 'Sophie Hartmann',
      notas: 'Qualificação financeira em curso. Pré-aprovação banco solicitada.',
      escritura_date: '2026-08-15'
    },
    {
      ref: 'AG-2026-0007', imovel: 'T4 Belém Vista Tejo',
      valor: 1050000, fase: 'Escritura',
      comprador: 'Marco Aurelio Santos',
      notas: 'Escritura 10 Abril. Documentação completa. Notário confirmado.',
      cpcv_date: '2026-02-15', escritura_date: '2026-04-10'
    },
    {
      ref: 'AG-2026-0006', imovel: 'T2 Alcântara Moderno',
      valor: 320000, fase: 'Contacto',
      comprador: 'Ana Beatriz Costa',
      notas: 'Primeiro contacto. Visita a confirmar.',
      escritura_date: '2026-09-01'
    },
    {
      ref: 'AG-2026-0005', imovel: 'Villa Algarve Premium',
      valor: 3200000, fase: 'Negociação',
      comprador: 'Khalid Al-Rashid',
      notas: 'Proposta €3.1M rejeitada. Nova proposta €3.2M enviada. Urgente.',
      escritura_date: '2026-07-30'
    }
  ])

  // ── MARKET DATA ──────────────────────────────────────────────────────────
  console.log('\n📊 Seeding market data...')
  await supabaseRequest('DELETE', '/rest/v1/market_data?preco_m2=gt.0', null)

  await insert('market_data', [
    { zona: 'Lisboa', preco_m2: 5000, yield_bruto: 4.2, yoy_percent: 18.2, dias_mercado: 145 },
    { zona: 'Cascais', preco_m2: 4713, yield_bruto: 3.8, yoy_percent: 15.8, dias_mercado: 168 },
    { zona: 'Algarve', preco_m2: 3941, yield_bruto: 6.5, yoy_percent: 22.1, dias_mercado: 195 },
    { zona: 'Porto', preco_m2: 3643, yield_bruto: 5.1, yoy_percent: 16.4, dias_mercado: 178 },
    { zona: 'Madeira', preco_m2: 3760, yield_bruto: 7.2, yoy_percent: 19.3, dias_mercado: 210 },
    { zona: 'Sintra', preco_m2: 3200, yield_bruto: 4.8, yoy_percent: 14.2, dias_mercado: 190 },
    { zona: 'Oeiras', preco_m2: 4100, yield_bruto: 4.1, yoy_percent: 16.9, dias_mercado: 155 },
    { zona: 'Setubal', preco_m2: 2200, yield_bruto: 5.8, yoy_percent: 13.5, dias_mercado: 220 },
    { zona: 'Braga', preco_m2: 2100, yield_bruto: 6.1, yoy_percent: 15.1, dias_mercado: 235 },
    { zona: 'Acores', preco_m2: 1952, yield_bruto: 8.5, yoy_percent: 12.1, dias_mercado: 245 }
  ])

  console.log('\n✅ Seed complete!\n')

  // Verify counts
  for (const table of ['contacts', 'properties', 'deals', 'market_data']) {
    const r = await supabaseRequest('GET', `/rest/v1/${table}?select=id`, null)
    try {
      const count = JSON.parse(r.body).length
      console.log(`  ${table}: ${count} records`)
    } catch {
      console.log(`  ${table}: error reading`)
    }
  }
}

main().catch(console.error)
