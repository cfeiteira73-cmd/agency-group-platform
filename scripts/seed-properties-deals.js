/**
 * Seed properties and deals into Supabase
 */
const https = require('https')

const URL = 'isbfiofwpxqqpgxoftph.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYmZpb2Z3cHhxcXBneG9mdHBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIyMDc4MSwiZXhwIjoyMDkwNzk2NzgxfQ.uqhKUsiEVLzFJ8f5e8ZWQFwJiZqDR-tYkgyOwwv7tcU'
const AGENT_ID = '27062d13-aa1e-45c9-b7a6-2b943f88e1ab'

function req(method, path, body) {
  return new Promise(resolve => {
    const data = body ? JSON.stringify(body) : null
    const opts = {
      hostname: URL, path, method,
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data)
    const r = https.request(opts, res => {
      let o = ''
      res.on('data', d => o += d)
      res.on('end', () => resolve({ s: res.statusCode, b: o }))
    })
    r.on('error', () => resolve({ s: 0, b: 'error' }))
    if (data) r.write(data)
    r.end()
  })
}

function get(path) {
  return new Promise(resolve => {
    const opts = { hostname: URL, path, headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY } }
    https.get(opts, res => {
      let o = ''
      res.on('data', d => o += d)
      res.on('end', () => {
        try { resolve(JSON.parse(o)) } catch { resolve([]) }
      })
    })
  })
}

async function main() {
  console.log('\n🏠 Seeding properties...')

  // Delete old seed data
  await req('DELETE', '/rest/v1/properties?id=gte.1001&id=lte.1008', null)

  const props = [
    { id: 1001, nome: 'Apartamento T3 Chiado Vista Rio', zona: 'Lisboa', bairro: 'Chiado', tipo: 'Apartamento', preco: 1250000, area: 145, quartos: 3, casas_banho: 2, energia: 'A', status: 'active', descricao: 'T3 premium em pleno Chiado. Vistas Tejo. Terraço 25m2. Acabamentos luxo.', features: ['terraco', 'vista-rio', 'garagem'], gradient: 'from-emerald-800 to-green-900', agent_id: AGENT_ID },
    { id: 1002, nome: 'Moradia V4 Cascais Golf', zona: 'Cascais', bairro: 'Quinta da Marinha', tipo: 'Moradia', preco: 2800000, area: 380, quartos: 4, casas_banho: 4, energia: 'A+', status: 'active', descricao: 'V4 Oceano Golf. Piscina, jardim 800m2. Acesso directo praia.', features: ['piscina', 'jardim', 'garagem', 'vista-mar'], gradient: 'from-blue-900 to-indigo-900', agent_id: AGENT_ID },
    { id: 1003, nome: 'Penthouse T4 Parque Nacoes', zona: 'Lisboa', bairro: 'Parque das Nacoes', tipo: 'Penthouse', preco: 890000, area: 210, quartos: 4, casas_banho: 3, energia: 'A', status: 'active', descricao: 'T4 duplex moderno. Terraco 90m2 vista Tejo. 2 garagens.', features: ['terraco', 'vista-rio', 'garagem'], gradient: 'from-slate-800 to-gray-900', agent_id: AGENT_ID },
    { id: 1004, nome: 'T2 Principe Real Renovado', zona: 'Lisboa', bairro: 'Principe Real', tipo: 'Apartamento', preco: 720000, area: 98, quartos: 2, casas_banho: 2, energia: 'B', status: 'active', descricao: 'Pombalino renovado. Localizacao prime. Tectos altos, luz natural.', features: ['renovado', 'localizacao-prime'], gradient: 'from-amber-800 to-orange-900', agent_id: AGENT_ID },
    { id: 1005, nome: 'Moradia V3 Sintra Patrimonio', zona: 'Sintra', bairro: 'Centro Historico', tipo: 'Moradia', preco: 520000, area: 280, quartos: 3, casas_banho: 3, energia: 'C', status: 'active', descricao: 'Quinta Sintra UNESCO. 1200m2 terreno. Alto potencial AL.', features: ['jardim', 'potencial-al'], gradient: 'from-green-900 to-teal-900', agent_id: AGENT_ID },
    { id: 1006, nome: 'T4 Belem Vista Tejo', zona: 'Lisboa', bairro: 'Belem', tipo: 'Apartamento', preco: 1100000, area: 185, quartos: 4, casas_banho: 3, energia: 'A', status: 'reserved', descricao: 'T4 renovado Belem. Full-width vista Torre e Tejo.', features: ['vista-tejo', 'renovado', 'garagem'], gradient: 'from-red-900 to-rose-900', agent_id: AGENT_ID },
    { id: 1007, nome: 'T2 Alcantara Moderno', zona: 'Lisboa', bairro: 'Alcantara', tipo: 'Apartamento', preco: 320000, area: 75, quartos: 2, casas_banho: 1, energia: 'A', status: 'active', descricao: 'T2 novo condominio moderno. Ginasio, rooftop vista rio.', features: ['ginasio', 'rooftop', 'novo'], gradient: 'from-purple-900 to-violet-900', agent_id: AGENT_ID },
    { id: 1008, nome: 'Villa Premium Vale do Lobo', zona: 'Algarve', bairro: 'Vale do Lobo', tipo: 'Moradia', preco: 3200000, area: 420, quartos: 5, casas_banho: 5, energia: 'A+', status: 'active', descricao: 'Villa 5 suites. 3 piscinas, spa, 2000m2 jardim tropical. 5min praia.', features: ['piscina', 'spa', 'jardim', 'vista-mar'], gradient: 'from-cyan-900 to-teal-800', agent_id: AGENT_ID }
  ]

  const pr = await req('POST', '/rest/v1/properties', props)
  console.log('Properties:', pr.s === 201 ? '✓ 8 records' : '✗ ' + pr.b.slice(0, 200))

  // Update contacts with agent_id
  const ua = await req('PATCH', '/rest/v1/contacts?lead_score=gt.0', { agent_id: AGENT_ID })
  console.log('Contacts agent_id:', ua.s === 204 ? '✓ updated' : ua.s)

  // Get contact IDs
  const contacts = await get('/rest/v1/contacts?select=id,name&lead_score=gt.0&order=lead_score.desc&limit=10')
  console.log('Contacts loaded:', contacts.length)

  const cmap = {}
  contacts.forEach(c => {
    cmap[c.name] = c.id
  })

  // Find contact IDs
  const jamesId = contacts.find(c => c.name.includes('Mitchell'))?.id || null
  const khalidId = contacts.find(c => c.name.includes('Khalid'))?.id || null
  const pierreId = contacts.find(c => c.name.includes('Pierre'))?.id || null
  const charlotteId = contacts.find(c => c.name.includes('Charlotte'))?.id || null
  const sophieId = contacts.find(c => c.name.includes('Sophie'))?.id || null
  const marcoId = contacts.find(c => c.name.includes('Marco'))?.id || null
  const anaId = contacts.find(c => c.name.includes('Ana'))?.id || null

  console.log('\n💼 Seeding deals...')
  await req('DELETE', '/rest/v1/deals?valor=gt.0', null)

  // ALL deals must have SAME keys — PostgREST v12 requirement
  const deals = [
    { ref: 'AG-2026-0012', imovel: 'Apartamento T3 Chiado', property_id: 1001, valor: 1180000, fase: 'Negociacao', comprador: 'James Mitchell', contact_id: jamesId, cpcv_date: '2026-04-20', escritura_date: '2026-06-15', notas: 'Counter-offer pendente. EUR1.18M acordado. CPCV 20 Abril.', agent_id: AGENT_ID },
    { ref: 'AG-2026-0011', imovel: 'Moradia V4 Cascais Golf', property_id: 1002, valor: 2650000, fase: 'CPCV', comprador: 'Khalid Al-Rashid', contact_id: khalidId, cpcv_date: '2026-03-28', escritura_date: '2026-05-30', notas: 'CPCV assinado. Sinal EUR265K recebido. Escritura 30 Maio.', agent_id: AGENT_ID },
    { ref: 'AG-2026-0010', imovel: 'Penthouse T4 Parque Nacoes', property_id: 1003, valor: 890000, fase: 'Visita', comprador: 'Pierre Dubois', contact_id: pierreId, cpcv_date: null, escritura_date: '2026-07-01', notas: 'Visita agendada 8 Abril. Interesse elevado.', agent_id: AGENT_ID },
    { ref: 'AG-2026-0009', imovel: 'T2 Principe Real', property_id: 1004, valor: 680000, fase: 'Proposta', comprador: 'Charlotte Blake', contact_id: charlotteId, cpcv_date: null, escritura_date: '2026-06-30', notas: 'Proposta EUR680K. Vendedor EUR695K. Negociacao activa.', agent_id: AGENT_ID },
    { ref: 'AG-2026-0008', imovel: 'Moradia V3 Sintra', property_id: 1005, valor: 520000, fase: 'Qualificacao', comprador: 'Sophie Hartmann', contact_id: sophieId, cpcv_date: null, escritura_date: '2026-08-15', notas: 'Qualificacao financeira em curso. Pre-aprovacao solicitada.', agent_id: AGENT_ID },
    { ref: 'AG-2026-0007', imovel: 'T4 Belem Vista Tejo', property_id: 1006, valor: 1050000, fase: 'Escritura', comprador: 'Marco Aurelio Santos', contact_id: marcoId, cpcv_date: '2026-02-15', escritura_date: '2026-04-10', notas: 'Escritura 10 Abril. Documentacao completa. Notario confirmado.', agent_id: AGENT_ID },
    { ref: 'AG-2026-0006', imovel: 'T2 Alcantara Moderno', property_id: 1007, valor: 320000, fase: 'Contacto', comprador: 'Ana Beatriz Costa', contact_id: anaId, cpcv_date: null, escritura_date: '2026-09-01', notas: 'Primeiro contacto. Visita a confirmar.', agent_id: AGENT_ID },
    { ref: 'AG-2026-0005', imovel: 'Villa Algarve Premium', property_id: 1008, valor: 3200000, fase: 'Negociacao', comprador: 'Khalid Al-Rashid', contact_id: khalidId, cpcv_date: null, escritura_date: '2026-07-30', notas: 'Proposta EUR3.1M rejeitada. Nova EUR3.2M enviada. Urgente.', agent_id: AGENT_ID }
  ]

  const dr = await req('POST', '/rest/v1/deals', deals)
  console.log('Deals:', dr.s === 201 ? '✓ 8 records' : '✗ ' + dr.b.slice(0, 200))

  // Final count verification
  console.log('\n📊 Final counts:')
  for (const t of ['contacts', 'properties', 'deals', 'market_data']) {
    const data = await get('/rest/v1/' + t + '?select=id')
    console.log('  ' + t + ': ' + data.length)
  }

  console.log('\n✅ Database seeded!\n')
}

main().catch(console.error)
