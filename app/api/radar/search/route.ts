import { NextRequest, NextResponse } from 'next/server'

// ─── Rate limit 10 searches/hour ──────────────────────────────────────────────
const rateMap = new Map<string, { count: number; reset: number }>()
function checkRate(ip: string): boolean {
  const now = Date.now()
  const e = rateMap.get(ip)
  if (!e || now > e.reset) { rateMap.set(ip, { count: 1, reset: now + 3600000 }); return true }
  if (e.count >= 10) return false
  e.count++; return true
}

// ─── Zone market data ─────────────────────────────────────────────────────────
interface ZM {
  pm2_trans: number; pm2_ask: number; var_yoy: number; renda_m2: number
  yield_bruto: number; liquidez: number; demanda: number; risco: number
  yield_al: number; region: string
}

const ZONES: Record<string, ZM> = {
  'Lisboa':                     { pm2_trans:5000, pm2_ask:5400, var_yoy:22.0, renda_m2:18.5, yield_bruto:4.4, liquidez:8.5, demanda:9.0, risco:3.5, yield_al:6.8, region:'Lisboa' },
  'Lisboa — Chiado/Santos':     { pm2_trans:7000, pm2_ask:7500, var_yoy:20.0, renda_m2:25.0, yield_bruto:4.3, liquidez:9.0, demanda:9.5, risco:3.0, yield_al:8.2, region:'Lisboa' },
  'Lisboa — Príncipe Real':     { pm2_trans:7400, pm2_ask:7900, var_yoy:19.0, renda_m2:26.0, yield_bruto:4.2, liquidez:8.5, demanda:9.5, risco:3.0, yield_al:7.9, region:'Lisboa' },
  'Lisboa — Parque das Nações': { pm2_trans:5200, pm2_ask:5600, var_yoy:23.0, renda_m2:18.5, yield_bruto:4.3, liquidez:8.5, demanda:8.5, risco:3.2, yield_al:7.0, region:'Lisboa' },
  'Lisboa — Beato/Marvila':     { pm2_trans:4500, pm2_ask:4900, var_yoy:30.0, renda_m2:15.5, yield_bruto:4.1, liquidez:7.0, demanda:8.5, risco:4.0, yield_al:6.0, region:'Lisboa' },
  'Lisboa — Alfama/Mouraria':   { pm2_trans:5200, pm2_ask:5600, var_yoy:18.0, renda_m2:18.5, yield_bruto:4.3, liquidez:7.5, demanda:8.0, risco:3.5, yield_al:8.5, region:'Lisboa' },
  'Lisboa — Alcântara':         { pm2_trans:4900, pm2_ask:5300, var_yoy:22.0, renda_m2:17.0, yield_bruto:4.1, liquidez:7.5, demanda:8.0, risco:3.6, yield_al:6.5, region:'Lisboa' },
  'Lisboa — Campo de Ourique':  { pm2_trans:5700, pm2_ask:6100, var_yoy:17.0, renda_m2:20.0, yield_bruto:4.2, liquidez:8.0, demanda:8.5, risco:3.3, yield_al:6.5, region:'Lisboa' },
  'Lisboa — Avenidas Novas':    { pm2_trans:5500, pm2_ask:5900, var_yoy:19.0, renda_m2:19.5, yield_bruto:4.2, liquidez:8.0, demanda:8.5, risco:3.3, yield_al:6.8, region:'Lisboa' },
  'Oeiras':                     { pm2_trans:4000, pm2_ask:4300, var_yoy:20.0, renda_m2:14.0, yield_bruto:4.2, liquidez:8.0, demanda:8.0, risco:3.3, yield_al:5.5, region:'AML' },
  'Cascais':                    { pm2_trans:4700, pm2_ask:5100, var_yoy:18.0, renda_m2:16.0, yield_bruto:4.1, liquidez:8.0, demanda:8.0, risco:3.4, yield_al:6.5, region:'Cascais/Sintra' },
  'Cascais — Centro':           { pm2_trans:5400, pm2_ask:5800, var_yoy:17.0, renda_m2:18.0, yield_bruto:4.0, liquidez:8.0, demanda:8.5, risco:3.3, yield_al:7.0, region:'Cascais/Sintra' },
  'Estoril':                    { pm2_trans:5000, pm2_ask:5400, var_yoy:17.0, renda_m2:16.5, yield_bruto:3.9, liquidez:7.5, demanda:7.5, risco:3.4, yield_al:6.8, region:'Cascais/Sintra' },
  'Sintra':                     { pm2_trans:3400, pm2_ask:3700, var_yoy:15.0, renda_m2:12.0, yield_bruto:4.2, liquidez:6.5, demanda:7.0, risco:4.0, yield_al:5.5, region:'Cascais/Sintra' },
  'Ericeira':                   { pm2_trans:3700, pm2_ask:4000, var_yoy:21.0, renda_m2:13.0, yield_bruto:4.2, liquidez:7.0, demanda:7.5, risco:3.8, yield_al:7.5, region:'Cascais/Sintra' },
  'Porto':                      { pm2_trans:3600, pm2_ask:3900, var_yoy:19.0, renda_m2:13.0, yield_bruto:4.3, liquidez:8.0, demanda:8.5, risco:3.5, yield_al:7.2, region:'Porto' },
  'Porto — Foz/Nevogilde':      { pm2_trans:5400, pm2_ask:5800, var_yoy:20.0, renda_m2:18.0, yield_bruto:4.0, liquidez:8.0, demanda:8.5, risco:3.3, yield_al:7.5, region:'Porto' },
  'Porto — Boavista':           { pm2_trans:4400, pm2_ask:4700, var_yoy:18.0, renda_m2:15.0, yield_bruto:4.1, liquidez:8.0, demanda:8.0, risco:3.5, yield_al:7.0, region:'Porto' },
  'Porto — Bonfim/Campanhã':    { pm2_trans:3700, pm2_ask:4000, var_yoy:22.0, renda_m2:13.5, yield_bruto:4.3, liquidez:8.0, demanda:8.5, risco:3.7, yield_al:7.8, region:'Porto' },
  'Porto — Ribeira/Miragaia':   { pm2_trans:4100, pm2_ask:4400, var_yoy:19.0, renda_m2:14.5, yield_bruto:4.2, liquidez:7.5, demanda:8.0, risco:3.5, yield_al:9.0, region:'Porto' },
  'Matosinhos':                 { pm2_trans:3100, pm2_ask:3400, var_yoy:19.0, renda_m2:11.5, yield_bruto:4.4, liquidez:7.5, demanda:7.5, risco:3.7, yield_al:7.0, region:'Porto' },
  'Matosinhos — Mar':           { pm2_trans:3800, pm2_ask:4100, var_yoy:21.0, renda_m2:14.0, yield_bruto:4.4, liquidez:8.0, demanda:8.0, risco:3.5, yield_al:8.5, region:'Porto' },
  'Vila Nova de Gaia':          { pm2_trans:2800, pm2_ask:3000, var_yoy:18.0, renda_m2:10.0, yield_bruto:4.3, liquidez:7.5, demanda:7.5, risco:3.8, yield_al:6.5, region:'Porto' },
  'Algarve':                    { pm2_trans:3900, pm2_ask:4200, var_yoy:19.0, renda_m2:14.0, yield_bruto:4.3, liquidez:7.0, demanda:7.5, risco:3.8, yield_al:8.5, region:'Algarve' },
  'Quinta do Lago':             { pm2_trans:12000,pm2_ask:13500,var_yoy:15.0, renda_m2:42.0, yield_bruto:4.2, liquidez:6.0, demanda:7.0, risco:3.5, yield_al:9.0, region:'Algarve' },
  'Vilamoura':                  { pm2_trans:5000, pm2_ask:5400, var_yoy:18.0, renda_m2:17.5, yield_bruto:4.2, liquidez:7.0, demanda:7.5, risco:3.6, yield_al:8.8, region:'Algarve' },
  'Lagos':                      { pm2_trans:4400, pm2_ask:4800, var_yoy:19.0, renda_m2:15.5, yield_bruto:4.2, liquidez:7.0, demanda:7.5, risco:3.7, yield_al:8.5, region:'Algarve' },
  'Albufeira':                  { pm2_trans:3700, pm2_ask:4000, var_yoy:19.0, renda_m2:13.5, yield_bruto:4.4, liquidez:7.0, demanda:7.5, risco:3.8, yield_al:9.0, region:'Algarve' },
  'Comporta':                   { pm2_trans:8500, pm2_ask:9500, var_yoy:12.0, renda_m2:29.0, yield_bruto:4.1, liquidez:6.0, demanda:7.0, risco:4.0, yield_al:9.5, region:'Alentejo Litoral' },
  'Braga':                      { pm2_trans:2700, pm2_ask:2950, var_yoy:20.0, renda_m2:10.0, yield_bruto:4.4, liquidez:7.0, demanda:7.5, risco:4.0, yield_al:6.5, region:'Minho' },
  'Coimbra':                    { pm2_trans:2300, pm2_ask:2500, var_yoy:17.0, renda_m2:9.0,  yield_bruto:4.7, liquidez:6.5, demanda:7.0, risco:4.2, yield_al:6.0, region:'Centro' },
  'Aveiro':                     { pm2_trans:2500, pm2_ask:2700, var_yoy:18.0, renda_m2:9.5,  yield_bruto:4.6, liquidez:6.5, demanda:7.0, risco:4.0, yield_al:6.5, region:'Centro' },
  'Madeira — Funchal':          { pm2_trans:4200, pm2_ask:4600, var_yoy:19.0, renda_m2:15.0, yield_bruto:4.3, liquidez:7.5, demanda:7.5, risco:3.7, yield_al:9.0, region:'Madeira' },
  'Madeira — Funchal Centro':   { pm2_trans:4700, pm2_ask:5100, var_yoy:20.0, renda_m2:17.0, yield_bruto:4.3, liquidez:7.5, demanda:8.0, risco:3.6, yield_al:9.5, region:'Madeira' },
  'Madeira — Calheta':          { pm2_trans:4400, pm2_ask:4800, var_yoy:19.0, renda_m2:15.5, yield_bruto:4.2, liquidez:6.0, demanda:7.0, risco:4.0, yield_al:9.0, region:'Madeira' },
  'Açores — Ponta Delgada':     { pm2_trans:2000, pm2_ask:2200, var_yoy:14.0, renda_m2:8.5,  yield_bruto:5.1, liquidez:6.0, demanda:6.5, risco:4.8, yield_al:7.5, region:'Açores' },
}

function getZM(zona: string): ZM {
  return ZONES[zona] ?? { pm2_trans:2500, pm2_ask:2700, var_yoy:15.0, renda_m2:9.0, yield_bruto:4.5, liquidez:6.0, demanda:6.0, risco:5.0, yield_al:6.0, region:'Portugal' }
}

// ─── Zone → Idealista URL ─────────────────────────────────────────────────────
const ZONA_TO_IDEALISTA: Record<string, string> = {
  'Lisboa':             'https://www.idealista.pt/comprar-casas/lisboa/',
  'Porto':              'https://www.idealista.pt/comprar-casas/porto/',
  'Cascais':            'https://www.idealista.pt/comprar-casas/cascais/',
  'Sintra':             'https://www.idealista.pt/comprar-casas/sintra/',
  'Oeiras':             'https://www.idealista.pt/comprar-casas/oeiras/',
  'Algarve':            'https://www.idealista.pt/comprar-casas/faro/',
  'Lagos':              'https://www.idealista.pt/comprar-casas/lagos/',
  'Albufeira':          'https://www.idealista.pt/comprar-casas/albufeira/',
  'Vilamoura':          'https://www.idealista.pt/comprar-casas/quarteira/',
  'Comporta':           'https://www.idealista.pt/comprar-casas/grândola/',
  'Braga':              'https://www.idealista.pt/comprar-casas/braga/',
  'Coimbra':            'https://www.idealista.pt/comprar-casas/coimbra/',
  'Aveiro':             'https://www.idealista.pt/comprar-casas/aveiro/',
  'Madeira — Funchal':  'https://www.idealista.pt/comprar-casas/funchal/',
  'Açores — Ponta Delgada': 'https://www.idealista.pt/comprar-casas/ponta-delgada/',
  'Nacional':           'https://www.idealista.pt/comprar-casas/portugal/',
}

// ─── Zone detection ───────────────────────────────────────────────────────────
function detectZona(t: string): string {
  const s = t.toLowerCase()
  if (/chiado|príncipe real|bairro alto|santos/.test(s)) return 'Lisboa — Chiado/Santos'
  if (/parque das nações|oriente|expo/.test(s)) return 'Lisboa — Parque das Nações'
  if (/marvila|beato/.test(s)) return 'Lisboa — Beato/Marvila'
  if (/alfama|mouraria/.test(s)) return 'Lisboa — Alfama/Mouraria'
  if (/alcântara|alcantara/.test(s)) return 'Lisboa — Alcântara'
  if (/campo de ourique/.test(s)) return 'Lisboa — Campo de Ourique'
  if (/avenidas novas|marquês/.test(s)) return 'Lisboa — Avenidas Novas'
  if (/quinta da marinha/.test(s)) return 'Cascais — Centro'
  if (/estoril/.test(s)) return 'Estoril'
  if (/cascais/.test(s)) return 'Cascais'
  if (/oeiras|carcavelos|paço de arcos/.test(s)) return 'Oeiras'
  if (/foz do douro|nevogilde/.test(s)) return 'Porto — Foz/Nevogilde'
  if (/boavista/.test(s)) return 'Porto — Boavista'
  if (/bonfim|campanhã/.test(s)) return 'Porto — Bonfim/Campanhã'
  if (/ribeira|miragaia/.test(s)) return 'Porto — Ribeira/Miragaia'
  if (/matosinhos.*mar/.test(s)) return 'Matosinhos — Mar'
  if (/matosinhos/.test(s)) return 'Matosinhos'
  if (/gaia|vila nova de gaia/.test(s)) return 'Vila Nova de Gaia'
  if (/porto/.test(s)) return 'Porto'
  if (/quinta do lago/.test(s)) return 'Quinta do Lago'
  if (/vilamoura|quarteira/.test(s)) return 'Vilamoura'
  if (/lagos\b/.test(s)) return 'Lagos'
  if (/albufeira/.test(s)) return 'Albufeira'
  if (/algarve|faro|portimão|tavira|olhão/.test(s)) return 'Algarve'
  if (/comporta/.test(s)) return 'Comporta'
  if (/funchal.*centro|centro.*funchal/.test(s)) return 'Madeira — Funchal Centro'
  if (/calheta/.test(s)) return 'Madeira — Calheta'
  if (/funchal|madeira/.test(s)) return 'Madeira — Funchal'
  if (/ponta delgada|açores|acores|azores/.test(s)) return 'Açores — Ponta Delgada'
  if (/ericeira/.test(s)) return 'Ericeira'
  if (/sintra/.test(s)) return 'Sintra'
  if (/braga/.test(s)) return 'Braga'
  if (/coimbra/.test(s)) return 'Coimbra'
  if (/aveiro/.test(s)) return 'Aveiro'
  if (/lisbo/.test(s)) return 'Lisboa'
  return 'Lisboa'
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
function quickScore(preco: number, area: number, zm: ZM, tipoVenda: string): number {
  let score = 52
  if (preco > 0 && area > 0 && zm.pm2_trans > 0) {
    const pm2 = preco / area
    const diff = (zm.pm2_trans - pm2) / zm.pm2_trans
    score += Math.min(28, Math.round(diff * 110))
    score -= Math.max(-15, Math.round(diff * 60))
  }
  score += Math.round((zm.demanda  - 5) * 1.8)
  score += Math.round((zm.liquidez - 5) * 1.5)
  score -= Math.round(zm.risco * 1.5)
  if (preco > 0 && area > 0) {
    const yB = (zm.renda_m2 * area * 12) / preco * 100
    if (yB > 5.0) score += 4
    if (yB > 6.0) score += 4
    if (yB > 7.0) score += 4
  }
  if (tipoVenda === 'leilao_judicial') score += 14
  else if (tipoVenda === 'leilao_fiscal') score += 10
  else if (tipoVenda === 'venda_judicial') score += 12
  else if (tipoVenda === 'imovel_banca') score += 7
  if (zm.var_yoy > 20) score += 5
  else if (zm.var_yoy > 15) score += 2
  return Math.max(10, Math.min(99, score))
}

function getClassificacao(score: number): string {
  if (score >= 88) return '🔥 ATAQUE IMEDIATO'
  if (score >= 78) return '⭐ PRIORITÁRIO'
  if (score >= 68) return '✅ BOM NEGÓCIO'
  if (score >= 55) return '⚖️ VALOR JUSTO'
  if (score >= 40) return '⚠️ SOBREVALORIZADO'
  return '❌ EVITAR'
}

// ─── Tipo de Imóvel ───────────────────────────────────────────────────────────
type TipoImovel = 'apartamento' | 'moradia' | 'terreno' | 'quinta' | 'comercial' | 'edificio' | 'hotel' | 'todos'

// ─── Zone Benchmarks (commercial + land + hospitality by region) ──────────────
interface ZoneBenchmarks {
  renda_escritorio_m2: number   // €/m²/mês escritório prime
  renda_loja_m2: number         // €/m²/mês loja prime
  prime_yield_escritorio: number // cap rate benchmark escritórios %
  prime_yield_loja: number       // cap rate benchmark lojas %
  pm2_comercial: number          // €/m² transacção comercial
  custo_construcao_m2: number    // €/m² construção (estrutura+acabamentos)
  indice_construcao: number      // ABC/área terreno (ex: 1.5 = constrói 150% da área)
  pm2_terreno_urbano: number     // €/m² terreno urbano benchmark
  preco_ha_agricola: number      // €/ha terreno agrícola benchmark
  yield_agricola_pct: number     // % rendimento agrícola anual
  turismo_multiplier: number     // multiplicador potencial turístico (1-5)
  adr_benchmark: number          // ADR hotel benchmark €/noite
  occupancy_benchmark: number    // taxa ocupação hotel benchmark (0-1)
  price_per_key_benchmark: number // €/quarto benchmark hotel 4*
  desconto_soma_partes: number   // desconto típico edifício inteiro vs NAV (0-1)
}

const BENCHMARKS: Record<string, ZoneBenchmarks> = {
  'Lisboa':           { renda_escritorio_m2:22, renda_loja_m2:28, prime_yield_escritorio:4.75, prime_yield_loja:5.25, pm2_comercial:5500, custo_construcao_m2:1650, indice_construcao:2.0, pm2_terreno_urbano:900,  preco_ha_agricola:40000, yield_agricola_pct:2.0, turismo_multiplier:3.5, adr_benchmark:180, occupancy_benchmark:0.74, price_per_key_benchmark:260000, desconto_soma_partes:0.20 },
  'Cascais/Sintra':   { renda_escritorio_m2:16, renda_loja_m2:20, prime_yield_escritorio:5.25, prime_yield_loja:5.75, pm2_comercial:4500, custo_construcao_m2:1600, indice_construcao:1.5, pm2_terreno_urbano:650,  preco_ha_agricola:35000, yield_agricola_pct:2.0, turismo_multiplier:3.0, adr_benchmark:145, occupancy_benchmark:0.68, price_per_key_benchmark:210000, desconto_soma_partes:0.20 },
  'AML':              { renda_escritorio_m2:14, renda_loja_m2:16, prime_yield_escritorio:5.50, prime_yield_loja:6.00, pm2_comercial:3500, custo_construcao_m2:1500, indice_construcao:1.5, pm2_terreno_urbano:400,  preco_ha_agricola:25000, yield_agricola_pct:2.5, turismo_multiplier:2.0, adr_benchmark:100, occupancy_benchmark:0.60, price_per_key_benchmark:120000, desconto_soma_partes:0.22 },
  'Porto':            { renda_escritorio_m2:17, renda_loja_m2:20, prime_yield_escritorio:5.00, prime_yield_loja:5.50, pm2_comercial:4000, custo_construcao_m2:1500, indice_construcao:1.8, pm2_terreno_urbano:620,  preco_ha_agricola:30000, yield_agricola_pct:2.5, turismo_multiplier:3.0, adr_benchmark:145, occupancy_benchmark:0.72, price_per_key_benchmark:190000, desconto_soma_partes:0.20 },
  'Algarve':          { renda_escritorio_m2:12, renda_loja_m2:18, prime_yield_escritorio:5.75, prime_yield_loja:6.00, pm2_comercial:3500, custo_construcao_m2:1500, indice_construcao:1.2, pm2_terreno_urbano:420,  preco_ha_agricola:25000, yield_agricola_pct:3.5, turismo_multiplier:4.5, adr_benchmark:150, occupancy_benchmark:0.68, price_per_key_benchmark:190000, desconto_soma_partes:0.22 },
  'Alentejo Litoral': { renda_escritorio_m2:8,  renda_loja_m2:12, prime_yield_escritorio:6.50, prime_yield_loja:7.00, pm2_comercial:2500, custo_construcao_m2:1400, indice_construcao:0.8, pm2_terreno_urbano:250,  preco_ha_agricola:15000, yield_agricola_pct:3.0, turismo_multiplier:5.0, adr_benchmark:210, occupancy_benchmark:0.55, price_per_key_benchmark:320000, desconto_soma_partes:0.25 },
  'Minho':            { renda_escritorio_m2:10, renda_loja_m2:14, prime_yield_escritorio:5.75, prime_yield_loja:6.25, pm2_comercial:2800, custo_construcao_m2:1400, indice_construcao:1.5, pm2_terreno_urbano:350,  preco_ha_agricola:20000, yield_agricola_pct:3.5, turismo_multiplier:2.5, adr_benchmark:85,  occupancy_benchmark:0.62, price_per_key_benchmark:105000, desconto_soma_partes:0.22 },
  'Centro':           { renda_escritorio_m2:9,  renda_loja_m2:12, prime_yield_escritorio:6.00, prime_yield_loja:6.50, pm2_comercial:2200, custo_construcao_m2:1400, indice_construcao:1.4, pm2_terreno_urbano:280,  preco_ha_agricola:18000, yield_agricola_pct:3.0, turismo_multiplier:2.0, adr_benchmark:70,  occupancy_benchmark:0.58, price_per_key_benchmark:80000,  desconto_soma_partes:0.22 },
  'Madeira':          { renda_escritorio_m2:14, renda_loja_m2:18, prime_yield_escritorio:5.50, prime_yield_loja:6.00, pm2_comercial:3800, custo_construcao_m2:1750, indice_construcao:1.3, pm2_terreno_urbano:480,  preco_ha_agricola:32000, yield_agricola_pct:4.0, turismo_multiplier:4.0, adr_benchmark:135, occupancy_benchmark:0.70, price_per_key_benchmark:165000, desconto_soma_partes:0.22 },
  'Açores':           { renda_escritorio_m2:10, renda_loja_m2:13, prime_yield_escritorio:6.50, prime_yield_loja:7.00, pm2_comercial:2000, custo_construcao_m2:1800, indice_construcao:1.2, pm2_terreno_urbano:200,  preco_ha_agricola:15000, yield_agricola_pct:4.5, turismo_multiplier:3.5, adr_benchmark:95,  occupancy_benchmark:0.62, price_per_key_benchmark:105000, desconto_soma_partes:0.25 },
  'Portugal':         { renda_escritorio_m2:12, renda_loja_m2:15, prime_yield_escritorio:5.75, prime_yield_loja:6.25, pm2_comercial:3000, custo_construcao_m2:1500, indice_construcao:1.5, pm2_terreno_urbano:350,  preco_ha_agricola:20000, yield_agricola_pct:3.0, turismo_multiplier:3.0, adr_benchmark:120, occupancy_benchmark:0.65, price_per_key_benchmark:150000, desconto_soma_partes:0.22 },
}

function getBenchmarks(zm: ZM): ZoneBenchmarks {
  return BENCHMARKS[zm.region] ?? BENCHMARKS['Portugal']
}

// ─── Sale type bonus (shared by all scorers) ──────────────────────────────────
function saleBonus(tipoVenda: string): number {
  if (tipoVenda === 'leilao_judicial') return 14
  if (tipoVenda === 'venda_judicial')  return 12
  if (tipoVenda === 'leilao_fiscal')   return 10
  if (tipoVenda === 'imovel_banca')    return 7
  return 0
}

// ─── SCORER 1: Apartamento / Moradia ─────────────────────────────────────────
// Métricas: desconto pm2, yield bruto vs prime, zone quality, trend, sale bonus
function scoreResidencial(preco: number, area: number, zm: ZM, tipoVenda: string, tipoImovel: TipoImovel): number {
  let score = 52
  // 1. Desconto ao mercado (pm2 real vs pm2_trans) — até ±40 pts
  if (preco > 0 && area > 0 && zm.pm2_trans > 0) {
    const pm2 = preco / area
    const diff = (zm.pm2_trans - pm2) / zm.pm2_trans
    score += Math.min(28, Math.round(diff * 110))
    score += Math.min(0, Math.round(diff * 60))   // penaliza se acima do mercado
  }
  // 2. Yield bruto vs prime yield benchmark
  if (preco > 0 && area > 0) {
    const yB = (zm.renda_m2 * area * 12) / preco * 100
    const delta = yB - zm.yield_bruto
    if (delta > 2.0) score += 12
    else if (delta > 1.0) score += 8
    else if (delta > 0.0) score += 4
    else if (delta < -1.5) score -= 5
  }
  // 3. Qualidade de zona
  score += Math.round((zm.demanda  - 5) * 1.8)
  score += Math.round((zm.liquidez - 5) * 1.5)
  score -= Math.round(zm.risco * 1.5)
  // 4. Momentum de valorização YoY
  if (zm.var_yoy > 25) score += 7
  else if (zm.var_yoy > 20) score += 5
  else if (zm.var_yoy > 15) score += 2
  // 5. Tipo venda
  score += saleBonus(tipoVenda)
  // 6. Moradia — prémio de raridade
  if (tipoImovel === 'moradia') score += 3
  return Math.max(10, Math.min(99, score))
}

// ─── SCORER 2: Terreno / Lote ─────────────────────────────────────────────────
// Métricas: margem promotor (GDV), land/GDV ratio, pm2 terreno, zone, sale bonus
// Fontes: CBRE, JLL, Cushman&Wakefield Portugal Land Reports
function scoreTerreno(preco: number, area: number, zm: ZM, tipoVenda: string): number {
  let score = 45
  const bm = getBenchmarks(zm)
  if (preco > 0 && area > 0) {
    // Área construível estimada (índice de construção regional)
    const areaConstruivel = area * bm.indice_construcao
    // GDV = Gross Development Value (haircut 80% para risco/tempo/comercialização)
    const gdv = areaConstruivel * zm.pm2_trans * 0.80
    // Custo de construção total
    const custoConstrucao = areaConstruivel * bm.custo_construcao_m2
    // Margem bruta do promotor = (GDV - terreno - construção) / GDV
    const margemBruta = gdv > 0 ? (gdv - preco - custoConstrucao) / gdv : -1
    if      (margemBruta > 0.30) score += 28  // excelente (>30%)
    else if (margemBruta > 0.22) score += 20  // muito bom (>22%)
    else if (margemBruta > 0.15) score += 12  // bom (>15%)
    else if (margemBruta > 0.08) score += 5   // viável
    else if (margemBruta > 0.00) score += 0   // marginal
    else                          score -= 18  // inviável
    // Rácio terreno/GDV (saudável = 15-25% GDV)
    const landPct = gdv > 0 ? preco / gdv : 1
    if      (landPct < 0.12) score += 12
    else if (landPct < 0.18) score += 7
    else if (landPct < 0.25) score += 3
    else if (landPct > 0.35) score -= 10
    else if (landPct > 0.30) score -= 5
    // pm2 terreno vs benchmark regional
    const pm2T = preco / area
    const pm2Diff = (bm.pm2_terreno_urbano - pm2T) / bm.pm2_terreno_urbano
    score += Math.min(10, Math.round(pm2Diff * 35))
  }
  score += Math.round((zm.demanda  - 5) * 1.5)
  score += Math.round((zm.liquidez - 5) * 0.8)
  score -= Math.round(zm.risco * 1.2)
  if (zm.var_yoy > 20) score += 5
  else if (zm.var_yoy > 15) score += 3
  score += saleBonus(tipoVenda)
  return Math.max(10, Math.min(99, score))
}

// ─── SCORER 3: Quinta / Herdade ───────────────────────────────────────────────
// Métricas: €/ha vs benchmark, yield agro+turismo, potencial TER/AgroTurismo
// Fontes: Idealista Rural, Engel & Völkers Herdades, BNP Paribas RE Portugal
function scoreQuinta(preco: number, area: number, zm: ZM, tipoVenda: string): number {
  let score = 48
  const bm = getBenchmarks(zm)
  if (preco > 0 && area > 0) {
    const hectares = area / 10000
    const precoHa = hectares > 0.1 ? preco / hectares : preco
    // €/ha vs benchmark regional
    const haDiff = (bm.preco_ha_agricola - precoHa) / bm.preco_ha_agricola
    if      (haDiff > 0.50) score += 22
    else if (haDiff > 0.30) score += 15
    else if (haDiff > 0.15) score += 8
    else if (haDiff > 0.00) score += 3
    else if (haDiff < -0.50) score -= 15
    else if (haDiff < -0.25) score -= 8
    // Yield total = agrícola + turismo potencial
    const yieldAgri   = hectares * bm.preco_ha_agricola * (bm.yield_agricola_pct / 100)
    const unidadesTur = Math.min(8, Math.max(1, Math.floor(hectares)))
    const yieldTur    = unidadesTur * bm.adr_benchmark * bm.occupancy_benchmark * 365 * 0.28
    const totalYieldPct = preco > 0 ? ((yieldAgri + yieldTur) / preco) * 100 : 0
    if      (totalYieldPct > 9) score += 18
    else if (totalYieldPct > 7) score += 12
    else if (totalYieldPct > 5) score += 7
    else if (totalYieldPct > 3) score += 3
    else if (totalYieldPct < 1) score -= 5
    // Prémio turístico da zona
    score += Math.round((bm.turismo_multiplier - 2.5) * 4)
  }
  score += Math.round((zm.demanda  - 5) * 1.3)
  score += Math.round((zm.liquidez - 5) * 0.7)
  score -= Math.round(zm.risco * 1.1)
  if (zm.var_yoy > 15) score += 3
  score += Math.max(0, saleBonus(tipoVenda) - 2)
  return Math.max(10, Math.min(99, score))
}

// ─── SCORER 4: Comercial / Escritório / Loja ──────────────────────────────────
// Métricas: Cap Rate vs prime yield, NOI/preço, pm2 comercial, zone, WAULT implícito
// Fontes: MSCI Portugal, JLL Office Market Report, CBRE Prime Yields Portugal
function scoreComercial(preco: number, area: number, zm: ZM, tipoVenda: string, subTipo: 'escritorio' | 'loja'): number {
  let score = 48
  const bm = getBenchmarks(zm)
  const rendaMensal  = subTipo === 'loja' ? bm.renda_loja_m2 : bm.renda_escritorio_m2
  const primeYield   = subTipo === 'loja' ? bm.prime_yield_loja : bm.prime_yield_escritorio
  if (preco > 0 && area > 0) {
    // NOI = Net Operating Income (95% ocupação, 10% custos operacionais)
    const noi = area * rendaMensal * 12 * 0.95 * 0.90
    // Cap Rate vs prime yield benchmark (métrica central do sector)
    const capRate = (noi / preco) * 100
    const capDiff = capRate - primeYield
    if      (capDiff > 3.0) score += 28
    else if (capDiff > 2.0) score += 20
    else if (capDiff > 1.0) score += 13
    else if (capDiff > 0.0) score += 6
    else if (capDiff < -2.0) score -= 14
    else if (capDiff < -1.0) score -= 7
    // pm2 vs benchmark comercial
    const pm2C = preco / area
    const pm2Diff = (bm.pm2_comercial - pm2C) / bm.pm2_comercial
    score += Math.min(10, Math.round(pm2Diff * 35))
  }
  score += Math.round((zm.demanda  - 5) * 1.6)
  score += Math.round((zm.liquidez - 5) * 1.0)
  score -= Math.round(zm.risco * 1.3)
  if (zm.var_yoy > 20) score += 4
  else if (zm.var_yoy > 15) score += 2
  score += saleBonus(tipoVenda)
  return Math.max(10, Math.min(99, score))
}

// ─── SCORER 5: Edifício Inteiro ───────────────────────────────────────────────
// Métricas: desconto soma-das-partes (NAV), yield global, custo/m² vs reposição, ARU
// Fontes: Savills Portugal, JLL Investment, CBRE Portugal Portfolio Transactions
function scoreEdificio(preco: number, area: number, zm: ZM, tipoVenda: string): number {
  let score = 48
  const bm = getBenchmarks(zm)
  if (preco > 0 && area > 0) {
    // Unidades estimadas (área média fracção PT = 85m²)
    const unidades = Math.max(2, Math.floor(area / 85))
    // NAV = valor soma das partes (preço mercado × unidades)
    const nav = unidades * zm.pm2_trans * 85
    // Desconto ao NAV (comprar edifício inteiro deve custar menos que soma das fracções)
    const discToNav = nav > 0 ? (nav - preco) / nav : 0
    if      (discToNav > 0.45) score += 30
    else if (discToNav > 0.35) score += 23
    else if (discToNav > 0.25) score += 15
    else if (discToNav > 0.15) score += 8
    else if (discToNav > 0.05) score += 3
    else if (discToNav < -0.05) score -= 12
    // Yield global de arrendamento
    const grossRent = area * zm.renda_m2 * 12 * 0.85
    const grossYield = (grossRent / preco) * 100
    if      (grossYield > 7.5) score += 12
    else if (grossYield > 6.5) score += 8
    else if (grossYield > 5.5) score += 5
    else if (grossYield > 4.5) score += 2
    else if (grossYield < 3.0) score -= 6
    // Custo/m² vs custo de reposição (construção nova)
    const pm2Act = preco / area
    if (pm2Act < bm.custo_construcao_m2 * 0.5) score += 12  // muito barato
    else if (pm2Act < bm.custo_construcao_m2 * 0.7) score += 6
    // Bónus ARU (Área Reabilitação Urbana) — Lisboa e Porto têm benefícios fiscais
    if (zm.region === 'Lisboa' || zm.region === 'Porto') score += 5
  }
  score += Math.round((zm.demanda  - 5) * 1.7)
  score += Math.round((zm.liquidez - 5) * 1.2)
  score -= Math.round(zm.risco * 1.4)
  if (zm.var_yoy > 20) score += 5
  else if (zm.var_yoy > 15) score += 3
  score += saleBonus(tipoVenda)
  return Math.max(10, Math.min(99, score))
}

// ─── SCORER 6: Hotel / Hostel / Turismo ──────────────────────────────────────
// Métricas: price/key vs benchmark, RevPAR, cap rate hospitalidade, turismo zone
// Fontes: Cushman Hospitality Portugal, JLL Hotel Market, STR Portugal ADR data
function scoreHotel(preco: number, area: number, zm: ZM, tipoVenda: string): number {
  let score = 48
  const bm = getBenchmarks(zm)
  if (preco > 0 && area > 0) {
    // Quartos estimados (35m² médio/quarto incluindo áreas comuns)
    const quartos = Math.max(5, Math.floor(area / 35))
    // Price per key vs benchmark 4*
    const ppk = preco / quartos
    const keyDiff = (bm.price_per_key_benchmark - ppk) / bm.price_per_key_benchmark
    if      (keyDiff > 0.50) score += 28
    else if (keyDiff > 0.35) score += 20
    else if (keyDiff > 0.20) score += 12
    else if (keyDiff > 0.05) score += 5
    else if (keyDiff < -0.40) score -= 15
    else if (keyDiff < -0.20) score -= 8
    // RevPAR = ADR × Ocupação | NOI = RevPAR × dias × quartos × margem operacional
    const revpar = bm.adr_benchmark * bm.occupancy_benchmark
    const noi = revpar * 365 * quartos * 0.30
    const capRate = (noi / preco) * 100
    if      (capRate > 9) score += 20
    else if (capRate > 7) score += 14
    else if (capRate > 5) score += 8
    else if (capRate > 4) score += 3
    else if (capRate < 3) score -= 8
    // Prémio zona turística
    score += Math.round((bm.turismo_multiplier - 2.5) * 5)
  }
  score += Math.round((zm.demanda  - 5) * 1.4)
  score += Math.round((zm.liquidez - 5) * 1.0)
  score -= Math.round(zm.risco * 1.3)
  if (zm.var_yoy > 15) score += 3
  score += Math.max(0, saleBonus(tipoVenda) - 2)
  return Math.max(10, Math.min(99, score))
}

// ─── Master scorer — dispatch por tipo ────────────────────────────────────────
function scoreByTipo(tipoImovel: TipoImovel, preco: number, area: number, zm: ZM, tipoVenda: string, titulo?: string): number {
  switch (tipoImovel) {
    case 'moradia':   return scoreResidencial(preco, area, zm, tipoVenda, 'moradia')
    case 'terreno':   return scoreTerreno(preco, area, zm, tipoVenda)
    case 'quinta':    return scoreQuinta(preco, area, zm, tipoVenda)
    case 'comercial': {
      const sub = (titulo ?? '').toLowerCase().includes('loja') || (titulo ?? '').toLowerCase().includes('loja') ? 'loja' : 'escritorio'
      return scoreComercial(preco, area, zm, tipoVenda, sub)
    }
    case 'edificio':  return scoreEdificio(preco, area, zm, tipoVenda)
    case 'hotel':     return scoreHotel(preco, area, zm, tipoVenda)
    case 'apartamento':
    default:          return scoreResidencial(preco, area, zm, tipoVenda, 'apartamento')
  }
}

// ─── Extra metrics for UI display — same math as scorers ─────────────────────
interface ExtraMetrics {
  cap_rate_pct?: number
  margem_promotor_pct?: number
  gdv?: number
  area_construivel?: number
  price_per_key?: number
  revpar_estimado?: number
  hectares?: number
}
function getExtraMetrics(tipoImovel: TipoImovel, preco: number, area: number, zm: ZM, titulo?: string): ExtraMetrics {
  if (!preco || !area) return {}
  const bm = getBenchmarks(zm)
  switch (tipoImovel) {
    case 'terreno': {
      const areaConstruivel = area * bm.indice_construcao
      const gdv = areaConstruivel * zm.pm2_trans * 0.80
      const custoConstrucao = areaConstruivel * bm.custo_construcao_m2
      const margemBruta = gdv > 0 ? (gdv - preco - custoConstrucao) / gdv * 100 : 0
      return { margem_promotor_pct: parseFloat(margemBruta.toFixed(1)), gdv: Math.round(gdv), area_construivel: Math.round(areaConstruivel) }
    }
    case 'quinta': {
      const hectaresQ = area / 10000
      return { hectares: parseFloat(hectaresQ.toFixed(2)) }
    }
    case 'comercial': {
      const subTipo = (titulo ?? '').toLowerCase().includes('loja') ? 'loja' : 'escritorio'
      const rendaMensal = subTipo === 'loja' ? bm.renda_loja_m2 : bm.renda_escritorio_m2
      const noi = area * rendaMensal * 12 * 0.95 * 0.90
      const capRate = (noi / preco) * 100
      return { cap_rate_pct: parseFloat(capRate.toFixed(2)) }
    }
    case 'edificio': {
      const unidades = Math.max(2, Math.floor(area / 85))
      const grossRent = area * zm.renda_m2 * 12 * 0.85
      const capRateE = (grossRent / preco) * 100
      return { cap_rate_pct: parseFloat(capRateE.toFixed(2)) }
    }
    case 'hotel': {
      const quartos = Math.max(5, Math.floor(area / 35))
      const ppk = Math.round(preco / quartos)
      const revpar = bm.adr_benchmark * bm.occupancy_benchmark
      const noi = revpar * 365 * quartos * 0.30
      const capRateH = (noi / preco) * 100
      return { price_per_key: ppk, revpar_estimado: Math.round(revpar), cap_rate_pct: parseFloat(capRateH.toFixed(2)) }
    }
    default: return {}
  }
}

// ─── MOTOR DE VALUATION PROFISSIONAL (RICS / JLL / CBRE standards) ───────────
// Reconcilia 3 modelos: Comparables · Income · Cost/Residual
// Pesos por tipologia seguem prática institucional portuguesa

const RECONCILIATION_WEIGHTS: Record<TipoImovel, { comp: number; income: number; cost: number }> = {
  apartamento: { comp: 0.70, income: 0.20, cost: 0.10 },  // comparáveis dominam
  moradia:     { comp: 0.50, income: 0.15, cost: 0.35 },  // custo tem peso pelo lote
  terreno:     { comp: 0.20, income: 0.05, cost: 0.75 },  // residual land value domina
  quinta:      { comp: 0.55, income: 0.30, cost: 0.15 },  // yield agrícola+turismo relevante
  comercial:   { comp: 0.25, income: 0.60, cost: 0.15 },  // income approach dominante
  edificio:    { comp: 0.30, income: 0.40, cost: 0.30 },  // equilibrado
  hotel:       { comp: 0.20, income: 0.70, cost: 0.10 },  // RevPAR/NOI domina totalmente
  todos:       { comp: 0.60, income: 0.25, cost: 0.15 },
}

// Comparable Model — ajuste hedónico ao pm2 de zona
function _compValue(area: number, zm: ZM, tipo: TipoImovel, bm: ZoneBenchmarks): number {
  if (area <= 0) return 0
  let pm2 = zm.pm2_trans
  if (tipo === 'comercial') pm2 = bm.pm2_comercial
  else if (tipo === 'terreno') pm2 = bm.pm2_terreno_urbano
  else if (tipo === 'moradia')  pm2 *= 1.05
  else if (tipo === 'edificio') pm2 *= 0.82   // desconto soma-das-partes
  else if (tipo === 'hotel')    pm2 *= 1.15
  else if (tipo === 'quinta')   pm2 *= 0.30   // quintas: pm2 baixo, valor está no ha
  // Ajuste por dimensão (hedónico)
  if      (tipo === 'apartamento' && area < 50)  pm2 *= 1.12
  else if (tipo === 'apartamento' && area > 250) pm2 *= 0.92
  else if (tipo === 'moradia'     && area > 500) pm2 *= 0.88
  return pm2 * area
}

// Income Model — capitalização de rendimento (NOI / yield)
function _incomeValue(area: number, zm: ZM, tipo: TipoImovel, titulo: string, bm: ZoneBenchmarks): number {
  if (area <= 0) return 0
  const t = titulo.toLowerCase()
  switch (tipo) {
    case 'apartamento':
    case 'moradia': {
      const noi = zm.renda_m2 * area * 12 * 0.92           // 92% NOI após vacância+custos
      return noi / (zm.yield_bruto / 100)
    }
    case 'comercial': {
      const isLoja = t.includes('loja') || t.includes('shop') || t.includes('retai')
      const renda  = isLoja ? bm.renda_loja_m2 : bm.renda_escritorio_m2
      const primeY = isLoja ? bm.prime_yield_loja : bm.prime_yield_escritorio
      return (area * renda * 12 * 0.95 * 0.90) / (primeY / 100)
    }
    case 'hotel': {
      const rooms = Math.max(5, Math.floor(area / 35))
      const noi   = bm.adr_benchmark * bm.occupancy_benchmark * 365 * rooms * 0.30
      return noi / 0.075  // 7.5% cap rate benchmark hoteleiro PT
    }
    case 'quinta': {
      const ha       = area / 10000
      const yAgri    = ha * bm.preco_ha_agricola * (bm.yield_agricola_pct / 100)
      const unitsTur = Math.min(8, Math.max(1, Math.floor(ha)))
      const yTur     = unitsTur * bm.adr_benchmark * bm.occupancy_benchmark * 365 * 0.28
      return (yAgri + yTur) / 0.055                        // 5.5% cap rate quintas PT
    }
    case 'edificio': {
      const noi = area * zm.renda_m2 * 12 * 0.85           // 85% ocupação edifício misto
      return noi / (zm.yield_bruto / 100)
    }
    default: return 0
  }
}

// Cost / Residual Model
function _costValue(area: number, zm: ZM, tipo: TipoImovel, bm: ZoneBenchmarks): number {
  if (area <= 0) return 0
  switch (tipo) {
    case 'terreno': {
      const ac  = area * bm.indice_construcao
      const gdv = ac * zm.pm2_trans * 0.80
      return Math.max(0, gdv - ac * bm.custo_construcao_m2 - gdv * 0.08 - gdv * 0.05 - gdv * 0.18)
      // gdv - construção - soft costs(8%) - finance(5%) - margem promotor(18%)
    }
    case 'quinta': {
      return (area / 10000) * bm.preco_ha_agricola         // valor agrícola como piso
    }
    case 'moradia': {
      const implant  = area * 0.35                          // implantação estimada 35%
      const landVal  = implant * bm.pm2_terreno_urbano
      const buildCst = (area - implant) * bm.custo_construcao_m2 * 0.70  // 70% nova
      return landVal + buildCst
    }
    case 'edificio': return area * bm.custo_construcao_m2 * 0.60   // custo reposição -40% depr.
    case 'apartamento': return area * bm.custo_construcao_m2 * 0.55
    default: return 0
  }
}

// Confidence Score — qualidade dos dados disponíveis (0-100)
function _confidence(preco: number, area: number, zm: ZM, tipo: TipoImovel, quartos: number, hasAddress: boolean): number {
  let c = 40
  // Completude de dados
  if (area > 0) c += 15
  const areaOK: Record<string,[number,number]> = {
    apartamento:[25,400], moradia:[60,3000], terreno:[100,500000],
    quinta:[1000,10000000], comercial:[20,10000], edificio:[150,50000], hotel:[300,100000]
  }
  const [lo, hi] = areaOK[tipo] ?? [10, 1000000]
  if (area >= lo && area <= hi) c += 8
  if (quartos > 0 && (tipo === 'apartamento' || tipo === 'moradia')) c += 6
  if (hasAddress) c += 4
  // Qualidade de zona
  if (zm.region !== 'Portugal') c += 10
  if      (zm.liquidez >= 8.0) c += 12
  else if (zm.liquidez >= 7.0) c += 8
  else if (zm.liquidez >= 6.0) c += 4
  // Razoabilidade do preço
  if (area > 0 && preco > 0 && tipo !== 'quinta') {
    const pm2 = preco / area
    const d   = Math.abs(pm2 - zm.pm2_trans) / Math.max(zm.pm2_trans, 1)
    if      (d < 0.15) c += 15
    else if (d < 0.35) c += 10
    else if (d < 0.60) c += 5
    else if (d > 1.50) c -= 12
  } else if (preco > 0) c += 5
  return Math.max(12, Math.min(95, c))
}

// ─── Master: Valuation Completa ───────────────────────────────────────────────
interface FullValuation {
  score: number
  // Valores de mercado
  valor_mercado: number
  valor_conservador: number; valor_agressivo: number
  valor_venda_rapida: number; valor_bancario: number
  // Pricing strategy
  preco_captacao: number; preco_fecho_estimado: number
  desconto_negociacao_pct: number; dias_venda_estimados: number
  // Decomposição dos 3 modelos
  valor_comparavel: number; valor_rendimento: number; valor_custo_residual: number
  peso_comp: number; peso_inc: number; peso_cost: number
  // Meta
  confidence_score: number; liquidity_score: number
  // Métricas de tipologia
  cap_rate_pct?: number; margem_promotor_pct?: number; gdv?: number
  area_construivel?: number; price_per_key?: number; revpar_estimado?: number; hectares?: number
  // Drivers
  drivers_up: string[]; drivers_down: string[]
}

function computeFullValuation(
  tipo: TipoImovel, preco: number, area: number, zm: ZM,
  tipoVenda: string, titulo: string, quartos: number, hasAddress: boolean
): FullValuation {
  const bm      = getBenchmarks(zm)
  const weights = RECONCILIATION_WEIGHTS[tipo] ?? RECONCILIATION_WEIGHTS.apartamento

  // ── 3 Modelos ────────────────────────────────────────────────────────────────
  const compVal   = _compValue(area, zm, tipo, bm)
  const incVal    = _incomeValue(area, zm, tipo, titulo, bm)
  const costVal   = _costValue(area, zm, tipo, bm)

  // ── Reconciliação ponderada ───────────────────────────────────────────────────
  // Se algum modelo retorna 0, redistribuir o peso entre os restantes
  let [wC, wI, wK] = [weights.comp, weights.income, weights.cost]
  if (compVal <= 0) { wI += wC * 0.6; wK += wC * 0.4; wC = 0 }
  if (incVal  <= 0) { wC += wI * 0.7; wK += wI * 0.3; wI = 0 }
  if (costVal <= 0) { wC += wK * 0.6; wI += wK * 0.4; wK = 0 }
  const total = wC + wI + wK || 1
  wC /= total; wI /= total; wK /= total

  let valorMercado = (compVal || 0) * wC + (incVal || 0) * wI + (costVal || 0) * wK
  if (valorMercado <= 0 || valorMercado > 5e9) valorMercado = preco || 1

  // ── Confiança ────────────────────────────────────────────────────────────────
  const conf        = _confidence(preco, area, zm, tipo, quartos, hasAddress)
  const uncertainty = (100 - conf) / 100 * 0.18

  // ── Margem de negociação por zona (spread asking→closing) ─────────────────────
  const negBase: Record<TipoImovel, number> = {
    apartamento:4, moradia:5, terreno:8, quinta:9,
    comercial:6, edificio:10, hotel:12, todos:5
  }
  const negLiqAdj = Math.max(0, (8 - zm.liquidez) * 0.6)
  const negociacao = parseFloat(Math.min(20, (negBase[tipo] ?? 5) + negLiqAdj).toFixed(1))

  // ── Dias estimados de venda ────────────────────────────────────────────────
  const baseDias: Record<TipoImovel, number> = {
    apartamento:40, moradia:65, terreno:130, quinta:160,
    comercial:100, edificio:165, hotel:250, todos:70
  }
  const diasLiqAdj = Math.round((8 - zm.liquidez) * 14)
  const dias = Math.max(14, (baseDias[tipo] ?? 70) + diasLiqAdj)

  // ── Score (mantém lógica existente de "quão bom é este preço") ────────────────
  const score = scoreByTipo(tipo, preco, area, zm, tipoVenda, titulo)

  // ── Drivers ────────────────────────────────────────────────────────────────
  const up: string[] = [], dn: string[] = []
  if (preco > 0 && valorMercado > 0) {
    const pct = (preco - valorMercado) / valorMercado * 100
    if      (pct < -25) up.push(`${Math.abs(Math.round(pct))}% abaixo do valor estimado`)
    else if (pct < -12) up.push(`Desconto ${Math.abs(Math.round(pct))}% ao valor de mercado`)
    else if (pct >  20) dn.push(`${Math.round(pct)}% acima do valor estimado`)
    else if (pct >  10) dn.push(`Sobrevalorizado ${Math.round(pct)}%`)
  }
  if (zm.var_yoy >= 20)    up.push(`+${zm.var_yoy}% valorização anual`)
  if (zm.yield_al >= 8.0)  up.push(`AL yield ${zm.yield_al}%`)
  if (zm.liquidez >= 8.0)  up.push('Alta liquidez de mercado')
  else if (zm.liquidez <= 5.5) dn.push('Baixa liquidez — prazo de venda elevado')
  if (tipoVenda === 'leilao_judicial') up.push('Leilão judicial — desconto potencial 25-35%')
  if (tipoVenda === 'imovel_banca')    up.push('Banca — desconto estimado 10-25%')
  if (zm.risco >= 5.5) dn.push(`Risco de zona elevado (${zm.risco}/10)`)
  if (tipo === 'terreno' && compVal > 0 && preco > 0) {
    const ac2  = area * bm.indice_construcao
    const gdv2 = ac2 * zm.pm2_trans * 0.80
    const mg   = gdv2 > 0 ? (gdv2 - preco - ac2 * bm.custo_construcao_m2) / gdv2 * 100 : 0
    if      (mg > 25) up.push(`Margem promotor ${mg.toFixed(0)}% — excelente`)
    else if (mg < 10) dn.push(`Margem promotor ${mg.toFixed(0)}% — pouco atrativo`)
  }
  if ((tipo === 'hotel' || tipo === 'quinta') && (zm.region === 'Alentejo Litoral' || zm.region === 'Algarve'))
    up.push('Zona turística premium')
  if (zm.region === 'Lisboa' || zm.region === 'Porto') up.push('ARU — benefícios fiscais reabilitação')

  const extras = getExtraMetrics(tipo, preco, area, zm, titulo)

  return {
    score,
    valor_mercado:      Math.round(valorMercado),
    valor_conservador:  Math.round(valorMercado * (1 - uncertainty)),
    valor_agressivo:    Math.round(valorMercado * (1 + uncertainty * 0.65)),
    valor_venda_rapida: Math.round(valorMercado * 0.83),
    valor_bancario:     Math.round(valorMercado * 0.76),
    preco_captacao:        Math.round(valorMercado * 1.05),
    preco_fecho_estimado:  Math.round(valorMercado * (1 - negociacao / 100)),
    desconto_negociacao_pct: negociacao,
    dias_venda_estimados: dias,
    valor_comparavel:    Math.round(compVal),
    valor_rendimento:    Math.round(incVal),
    valor_custo_residual:Math.round(costVal),
    peso_comp: parseFloat(wC.toFixed(2)),
    peso_inc:  parseFloat(wI.toFixed(2)),
    peso_cost: parseFloat(wK.toFixed(2)),
    confidence_score: conf,
    liquidity_score:  zm.liquidez,
    drivers_up:   up.slice(0, 3),
    drivers_down: dn.slice(0, 3),
    ...extras,
  }
}

// ─── ENRICHMENT ENGINE — extrai atributos físicos do texto do anúncio ────────
// Substitui inputs manuais: certificado energético, estado, piso, features
interface EnrichedAttributes {
  classe_energetica?: string                     // A+, A, B, B-, C, D, E, F
  estado_conservacao?: 'novo' | 'bom' | 'recuperar'
  piso?: number
  tem_elevador?: boolean
  tem_garagem?: boolean
  tem_varanda?: boolean
  tem_piscina?: boolean
  tem_suite?: boolean
  score_adj: number                              // ajuste pre-calculado (-20 a +20)
}

function enrichFromText(titulo: string, morada: string): EnrichedAttributes {
  const t = `${titulo} ${morada}`.toLowerCase()

  // Classe energética — regex multi-padrão
  const emM = t.match(/class[e]?\s*energ[eé][a-z]*[:\s]+([a-f][+\-]?)/i) ??
              t.match(/certif[a-z]+\s+energ[eé][a-z]+\s+([a-f][+\-]?)/i) ??
              t.match(/\benerg[eé]tic[ao]\s*:?\s*([a-f][+\-]?)\b/i)
  const ce = emM ? emM[1].toUpperCase() : undefined

  // Estado de conservação
  const estado: EnrichedAttributes['estado_conservacao'] =
    /\b(novo|nova|em construção|construção nova|estreia|primeira ocupação)\b/.test(t) ? 'novo' :
    /\b(remodelad|recuperad|renovad|reabilitad|restaurad|totalmente renovad)\b/.test(t) ? 'bom' :
    /\b(para remodelar|para recuperar|degradad|ruína|precisa obras|obras necessárias|para reabilitação)\b/.test(t) ? 'recuperar' :
    /\b(bom estado|bem conservad|bem cuidad|excelente estado)\b/.test(t) ? 'bom' : undefined

  // Piso
  const pisoM = t.match(/(\d+)[oº°]\s*(?:andar|piso)/) ??
                t.match(/(?:andar|piso)\s+(\d+)/) ??
                t.match(/(\d+)(?:st|nd|rd|th)\s+floor/i)
  const piso = pisoM ? Number(pisoM[1])
    : (t.includes('r/c') || t.includes('rés-do-chão') || t.includes('res-do-chao') || t.includes(' rc ')) ? 0 : undefined

  // Features booleanas
  const temElevador = /\belevador\b/.test(t) ? true
    : /sem elevador|s\/elevador|s\.elevador|no elevator/.test(t) ? false : undefined
  const temGaragem  = /\b(garagem|box garagem|lugar de garagem|\d\s*lugar[e]?s?\s*de\s*garagem)\b/.test(t)
  const temVarianda = /\b(varanda|terraço|terraço privado|terrace|balc[oã]o)\b/.test(t)
  const temPiscina  = /\b(piscina|piscine|swimming pool|pool)\b/.test(t)
  const temSuite    = /\b(suite|en suite|en-suite|casa de banho privativa)\b/.test(t)

  // Score adjustment — impacto real no valor
  let adj = 0
  const eAdj: Record<string, number> = { 'A+':8,'A':5,'B':2,'B-':0,'C':-3,'D':-6,'E':-10,'F':-14 }
  if (ce) adj += eAdj[ce] ?? 0
  if (estado === 'novo')      adj += 10
  else if (estado === 'bom')  adj += 3
  else if (estado === 'recuperar') adj -= 15
  if (piso !== undefined) {
    if (piso === 0)   adj -= 4    // r/c — menos procurado
    else if (piso >= 15) adj += 7 // alto — vistas premium
    else if (piso >= 8)  adj += 4
    else if (piso >= 4)  adj += 2
  }
  if (temElevador === false && piso !== undefined && piso >= 3) adj -= 9
  else if (temElevador === true) adj += 2
  if (temGaragem)  adj += 5
  if (temVarianda) adj += 3
  if (temPiscina)  adj += 8
  if (temSuite)    adj += 2

  return {
    classe_energetica: ce,
    estado_conservacao: estado,
    piso,
    tem_elevador: temElevador,
    tem_garagem: temGaragem,
    tem_varanda: temVarianda,
    tem_piscina: temPiscina,
    tem_suite: temSuite,
    score_adj: Math.max(-20, Math.min(20, adj)),
  }
}

// ─── ARRENDAMENTOS REAIS — scrape mercado de arrendamento da zona ─────────────
// Retorna rendas reais para residencial, escritórios e lojas em paralelo
interface RealRents {
  residencial: number   // €/m²/mês apartamentos/moradias
  escritorio: number    // €/m²/mês escritórios
  loja: number          // €/m²/mês lojas
}

async function scrapeRealRentals(zona: string, tipos: TipoImovel[]): Promise<RealRents> {
  const zonaSlug = zona.toLowerCase()
    .replace(/\s—\s.*/g, '').replace(/[àáâã]/g, 'a').replace(/[éê]/g, 'e')
    .replace(/[íî]/g, 'i').replace(/[óô]/g, 'o').replace(/[úû]/g, 'u')
    .replace(/[ç]/g, 'c').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  async function fetchRentPath(path: string): Promise<number> {
    try {
      const searchUrl = `https://www.imovirtual.com/arrendar/${path}/${zonaSlug}/`
      const res = await fetch(searchUrl, {
        headers: { ...HEADERS, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8' },
        signal: AbortSignal.timeout(9000),
      })
      if (!res.ok) return 0
      const html = await res.text()
      const jsonM = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/) ??
                    html.match(/__NEXT_DATA__\s*=\s*(\{[\s\S]+?\})\s*;?\s*<\/script>/)
      if (!jsonM) return 0
      const data = JSON.parse(jsonM[1]) as Record<string, unknown>
      const searchAds = (data as Record<string, unknown>)?.['props'] as Record<string, unknown>
      const items = (searchAds?.['pageProps'] as Record<string, unknown>)?.['data'] as Record<string, unknown>
      const listings = (items?.['searchAds'] as Record<string, unknown>)?.['items'] as unknown[] ?? []
      const rents: number[] = []
      for (const item of (Array.isArray(listings) ? listings : []).slice(0, 30)) {
        const r = item as Record<string, unknown>
        // pricePerSquareMeter.value is pre-calculated by Imovirtual — use directly when valid
        const pm2Direct = Number((r['pricePerSquareMeter'] as Record<string, unknown>)?.['value'] ?? 0)
        if (pm2Direct >= 3 && pm2Direct <= 300) { rents.push(pm2Direct); continue }
        // Fallback: totalPrice.value / area (new Imovirtual API — pricing field is undefined)
        const preco = Number((r['totalPrice'] as Record<string, unknown>)?.['value'] ??
                      (r['rentPrice'] as Record<string, unknown>)?.['value'] ??
                      (r['pricing'] as Record<string, unknown>)?.['price'] ?? 0)
        const area  = Number(r['areaInSquareMeters'] ?? (r['floorSize'] as Record<string, unknown>)?.['value'] ?? 0)
        if (preco > 100 && area > 20) rents.push(preco / area)
      }
      if (rents.length < 3) return 0
      rents.sort((a, b) => a - b)
      const trim = Math.floor(rents.length * 0.15)
      const trimmed = rents.slice(trim, rents.length - trim)
      return parseFloat((trimmed.reduce((s, v) => s + v, 0) / trimmed.length).toFixed(2))
    } catch { return 0 }
  }

  const needsComercial = tipos.some(t => t === 'comercial' || t === 'edificio')
  const needsResidencial = tipos.some(t => t === 'apartamento' || t === 'moradia' || t === 'edificio' || t === 'todos')

  const [residencial, escritorio, loja] = await Promise.all([
    needsResidencial ? fetchRentPath('apartamento') : Promise.resolve(0),
    needsComercial   ? fetchRentPath('escritorio')  : Promise.resolve(0),
    needsComercial   ? fetchRentPath('loja')        : Promise.resolve(0),
  ])

  return { residencial, escritorio, loja }
}

// ─── MOTOR DE COMPARÁVEIS REAIS ────────────────────────────────────────────────
// Usa o pool de deals já scraped como comparáveis reais entre si
// Implementa similarity scoring + hedonic adjustments (metodologia CASAFARI/RICS)
function runComparableMatching(deals: Deal[]): void {
  // Só processa deals com área e pm2 válidos
  const eligible = deals.filter(d => d.area > 0 && d.pm2 > 200 && d.pm2 < 30000 && d.tipo_imovel)

  for (const deal of eligible) {
    if (!deal.tipo_imovel) continue
    const dealRegion = getZM(deal.zona).region

    // Candidatos: mesmo tipo, mesma região, área ±40%, preço sanity
    const candidates = eligible.filter(c =>
      c !== deal &&
      c.tipo_imovel === deal.tipo_imovel &&
      getZM(c.zona).region === dealRegion &&
      Math.abs(c.area - deal.area) / Math.max(deal.area, 1) < 0.42 &&
      c.preco > 0
    )

    if (candidates.length < 2) continue

    // Similarity-weighted pm2
    let totalW = 0, weightedPm2 = 0
    for (const c of candidates) {
      // Hedonic similarity factors
      const wArea  = 1 - Math.abs(c.area - deal.area) / Math.max(deal.area, 1) * 0.45
      const wZona  = c.zona === deal.zona ? 1.0 : 0.72  // subzona exacta vs só região
      const wPreco = deal.preco > 0 && c.preco > 0
        ? Math.max(0.4, 1 - Math.abs(c.preco - deal.preco) / Math.max(deal.preco, 1) * 0.25) : 0.8
      const w = Math.max(0.1, wArea * wZona * wPreco)
      weightedPm2 += c.pm2 * w
      totalW += w
    }
    if (totalW <= 0) continue

    const realPm2    = weightedPm2 / totalW
    const realCompVal = realPm2 * deal.area

    // Blend: 70% real comparable + 30% modelo de zona (para suavizar outliers)
    const prevComp = deal.valor_comparavel ?? realCompVal
    deal.valor_comparavel  = Math.round(realCompVal * 0.70 + prevComp * 0.30)
    deal.comparaveis_reais = candidates.length

    // Recalcular valor_mercado com comparable actualizado
    const wC = deal.peso_comp ?? 0.65
    const wI = deal.peso_inc  ?? 0.20
    const wK = deal.peso_cost ?? 0.15
    const inc  = deal.valor_rendimento    ?? 0
    const cost = deal.valor_custo_residual ?? 0
    const vm   = deal.valor_comparavel * wC + (inc || deal.valor_comparavel) * wI + (cost || deal.valor_comparavel) * wK
    if (vm > 0) {
      deal.valor_mercado      = Math.round(vm)
      deal.valor_conservador  = Math.round(vm * 0.88)
      deal.valor_agressivo    = Math.round(vm * 1.08)
      deal.valor_venda_rapida = Math.round(vm * 0.83)
      deal.valor_bancario     = Math.round(vm * 0.76)
      deal.preco_captacao     = Math.round(vm * 1.05)
      if (deal.desconto_negociacao_pct !== undefined)
        deal.preco_fecho_estimado = Math.round(vm * (1 - deal.desconto_negociacao_pct / 100))
      // Actualiza desconto ao mercado com valor real
      if (deal.preco > 0)
        deal.desconto_mercado_pct = Math.round((vm - deal.preco) / vm * 100)
    }

    // Boost confiança — comparáveis reais aumentam certeza
    const confBoost = Math.min(20, candidates.length * 4)
    deal.confidence_score = Math.min(96, (deal.confidence_score ?? 50) + confBoost)
  }
}

// ─── POST-PROCESS PIPELINE ────────────────────────────────────────────────────
// Orquestra todos os enriquecimentos após scraping: texto → rentals → comparáveis
function postProcessDeals(deals: Deal[], realRents: RealRents): Deal[] {
  for (const deal of deals) {
    // 1. Enrich from listing text
    const attrs = enrichFromText(deal.titulo, deal.morada)
    deal.classe_energetica = attrs.classe_energetica
    deal.estado_conservacao = attrs.estado_conservacao
    deal.piso = attrs.piso
    deal.tem_elevador = attrs.tem_elevador
    deal.tem_garagem  = attrs.tem_garagem
    deal.tem_varanda  = attrs.tem_varanda
    deal.tem_piscina  = attrs.tem_piscina

    // 2. Apply attribute score adjustment (clamped)
    if (attrs.score_adj !== 0) {
      deal.score = Math.max(10, Math.min(99, deal.score + attrs.score_adj))
      deal.classificacao = getClassificacao(deal.score)
    }

    // 3. Update income model with real rent if available
    const zm3 = getZM(deal.zona)
    // Pick correct rent rate based on property type
    const isComercial = deal.tipo_imovel === 'comercial' || deal.tipo_imovel === 'edificio'
    const isLoja = isComercial && (deal.titulo.toLowerCase().includes('loja') || deal.titulo.toLowerCase().includes('shop'))
    const realRentM2 = isLoja ? realRents.loja
      : isComercial ? realRents.escritorio
      : realRents.residencial
    if (realRentM2 > 0 && deal.area > 0 && deal.valor_mercado) {
      deal.renda_real_m2 = realRentM2
      const realNOI = realRentM2 * deal.area * 12 * 0.92
      const realIncomeVal = Math.round(realNOI / (zm3.yield_bruto / 100))
      const wI = deal.peso_inc ?? 0.20
      if (deal.valor_mercado > 0 && realIncomeVal > 0) {
        const delta = (realIncomeVal - (deal.valor_rendimento ?? realIncomeVal)) * wI
        deal.valor_mercado      = Math.round(deal.valor_mercado + delta * 0.5)
        deal.valor_rendimento   = realIncomeVal
        deal.yield_bruto_pct    = parseFloat((realRentM2 * 12 / (deal.preco > 0 ? deal.preco / deal.area : zm3.pm2_trans) * 100).toFixed(2))
      }
    }
  }

  // 4. Run comparable matching (needs full pool)
  runComparableMatching(deals)

  // 5. Re-sort by updated scores
  deals.sort((a, b) => b.score - a.score)

  return deals
}

// ─── LANDMARKS DATABASE — pontos de referência por região ─────────────────────
interface Landmark { name: string; type: 'praia' | 'metro' | 'centro' | 'aeroporto'; lat: number; lng: number }
const LANDMARKS: Record<string, Landmark[]> = {
  'Lisboa':           [
    { name:'Aeroporto LIS', type:'aeroporto', lat:38.7742, lng:-9.1342 },
    { name:'Marquês Metro', type:'metro', lat:38.7261, lng:-9.1503 },
    { name:'Baixa-Chiado Metro', type:'metro', lat:38.7106, lng:-9.1421 },
    { name:'Praça do Comércio', type:'centro', lat:38.7078, lng:-9.1366 },
    { name:'Praia da Caparica', type:'praia', lat:38.6395, lng:-9.2357 },
  ],
  'Cascais/Sintra':   [
    { name:'Aeroporto LIS', type:'aeroporto', lat:38.7742, lng:-9.1342 },
    { name:'Cascais Centro', type:'centro', lat:38.6979, lng:-9.4215 },
    { name:'Praia de Cascais', type:'praia', lat:38.6978, lng:-9.4222 },
    { name:'Estoril Station', type:'metro', lat:38.7027, lng:-9.3952 },
    { name:'Praia de Carcavelos', type:'praia', lat:38.6780, lng:-9.3348 },
  ],
  'AML':              [
    { name:'Aeroporto LIS', type:'aeroporto', lat:38.7742, lng:-9.1342 },
    { name:'Lisboa Centro', type:'centro', lat:38.7078, lng:-9.1366 },
    { name:'Praia de Oeiras', type:'praia', lat:38.6934, lng:-9.3143 },
    { name:'Cais do Sodré Metro', type:'metro', lat:38.7065, lng:-9.1459 },
  ],
  'Porto':            [
    { name:'Aeroporto OPO', type:'aeroporto', lat:41.2481, lng:-8.6814 },
    { name:'Trindade Metro', type:'metro', lat:41.1496, lng:-8.6099 },
    { name:'Aliados', type:'centro', lat:41.1496, lng:-8.6108 },
    { name:'Praia de Matosinhos', type:'praia', lat:41.1808, lng:-8.6878 },
    { name:'Praia da Foz', type:'praia', lat:41.1530, lng:-8.6769 },
  ],
  'Algarve':          [
    { name:'Aeroporto FAO', type:'aeroporto', lat:37.0145, lng:-7.9659 },
    { name:'Faro Centro', type:'centro', lat:37.0193, lng:-7.9307 },
    { name:'Praia de Vilamoura', type:'praia', lat:37.0800, lng:-8.1200 },
    { name:'Praia de Albufeira', type:'praia', lat:37.0778, lng:-8.2422 },
    { name:'Praia de Lagos', type:'praia', lat:37.1022, lng:-8.6756 },
  ],
  'Alentejo Litoral': [
    { name:'Aeroporto LIS', type:'aeroporto', lat:38.7742, lng:-9.1342 },
    { name:'Comporta Centro', type:'centro', lat:38.3716, lng:-8.7764 },
    { name:'Praia da Comporta', type:'praia', lat:38.3716, lng:-8.7764 },
    { name:'Praia de Melides', type:'praia', lat:38.1932, lng:-8.7323 },
  ],
  'Madeira':          [
    { name:'Aeroporto FNC', type:'aeroporto', lat:32.6978, lng:-16.7762 },
    { name:'Funchal Centro', type:'centro', lat:32.6669, lng:-16.9241 },
    { name:'Praia Formosa', type:'praia', lat:32.6338, lng:-16.9178 },
  ],
  'Açores':           [
    { name:'Aeroporto PDL', type:'aeroporto', lat:37.7412, lng:-25.6979 },
    { name:'Ponta Delgada Centro', type:'centro', lat:37.7412, lng:-25.6756 },
    { name:'Praia de Água de Alto', type:'praia', lat:37.7283, lng:-25.5522 },
  ],
  'Minho':            [
    { name:'Aeroporto OPO', type:'aeroporto', lat:41.2481, lng:-8.6814 },
    { name:'Braga Centro', type:'centro', lat:41.5453, lng:-8.4265 },
    { name:'Praia de Ofir', type:'praia', lat:41.5196, lng:-8.7837 },
  ],
  'Centro':           [
    { name:'Aeroporto LIS', type:'aeroporto', lat:38.7742, lng:-9.1342 },
    { name:'Coimbra Centro', type:'centro', lat:40.2033, lng:-8.4103 },
    { name:'Praia da Figueira', type:'praia', lat:40.1504, lng:-8.8596 },
  ],
  'Portugal':         [
    { name:'Aeroporto LIS', type:'aeroporto', lat:38.7742, lng:-9.1342 },
    { name:'Lisboa Centro', type:'centro', lat:38.7078, lng:-9.1366 },
    { name:'Praia de Cascais', type:'praia', lat:38.6978, lng:-9.4222 },
  ],
}

// ─── Haversine distance (km) ───────────────────────────────────────────────────
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ─── Nominatim geocoding (free, max 1 req/sec, no key) ───────────────────────
async function geocodeDeal(morada: string, zona: string): Promise<{lat: number; lng: number} | null> {
  const query = [morada, zona, 'Portugal'].filter(Boolean).join(', ').substring(0, 200)
  if (!query.trim()) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=pt`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AgencyGroupRadar/1.0 real-estate-valuation contact@agencygroup.pt' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json() as Array<{lat: string; lon: string}>
    if (!Array.isArray(data) || !data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

// ─── Apply geocoding + distance scoring to top deals (sequential, 1.1s apart) ─
async function applyGeoToDeals(deals: Deal[]): Promise<void> {
  for (let i = 0; i < deals.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1150)) // Nominatim rate limit: 1 req/sec
    const deal = deals[i]
    const coords = await geocodeDeal(deal.morada, deal.zona)
    if (!coords) continue
    deal.lat = parseFloat(coords.lat.toFixed(6))
    deal.lng = parseFloat(coords.lng.toFixed(6))

    const zm = getZM(deal.zona)
    const lm = LANDMARKS[zm.region] ?? LANDMARKS['Portugal']

    const praias  = lm.filter(l => l.type === 'praia')
    const metros  = lm.filter(l => l.type === 'metro')
    const centros = lm.filter(l => l.type === 'centro')
    const aeros   = lm.filter(l => l.type === 'aeroporto')

    const minDist = (pts: Landmark[]) =>
      pts.length ? Math.min(...pts.map(l => distanceKm(coords.lat, coords.lng, l.lat, l.lng))) : undefined

    const dp = minDist(praias);  if (dp !== undefined) deal.dist_praia_km   = parseFloat(dp.toFixed(1))
    const dm = minDist(metros);  if (dm !== undefined) deal.dist_metro_km   = parseFloat(dm.toFixed(1))
    const dc = minDist(centros); if (dc !== undefined) deal.dist_centro_km  = parseFloat(dc.toFixed(1))
    const da = minDist(aeros);   if (da !== undefined) deal.dist_aeroporto_km = parseFloat(da.toFixed(1))

    // Score adjustments
    let geoAdj = 0
    const up: string[] = []
    const dn: string[] = []

    if (deal.dist_praia_km !== undefined) {
      if      (deal.dist_praia_km < 0.3) { geoAdj += 10; up.push(`🌊 Praia a ${deal.dist_praia_km}km`) }
      else if (deal.dist_praia_km < 1.0) { geoAdj += 6;  up.push(`🌊 Praia a ${deal.dist_praia_km}km`) }
      else if (deal.dist_praia_km < 2.5) { geoAdj += 3;  up.push(`🌊 Praia a ${deal.dist_praia_km}km`) }
    }
    if (deal.dist_metro_km !== undefined) {
      if      (deal.dist_metro_km < 0.35) { geoAdj += 7; up.push(`🚇 Metro a ${deal.dist_metro_km}km`) }
      else if (deal.dist_metro_km < 0.70) { geoAdj += 4; up.push(`🚇 Metro a ${deal.dist_metro_km}km`) }
      else if (deal.dist_metro_km < 1.20) { geoAdj += 2 }
      else if (deal.dist_metro_km > 4.00) { geoAdj -= 2; dn.push(`Metro distante ${deal.dist_metro_km}km`) }
    }
    if (deal.dist_aeroporto_km !== undefined) {
      if      (deal.dist_aeroporto_km < 2.5)  { geoAdj -= 5; dn.push('⚠️ Próximo aeroporto (ruído)') }
      else if (deal.dist_aeroporto_km < 4.0)  { geoAdj -= 2 }
    }
    if (deal.dist_centro_km !== undefined) {
      if      (deal.dist_centro_km < 1.0)  geoAdj += 2
      else if (deal.dist_centro_km > 12.0) geoAdj -= 2
    }

    if (geoAdj !== 0) {
      deal.score = Math.max(10, Math.min(99, deal.score + Math.round(geoAdj * 0.55)))
      deal.classificacao = getClassificacao(deal.score)
    }
    if (up.length) deal.drivers_up   = [...(deal.drivers_up   ?? []), ...up].slice(0, 4)
    if (dn.length) deal.drivers_down = [...(deal.drivers_down ?? []), ...dn].slice(0, 4)
  }
}

// ─── FICHA COMPLETA — scrape página individual do anúncio ─────────────────────
// Corre apenas para os top 5 por score — extrai descrição completa, orientação,
// certificado energético completo, etc.
async function enrichFromListingPage(deal: Deal): Promise<void> {
  try {
    const res = await fetch(deal.url, {
      headers: { ...HEADERS, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return
    const raw = await res.text()

    // Extract full JSON from __NEXT_DATA__ (Imovirtual, SuperCasa, CasaSapo)
    let fullText = raw.substring(0, 6000) // fallback: HTML snippet
    const jsonM = raw.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/)
    if (jsonM) {
      try {
        const nd = JSON.parse(jsonM[1]) as Record<string, unknown>
        const pp = ((nd?.props as Record<string, unknown>)?.pageProps as Record<string, unknown>) ?? {}
        const ad = (pp?.ad ?? pp?.property ?? pp?.listing ?? pp?.data) as Record<string, unknown> | undefined
        if (ad) {
          const desc = String(ad.description ?? ad.fullDescription ?? ad.caracteristicas ?? '')
          const chars = ad.characteristics ?? ad.features ?? ad.amenities
          const charText = Array.isArray(chars)
            ? (chars as Record<string, unknown>[]).map(c => `${c.label ?? ''} ${c.value ?? c.label ?? ''}`).join(' ')
            : ''
          fullText = `${desc} ${charText}`.substring(0, 8000)
        }
      } catch { /* use HTML fallback */ }
    }

    // Orientation detection (high value signal for solar exposure)
    const orM = fullText.match(/orient[aç][aã]o[:\s]+([NSEO]{1,2})/i) ??
                fullText.match(/\b(nascente|poente|norte|sul|este|oeste|nordeste|noroeste|sudeste|sudoeste)\b/i)
    if (orM) {
      const ori = orM[1].toLowerCase()
      const oriMap: Record<string, string> = {
        nascente:'E', poente:'O', norte:'N', sul:'S', este:'E', oeste:'O',
        nordeste:'NE', noroeste:'NO', sudeste:'SE', sudoeste:'SO',
      }
      deal.orientacao = oriMap[ori] ?? orM[1].toUpperCase().substring(0, 2)
    }

    // Re-run full enrichment with richer text
    const fullAttrs = enrichFromText(fullText, deal.morada)

    // Only override if we gained new info
    if (!deal.classe_energetica && fullAttrs.classe_energetica) {
      deal.classe_energetica = fullAttrs.classe_energetica
      const eAdj: Record<string, number> = {'A+':8,'A':5,'B':2,'B-':0,'C':-3,'D':-6,'E':-10,'F':-14}
      deal.score = Math.max(10, Math.min(99, deal.score + (eAdj[fullAttrs.classe_energetica] ?? 0)))
    }
    if (!deal.estado_conservacao && fullAttrs.estado_conservacao) {
      deal.estado_conservacao = fullAttrs.estado_conservacao
      const sAdj = fullAttrs.estado_conservacao === 'novo' ? 8 : fullAttrs.estado_conservacao === 'recuperar' ? -12 : 2
      deal.score = Math.max(10, Math.min(99, deal.score + sAdj))
    }
    if (deal.piso === undefined && fullAttrs.piso !== undefined) deal.piso = fullAttrs.piso
    if (deal.tem_garagem === undefined || !deal.tem_garagem) deal.tem_garagem = fullAttrs.tem_garagem
    if (deal.tem_varanda === undefined || !deal.tem_varanda) deal.tem_varanda = fullAttrs.tem_varanda
    if (deal.tem_piscina === undefined || !deal.tem_piscina) deal.tem_piscina = fullAttrs.tem_piscina
    if (deal.tem_elevador === undefined) deal.tem_elevador = fullAttrs.tem_elevador

    // Solar orientation scoring
    if (deal.orientacao) {
      const oriAdj = ['S','SE','SO'].includes(deal.orientacao) ? 4
        : ['N'].includes(deal.orientacao) ? -2 : 0
      if (oriAdj !== 0) {
        deal.score = Math.max(10, Math.min(99, deal.score + oriAdj))
        if (oriAdj > 0) deal.drivers_up = [...(deal.drivers_up ?? []), `☀️ Orientação ${deal.orientacao} — exposição solar`].slice(0, 4)
      }
    }

    deal.classificacao  = getClassificacao(deal.score)
    deal.confidence_score = Math.min(96, (deal.confidence_score ?? 50) + 8) // page scrape boosts confidence
  } catch { /* silent fail — enrichment is optional */ }
}

// ─── HISTÓRICO DE PREÇOS — cruzamento com tracker existente ──────────────────
// Detecta reduções de preço e calcula dias em mercado → vendedor motivado
async function checkPriceHistory(deal: Deal, baseUrl: string): Promise<void> {
  try {
    if (!deal.url) return
    const histUrl = `${baseUrl}/api/radar/history?url=${encodeURIComponent(deal.url)}`
    const res = await fetch(histUrl, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return
    const data = await res.json() as {
      success: boolean
      history: Array<{ preco: number; data: string }>
      trend: 'down' | 'stable' | 'up'
      delta_pct: number
    }
    if (!data.success || !data.history?.length) return

    const hist = data.history
    deal.tendencia_preco = data.trend
    // Count actual price drops
    deal.reducoes_preco = hist.filter((p, i) => i > 0 && p.preco > 0 && p.preco < hist[i-1].preco).length
    deal.preco_reducao_pct = data.delta_pct < 0 ? parseFloat(Math.abs(data.delta_pct).toFixed(1)) : 0

    // Days on market from first seen
    if (hist.length >= 1) {
      const firstDate = new Date(hist[0].data)
      deal.dias_mercado = Math.max(1, Math.round((Date.now() - firstDate.getTime()) / 86400000))
    }

    // Motivated seller — price drop ≥ 3%
    if (data.trend === 'down' && deal.preco_reducao_pct >= 3) {
      const boost = Math.min(8, Math.round(deal.preco_reducao_pct * 0.75))
      deal.score = Math.max(10, Math.min(99, deal.score + boost))
      deal.classificacao = getClassificacao(deal.score)
      deal.drivers_up = [
        ...(deal.drivers_up ?? []),
        `📉 Preço caiu ${deal.preco_reducao_pct}% — vendedor motivado`,
      ].slice(0, 4)
      // Tighter spread — seller already negotiating via price
      if (deal.desconto_negociacao_pct !== undefined)
        deal.desconto_negociacao_pct = parseFloat(Math.max(2, deal.desconto_negociacao_pct - 1.5).toFixed(1))
    }

    // Long days without reduction = overpriced signal
    if ((deal.dias_mercado ?? 0) > 180 && data.trend !== 'down') {
      deal.score = Math.max(10, deal.score - 3)
      deal.classificacao = getClassificacao(deal.score)
      deal.drivers_down = [
        ...(deal.drivers_down ?? []),
        `⏳ ${deal.dias_mercado} dias em mercado sem redução`,
      ].slice(0, 4)
    }
  } catch { /* silent fail */ }
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────
const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.7',
  'Referer': 'https://www.google.pt/',
}

function parseNum(s: string | undefined | null): number {
  if (!s) return 0
  const clean = String(s).replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ─── Deal interface ───────────────────────────────────────────────────────────
interface Deal {
  url: string; platform: string; titulo: string; morada: string; zona: string
  preco: number; area: number; quartos: number; pm2: number; pm2_mercado: number
  score: number; classificacao: string; desconto_mercado_pct: number
  yield_bruto_pct: number; roi5y_pct: number; tipo_venda: string
  agente: string; contacto: string; telefone: string
  is_leilao: boolean; is_banca: boolean
  valor_base?: number; licitacao_minima?: number; prazo_licitacao?: string; processo?: string
  banco?: string; imagem?: string; var_yoy?: number; liquidez?: number
  // Tipo de imóvel + métricas especializadas
  tipo_imovel?: TipoImovel
  cap_rate_pct?: number; margem_promotor_pct?: number; gdv?: number
  price_per_key?: number; revpar_estimado?: number; hectares?: number; area_construivel?: number
  // ─── Motor de Valuation Profissional (RICS/JLL) ───────────────────────────
  valor_mercado?: number           // valor estimado de mercado (3 modelos reconciliados)
  valor_conservador?: number       // -incerteza (cenário pessimista)
  valor_agressivo?: number         // +incerteza (cenário optimista)
  valor_venda_rapida?: number      // 83% do valor — liquidação rápida
  valor_bancario?: number          // 76% — LTV bancário típico PT
  preco_captacao?: number          // preço de entrada recomendado (+5% sobre mercado)
  preco_fecho_estimado?: number    // preço de fecho esperado após negociação
  desconto_negociacao_pct?: number // spread asking→closing estimado por zona/tipo
  dias_venda_estimados?: number    // prazo médio de venda estimado
  valor_comparavel?: number        // Modelo 1: comparáveis hedónicos
  valor_rendimento?: number        // Modelo 2: capitalização de rendimento
  valor_custo_residual?: number    // Modelo 3: custo/residual
  peso_comp?: number; peso_inc?: number; peso_cost?: number
  confidence_score?: number        // qualidade dos dados (0-100)
  drivers_up?: string[]            // factores que valorizam
  drivers_down?: string[]          // factores que penalizam
  // ─── Atributos físicos (extraídos do texto do anúncio) ─────────────────────
  classe_energetica?: string       // A+, A, B, C, D, E, F
  estado_conservacao?: string      // novo | bom | recuperar
  piso?: number
  tem_elevador?: boolean
  tem_garagem?: boolean
  tem_varanda?: boolean
  tem_piscina?: boolean
  // ─── Comparáveis reais + arrendamento real ─────────────────────────────────
  comparaveis_reais?: number       // nº de comparáveis encontrados no pool
  renda_real_m2?: number           // renda real de mercado scraped (€/m²/mês)
  // ─── Geocodificação + Distâncias (Nominatim) ──────────────────────────────
  lat?: number; lng?: number
  dist_praia_km?: number; dist_metro_km?: number
  dist_centro_km?: number; dist_aeroporto_km?: number
  orientacao?: string              // N, S, E, O, NE, SE, SO, NO
  // ─── Histórico de Preços ──────────────────────────────────────────────────
  preco_reducao_pct?: number       // queda total desde primeiro aviso (%)
  reducoes_preco?: number          // nº de reduções detectadas
  dias_mercado?: number            // dias desde primeira captação no tracker
  tendencia_preco?: 'down' | 'stable' | 'up'
}

// ─── Browserless render helper ────────────────────────────────────────────────
async function browserlessRender(url: string, token: string, waitMs = 5000): Promise<string> {
  try {
    const res = await fetch(
      `https://production-sfo.browserless.io/content?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, waitForTimeout: waitMs, stealth: true }),
        signal: AbortSignal.timeout(30000),
      }
    )
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

// ─── A) e-Leilões via direct HTML fetch (API deprecated — returns 406) ────────
async function scrapeEleiloesApi(): Promise<Deal[]> {
  const deals: Deal[] = []
  try {
    // Old JSON API (/api/pesquisa) now returns 406 — use HTML search page directly
    const searchUrl = 'https://www.e-leiloes.pt/e-leiloes/pesquisa/pesquisa?categoria=imob&estado=A'
    const res = await fetch(searchUrl, {
      headers: { ...HEADERS, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return deals
    const html = await res.text()
    if (html.length < 2000 || !html.toLowerCase().includes('leil')) return deals

    // Extract all lot detail URLs
    const lotUrls = [...html.matchAll(/href="(\/e-leiloes\/pesquisa\/detalhe\/[^"]+)"/gi)]
      .map(m => `https://www.e-leiloes.pt${m[1]}`)
      .filter((u, i, arr) => arr.indexOf(u) === i)

    // Try to split HTML into property card blocks
    const cardSplitRe = /<(?:div|article)[^>]*class="[^"]*(?:lote|leilao|lot[^e]|card-lot|auction|item-lote|result-item)[^"]*"[^>]*>/gi
    let cardBlocks = html.split(cardSplitRe).slice(1, 20)

    // Fallback split on generic cards
    if (cardBlocks.length < 2) {
      cardBlocks = html.split(/<div[^>]*class="[^"]*(?:card|item|row)[^"]*lot[^"]*"/i).slice(1, 20)
    }

    // If no card split worked but we have lot URLs, build minimal deals from surrounding context
    if (cardBlocks.length < 2 && lotUrls.length > 0) {
      for (let i = 0; i < Math.min(lotUrls.length, 15); i++) {
        const relPath = lotUrls[i].replace('https://www.e-leiloes.pt', '')
        const idx = html.indexOf(relPath)
        const ctx = idx > 0 ? html.slice(Math.max(0, idx - 600), idx + 600) : ''
        const titleM = ctx.match(/<(?:h[2-4]|strong|b)[^>]*>([^<]{5,100})<\/(?:h[2-4]|strong|b)>/i)
        const baseM = ctx.match(/(?:Valor\s*[Bb]ase|Base\s*Min\.?)[^\d€]*(?:€\s*)?([\d\s.,]+)/i)
        const endM = ctx.match(/(\d{2}\/\d{2}\/\d{4})/i)
        const locM = ctx.match(/(?:Localidade|Distrito|Concelho|Local)[^:]*:\s*([^<\n\r]{3,50})/i)

        const titulo = stripHtml(titleM?.[1] ?? `Lote e-Leilões ${i + 1}`).trim()
        const valorBase = parseNum(baseM?.[1])
        const prazo = endM?.[1] ?? ''
        const morada = stripHtml(locM?.[1] ?? '').trim()

        const zona = detectZona(`${titulo} ${morada}`)
        const zm = getZM(zona)
        const score = quickScore(valorBase, 0, zm, 'leilao_judicial')
        deals.push({
          url: lotUrls[i], platform: 'e-Leilões',
          titulo, morada, zona,
          preco: valorBase, area: 0, quartos: 0,
          pm2: 0, pm2_mercado: zm.pm2_trans,
          score, classificacao: getClassificacao(score),
          desconto_mercado_pct: 25, yield_bruto_pct: zm.yield_bruto, roi5y_pct: 0,
          tipo_venda: 'leilao_judicial',
          agente: 'e-Leilões / OSAE', contacto: lotUrls[i], telefone: '',
          is_leilao: true, is_banca: false,
          valor_base: valorBase, prazo_licitacao: prazo, processo: '',
          var_yoy: zm.var_yoy, liquidez: zm.liquidez,
        })
      }
      return deals
    }

    // Parse card blocks
    for (let i = 0; i < Math.min(cardBlocks.length, 15); i++) {
      const block = cardBlocks[i]
      const detailUrl = lotUrls[i] ?? searchUrl
      const titleM = block.match(/<(?:h[2-4]|strong|b)[^>]*>([^<]{5,100})<\/(?:h[2-4]|strong|b)>/i)
      const baseM = block.match(/(?:Valor\s*[Bb]ase|Base\s*Min\.?)[^\d€]*(?:€\s*)?([\d\s.,]+)/i)
      const endM = block.match(/(\d{2}\/\d{2}\/\d{4})/i)
      const locM = block.match(/(?:Localidade|Distrito|Concelho|Local)[^:]*:\s*([^<\n\r]{3,50})/i)

      const titulo = stripHtml(titleM?.[1] ?? '').trim()
      const valorBase = parseNum(baseM?.[1])
      const prazo = endM?.[1] ?? ''
      const morada = stripHtml(locM?.[1] ?? '').trim()
      if (!titulo && valorBase === 0) continue

      const zona = detectZona(`${titulo} ${morada}`)
      const zm = getZM(zona)
      const score = quickScore(valorBase, 0, zm, 'leilao_judicial')
      deals.push({
        url: detailUrl, platform: 'e-Leilões',
        titulo, morada, zona,
        preco: valorBase, area: 0, quartos: 0,
        pm2: 0, pm2_mercado: zm.pm2_trans,
        score, classificacao: getClassificacao(score),
        desconto_mercado_pct: 25, yield_bruto_pct: zm.yield_bruto, roi5y_pct: 0,
        tipo_venda: 'leilao_judicial',
        agente: 'e-Leilões / OSAE', contacto: detailUrl, telefone: '',
        is_leilao: true, is_banca: false,
        valor_base: valorBase, prazo_licitacao: prazo, processo: '',
        var_yoy: zm.var_yoy, liquidez: zm.liquidez,
      })
    }
  } catch { /* continue */ }
  return deals
}

// ─── B) e-Leilões via Browserless ────────────────────────────────────────────
async function scrapeEleiloesBrowserless(token: string): Promise<Deal[]> {
  const deals: Deal[] = []
  try {
    const html = await browserlessRender(
      'https://www.e-leiloes.pt/e-leiloes/pesquisa/pesquisa?categoria=imob&estado=A',
      token, 5000
    )
    if (!html) return deals

    // Try multiple card selector patterns
    const cardPatterns = [
      /<(?:div|article)[^>]*class="[^"]*(?:card|lot|lote|property|imovel)[^"]*"[^>]*>([\s\S]{50,800}?)(?=<\/(?:div|article)>)/gi,
      /<(?:div|article)[^>]*(?:class|id)="[^"]*(?:item|listing)[^"]*"[^>]*>([\s\S]{50,600}?)(?=<\/(?:div|article)>)/gi,
    ]

    for (const pattern of cardPatterns) {
      const blocks = [...html.matchAll(pattern)].map(m => m[0])
      if (blocks.length === 0) continue

      for (const block of blocks.slice(0, 15)) {
        const titleM = block.match(/<h[23][^>]*>([^<]{5,100})<\/h[23]>/i) || block.match(/<strong>([^<]{5,100})<\/strong>/i)
        const baseM = block.match(/(?:Valor\s*[Bb]ase|Base)[^\d€]*(?:€\s*)?([\d\s.,]+)/i)
        const endM = block.match(/(\d{2}\/\d{2}\/\d{4})/i)
        const urlM = block.match(/href="(\/e-leiloes\/pesquisa\/detalhe\/[^"]+)"/i)
        const locM = block.match(/([A-Z][a-zÀ-ú\s]+(?:,\s*[A-Z][a-zÀ-ú]+)*)/i)

        const titulo = stripHtml(titleM?.[1] ?? '').trim()
        const valorBase = parseNum(baseM?.[1])
        const prazo = endM?.[1] ?? ''
        const morada = locM?.[1] ?? ''
        const detailUrl = urlM ? `https://www.e-leiloes.pt${urlM[1]}` : 'https://www.e-leiloes.pt'
        if (!titulo && valorBase === 0) continue

        const zona = detectZona(`${titulo} ${morada}`)
        const zm = getZM(zona)
        const score = quickScore(valorBase, 0, zm, 'leilao_judicial')

        deals.push({
          url: detailUrl, platform: 'e-Leilões (Browserless)',
          titulo, morada, zona,
          preco: valorBase, area: 0, quartos: 0,
          pm2: 0, pm2_mercado: zm.pm2_trans,
          score, classificacao: getClassificacao(score),
          desconto_mercado_pct: 25,
          yield_bruto_pct: zm.yield_bruto, roi5y_pct: 0,
          tipo_venda: 'leilao_judicial',
          agente: 'e-Leilões / OSAE', contacto: detailUrl, telefone: '',
          is_leilao: true, is_banca: false,
          valor_base: valorBase, prazo_licitacao: prazo,
          var_yoy: zm.var_yoy, liquidez: zm.liquidez,
        })
      }
      if (deals.length > 0) break
    }
  } catch { /* continue */ }
  return deals
}

// ─── C) e-Leilões via Apify Playwright ───────────────────────────────────────
async function scrapeEleiloesApify(token: string): Promise<Deal[]> {
  const deals: Deal[] = []
  try {
    const pageFunction = `async function pageFunction(context) {
      const { page } = context;
      await page.waitForTimeout(4000);
      // Check for preloaded JSON data
      const nextData = await page.evaluate(() => {
        try { return JSON.stringify(window.__NEXT_DATA__ || window.__INITIAL_STATE__ || null); }
        catch(e) { return null; }
      });
      // Extract cards from DOM
      const cards = await page.evaluate(() => {
        const selectors = ['[class*="card"]', '[class*="lot"]', '[class*="lote"]', 'article', '[class*="imovel"]'];
        let elements = [];
        for (const sel of selectors) {
          elements = Array.from(document.querySelectorAll(sel));
          if (elements.length > 2) break;
        }
        return elements.slice(0, 20).map(el => ({
          text: el.textContent?.trim().substring(0, 500) || '',
          url: el.querySelector('a')?.href || '',
          titulo: el.querySelector('h2,h3,h4,strong')?.textContent?.trim() || '',
        }));
      });
      return { cards, nextData };
    }`

    const r = await fetch(
      `https://api.apify.com/v2/acts/apify~playwright-scraper/run-sync-get-dataset-items?token=${token}&timeout=50`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: 'https://www.e-leiloes.pt/e-leiloes/pesquisa/pesquisa?categoria=imob&estado=A' }],
          pageFunction,
          maxPagesPerCrawl: 1,
        }),
        signal: AbortSignal.timeout(55000),
      }
    )
    if (!r.ok) return deals
    const items = await r.json() as unknown[]
    if (!Array.isArray(items)) return deals

    for (const rawItem of items.slice(0, 5)) {
      const item = rawItem as Record<string, unknown>
      const cards = Array.isArray(item['cards']) ? item['cards'] as Record<string, unknown>[] : []
      const nextDataStr = item['nextData'] ? String(item['nextData']) : ''

      // Try to parse __NEXT_DATA__ if available
      if (nextDataStr && nextDataStr !== 'null') {
        try {
          const nd = JSON.parse(nextDataStr) as Record<string, unknown>
          const props = (nd['props'] as Record<string, unknown>) ?? {}
          const pageProps = (props['pageProps'] as Record<string, unknown>) ?? {}
          const listings = Array.isArray(pageProps['listings']) ? pageProps['listings'] : []
          for (const raw of listings.slice(0, 15)) {
            const l = raw as Record<string, unknown>
            const titulo = String(l['titulo'] ?? l['title'] ?? '').substring(0, 100)
            const valorBase = Number(l['valorBase'] ?? l['valor_base'] ?? l['preco'] ?? 0)
            const morada = String(l['morada'] ?? l['localidade'] ?? '')
            const url = String(l['url'] ?? '')
            if (!titulo && valorBase === 0) continue
            const zona = detectZona(`${titulo} ${morada}`)
            const zm = getZM(zona)
            const score = quickScore(valorBase, 0, zm, 'leilao_judicial')
            deals.push({
              url: url || 'https://www.e-leiloes.pt',
              platform: 'e-Leilões (Apify)',
              titulo, morada, zona,
              preco: valorBase, area: 0, quartos: 0,
              pm2: 0, pm2_mercado: zm.pm2_trans,
              score, classificacao: getClassificacao(score),
              desconto_mercado_pct: 25, yield_bruto_pct: zm.yield_bruto, roi5y_pct: 0,
              tipo_venda: 'leilao_judicial',
              agente: 'e-Leilões / OSAE', contacto: url || 'www.e-leiloes.pt', telefone: '',
              is_leilao: true, is_banca: false, valor_base: valorBase,
              var_yoy: zm.var_yoy, liquidez: zm.liquidez,
            })
          }
          if (deals.length > 0) return deals
        } catch { /* continue to card parsing */ }
      }

      // Parse DOM cards
      for (const card of cards.slice(0, 15)) {
        const text = String(card['text'] ?? '')
        const cardUrl = String(card['url'] ?? '')
        const titulo = String(card['titulo'] ?? '').substring(0, 100) || text.substring(0, 80)
        const baseM = text.match(/(?:Valor\s*[Bb]ase|Base)[^\d€]*(?:€\s*)?([\d\s.,]+)/i)
        const valorBase = parseNum(baseM?.[1])
        const zona = detectZona(text)
        const zm = getZM(zona)
        const score = quickScore(valorBase, 0, zm, 'leilao_judicial')
        deals.push({
          url: cardUrl || 'https://www.e-leiloes.pt',
          platform: 'e-Leilões (Apify)',
          titulo, morada: '', zona,
          preco: valorBase, area: 0, quartos: 0,
          pm2: 0, pm2_mercado: zm.pm2_trans,
          score, classificacao: getClassificacao(score),
          desconto_mercado_pct: 25, yield_bruto_pct: zm.yield_bruto, roi5y_pct: 0,
          tipo_venda: 'leilao_judicial',
          agente: 'e-Leilões / OSAE', contacto: cardUrl, telefone: '',
          is_leilao: true, is_banca: false, valor_base: valorBase,
          var_yoy: zm.var_yoy, liquidez: zm.liquidez,
        })
      }
    }
  } catch { /* continue */ }
  return deals
}

// ─── e-Leilões cascade ───────────────────────────────────────────────────────
async function scrapeEleiloesListings(browserlessToken?: string, apifyToken?: string): Promise<Deal[]> {
  // 1. Direct HTML fetch (primary — API deprecated, HTML page returns 200)
  const apiDeals = await scrapeEleiloesApi()
  if (apiDeals.length >= 3) return apiDeals

  // 2. Apify web-scraper with residential proxy (handles IP blocks)
  if (apifyToken) {
    const aDeals = await scrapeEleiloesApify(apifyToken)
    if (aDeals.length >= 3) return aDeals
  }

  // 3. Browserless fallback
  if (browserlessToken) {
    const bDeals = await scrapeEleiloesBrowserless(browserlessToken)
    if (bDeals.length >= 3) return bDeals
  }

  // 4. Return whatever we have (even 0–2 results)
  return apiDeals
}

// ─── D) Citius judicial sales ─────────────────────────────────────────────────
async function scrapeCitiusListings(browserlessToken?: string): Promise<Deal[]> {
  const deals: Deal[] = []
  const citiusUrls = [
    'https://www.citius.mj.pt/portal/consultas/consultasvenda.aspx',
    'https://www.citius.mj.pt/portal/consultas/consultavendaanuncios.aspx',
  ]

  for (const url of citiusUrls) {
    try {
      let html = ''
      // Try plain HTML first (ASP.NET pages often have SSR)
      try {
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
        if (res.ok) html = await res.text()
      } catch { /* try Browserless */ }

      // Fallback to Browserless if HTML fetch didn't get useful content
      if ((!html || html.length < 500) && browserlessToken) {
        html = await browserlessRender(url, browserlessToken, 5000)
      }

      if (!html) continue

      // Parse table rows (Citius uses ASP.NET GridView tables)
      const rowPattern = /<tr[^>]*>\s*(?:<td[^>]*>[\s\S]{5,300}<\/td>\s*){3,}/gi
      const rows = [...html.matchAll(rowPattern)].map(m => m[0])

      // Also try to extract any real href links from the page
      const realLinks = [...html.matchAll(/href="(\/portal\/[^"#?]{5,200})"/gi)]
        .map(m => `https://www.citius.mj.pt${m[1]}`)
        .filter(u => !u.includes('ErrorPage') && !u.includes('login') && !u.includes('menu'))

      for (const row of rows.slice(0, 20)) {
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]{1,300}?)<\/td>/gi)].map(m => stripHtml(m[1]).trim())
        if (cells.length < 3) continue

        const text = cells.join(' ')
        // Skip header rows
        if (/processo|tribunal|data|preço/i.test(text) && cells.length > 3) continue

        // Try to extract real href from the row (Citius may have detail links)
        const rowHrefM = row.match(/href="(\/portal\/[^"#?]{5,200})"/i)
        const rowRealUrl = rowHrefM ? `https://www.citius.mj.pt${rowHrefM[1]}` : ''

        const processo = cells.find(c => /\d{3,}\/\d{4}/.test(c)) ?? ''
        const priceCell = cells.find(c => /€|eur/i.test(c) || /\d{4,}/.test(c))
        const preco = parseNum(priceCell?.replace(/[^\d.,]/g, ''))
        const moradaCell = cells.find(c => c.length > 10 && !/^\d+$/.test(c) && c !== processo)
        const morada = moradaCell ?? ''
        if (preco < 1000 && !processo) continue

        // Build a valid URL: prefer real link from row, fallback to search page with processo in hash
        const dealUrl = rowRealUrl || realLinks[deals.length] || `${url}#${encodeURIComponent(processo || text.substring(0, 30))}`

        const zona = detectZona(morada + ' ' + text)
        const zm = getZM(zona)
        const score = quickScore(preco, 0, zm, 'venda_judicial')

        deals.push({
          url: dealUrl,
          platform: 'Citius (Judicial)',
          titulo: `Venda Judicial — ${processo || 'Processo'}`,
          morada, zona,
          preco, area: 0, quartos: 0,
          pm2: 0, pm2_mercado: zm.pm2_trans,
          score, classificacao: getClassificacao(score),
          desconto_mercado_pct: 20, yield_bruto_pct: zm.yield_bruto, roi5y_pct: 0,
          tipo_venda: 'venda_judicial',
          agente: 'Tribunal / Citius', contacto: url, telefone: '',
          is_leilao: true, is_banca: false, processo,
          var_yoy: zm.var_yoy, liquidez: zm.liquidez,
        })
      }
      if (deals.length >= 5) break
    } catch { /* continue to next URL */ }
  }
  return deals
}

// ─── E) Banks via Browserless ─────────────────────────────────────────────────
interface BankSource {
  name: string
  url: string
  selector: string
}

const BANK_LISTINGS: BankSource[] = [
  { name: 'Novo Banco', url: 'https://www.novobancoimoveis.pt/imoveis', selector: '[class*="card"], [class*="property"], [class*="imovel"]' },
  { name: 'BPI', url: 'https://www.quatru.pt/comprar?imovelBpi=true', selector: '[class*="card"], [class*="property"], [class*="listing"]' },
  { name: 'Millennium BCP', url: 'https://millenniumimoveis.janeladigital.com/Search.aspx', selector: 'table tr, [class*="property"], [class*="card"]' },
  { name: 'CGD', url: 'https://www.cgd.pt/Particulares/Credito-Habitacao/imoveis/Pages/pesquisa.aspx', selector: 'table tr, [class*="property"]' },
  { name: 'Santander', url: 'https://imoveis.santander.pt/imoveis', selector: '[class*="card"], [class*="property"]' },
  { name: 'Montepio', url: 'https://imoveismontepio.pt/imoveis', selector: '[class*="card"], [class*="property"]' },
]

async function scrapeBanksBrowserless(token: string): Promise<Deal[]> {
  const deals: Deal[] = []

  await Promise.allSettled(BANK_LISTINGS.map(async (bank) => {
    try {
      const html = await browserlessRender(bank.url, token, 6000)
      if (!html) return

      // Find property links
      const linkPattern = /href="([^"]*(?:imovel|property|detalhe|detail|ficha)[^"]{5,120})"/gi
      const links = [...html.matchAll(linkPattern)]
        .map(m => {
          const href = m[1]
          return href.startsWith('http') ? href : `${new URL(bank.url).origin}${href}`
        })
        .filter((u, i, arr) => arr.indexOf(u) === i)
        .slice(0, 10)

      // Extract prices from listing HTML
      const pricePattern = /(?:€|EUR)\s*([\d.,\s]+)|(?:Preço|Price)[:\s]*€?\s*([\d.,\s]+)/gi
      const prices: number[] = []
      for (const m of html.matchAll(pricePattern)) {
        const p = parseNum(m[1] ?? m[2])
        if (p > 10000) prices.push(p)
      }

      for (let i = 0; i < Math.min(links.length, 8); i++) {
        const link = links[i]
        const preco = prices[i] ?? 0

        // Try to extract morada near the link
        const linkIdx = html.indexOf(link.replace(new URL(bank.url).origin, ''))
        const context = linkIdx > 0 ? html.slice(Math.max(0, linkIdx - 300), linkIdx + 300) : ''
        const locM = context.match(/(?:Lisboa|Porto|Cascais|Algarve|Faro|Funchal|Sintra|Oeiras|Braga|Coimbra|Aveiro|Setúbal|Almada|Amadora|Loures)[^\s<]{0,50}/i)
        const morada = locM ? locM[0] : ''
        const zona = morada ? detectZona(morada) : 'Lisboa'
        const zm = getZM(zona)
        const score = quickScore(preco, 0, zm, 'imovel_banca')

        deals.push({
          url: link, platform: bank.name,
          titulo: `Imóvel ${bank.name}`,
          morada, zona, preco, area: 0, quartos: 0,
          pm2: 0, pm2_mercado: zm.pm2_trans,
          score, classificacao: getClassificacao(score),
          desconto_mercado_pct: 15, yield_bruto_pct: zm.yield_bruto, roi5y_pct: 0,
          tipo_venda: 'imovel_banca',
          agente: bank.name, contacto: bank.url, telefone: '',
          is_leilao: false, is_banca: true, banco: bank.name,
          var_yoy: zm.var_yoy, liquidez: zm.liquidez,
        })
      }
    } catch { /* continue */ }
  }))

  return deals
}

// ─── Banks via Apify Playwright (fallback when no Browserless) ───────────────
async function scrapeBanksApify(token: string): Promise<Deal[]> {
  const deals: Deal[] = []
  try {
    const pageFunction = `async function pageFunction(context) {
      const { page, request } = context;
      const bankName = request.userData.bankName || 'Banco';
      await page.waitForTimeout(5000);
      // Extract property cards / listings
      const cards = await page.evaluate(() => {
        const selectors = [
          '[class*="card"]', '[class*="property"]', '[class*="imovel"]',
          '[class*="listing"]', 'article', '[class*="item"]', 'li[class*="prop"]',
        ];
        let elements: Element[] = [];
        for (const sel of selectors) {
          const found = Array.from(document.querySelectorAll(sel));
          if (found.length > 2) { elements = found; break; }
        }
        return elements.slice(0, 12).map(el => {
          const priceEl = el.querySelector('[class*="price"],[class*="preco"],[class*="valor"]') || el;
          const priceText = priceEl.textContent || '';
          const link = el.querySelector('a');
          const locEl = el.querySelector('[class*="local"],[class*="morada"],[class*="address"],[class*="location"]');
          return {
            title: el.querySelector('h2,h3,h4,strong,[class*="title"],[class*="titulo"]')?.textContent?.trim() || '',
            price: priceText.substring(0, 200),
            url: link?.href || '',
            location: locEl?.textContent?.trim() || '',
            text: el.textContent?.trim().substring(0, 400) || '',
          };
        });
      });
      return { bankName, cards, pageUrl: page.url() };
    }`

    const startUrls = BANK_LISTINGS.map(b => ({
      url: b.url,
      userData: { bankName: b.name },
    }))

    const r = await fetch(
      `https://api.apify.com/v2/acts/apify~playwright-scraper/run-sync-get-dataset-items?token=${token}&timeout=55`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls,
          pageFunction,
          maxPagesPerCrawl: 6,
          launchContext: { launchOptions: { headless: true } },
        }),
        signal: AbortSignal.timeout(60000),
      }
    )
    if (!r.ok) return deals
    const items = await r.json() as unknown[]
    if (!Array.isArray(items)) return deals

    for (const rawItem of items) {
      const item = rawItem as Record<string, unknown>
      const bankName = String(item['bankName'] ?? 'Banco')
      const cards = Array.isArray(item['cards']) ? item['cards'] as Record<string, unknown>[] : []
      const bankSrc = BANK_LISTINGS.find(b => b.name === bankName)
      const bankUrl = bankSrc?.url ?? String(item['pageUrl'] ?? '')

      for (const card of cards.slice(0, 10)) {
        const priceText = String(card['price'] ?? card['text'] ?? '')
        const text = String(card['text'] ?? '')
        const cardUrl = String(card['url'] ?? '')
        const location = String(card['location'] ?? '')

        // Extract price
        const priceM = priceText.match(/([\d][\d\s.,]{2,12})(?:\s*€|\s*EUR)/i) ||
                       text.match(/(?:€|EUR)\s*([\d.,\s]{3,15})/i) ||
                       text.match(/([\d]{3,10}(?:[.,]\d{3})*(?:[.,]\d{0,2})?)\s*(?:€|EUR)/i)
        const preco = parseNum(priceM?.[1])
        if (preco < 5000) continue

        const titulo = String(card['title'] ?? '').substring(0, 100) || `Imóvel ${bankName}`
        const morada = location || ''
        const zona = detectZona(`${titulo} ${morada} ${text}`) || 'Lisboa'
        const zm = getZM(zona)
        const score = quickScore(preco, 0, zm, 'imovel_banca')

        deals.push({
          url: cardUrl || bankUrl,
          platform: bankName,
          titulo,
          morada,
          zona,
          preco, area: 0, quartos: 0,
          pm2: 0, pm2_mercado: zm.pm2_trans,
          score, classificacao: getClassificacao(score),
          desconto_mercado_pct: 15, yield_bruto_pct: zm.yield_bruto, roi5y_pct: 0,
          tipo_venda: 'imovel_banca',
          agente: bankName, contacto: bankUrl, telefone: '',
          is_leilao: false, is_banca: true, banco: bankName,
          var_yoy: zm.var_yoy, liquidez: zm.liquidez,
        })
      }
    }
  } catch (e) { console.error('scrapeBanksApify error:', e) }
  return deals
}

// ─── Bank listings cascade ────────────────────────────────────────────────────
async function scrapeBankListings(browserlessToken?: string, apifyToken?: string): Promise<Deal[]> {
  // 1. Browserless: best quality, full JS render for all 6 banks
  if (browserlessToken) {
    const bDeals = await scrapeBanksBrowserless(browserlessToken)
    if (bDeals.length > 0) return bDeals
  }

  // 2. Apify playwright: renders SPAs, covers all 6 banks
  if (apifyToken) {
    const aDeals = await scrapeBanksApify(apifyToken)
    if (aDeals.length > 0) return aDeals
  }

  // 3. HTML fetch fallback for Santander + Millennium BCP (static-friendly pages)
  const deals: Deal[] = []
  const bankSources = [
    { name: 'Santander', url: 'https://imoveis.santander.pt/imoveis' },
    { name: 'Millennium BCP', url: 'https://millenniumimoveis.janeladigital.com/Search.aspx' },
  ]
  for (const { name, url } of bankSources) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const html = await res.text()
      const links = [...html.matchAll(/href="([^"]*(?:imovel|property|detalhe)[^"]{5,80})"/gi)]
        .map(m => m[1].startsWith('http') ? m[1] : `${new URL(url).origin}${m[1]}`)
        .filter((u, i, arr) => arr.indexOf(u) === i).slice(0, 8)
      for (const link of links) {
        const priceMatch = html.match(new RegExp(`href="${link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,500}€\\s*([\\d.,\\s]+)`, 'i'))
        const preco = parseNum(priceMatch?.[1])
        if (preco < 5000) continue
        const zm = getZM('Lisboa')
        const score = quickScore(preco, 0, zm, 'imovel_banca')
        deals.push({
          url: link, platform: name, titulo: `Imóvel ${name}`, morada: '', zona: 'Lisboa',
          preco, area: 0, quartos: 0, pm2: 0, pm2_mercado: zm.pm2_trans,
          score, classificacao: getClassificacao(score),
          desconto_mercado_pct: 15, yield_bruto_pct: zm.yield_bruto, roi5y_pct: 0,
          tipo_venda: 'imovel_banca',
          agente: name, contacto: url, telefone: '',
          is_leilao: false, is_banca: true, banco: name,
          var_yoy: zm.var_yoy, liquidez: zm.liquidez,
        })
      }
    } catch { /* continue */ }
  }
  return deals
}

// ─── Idealista via Apify ──────────────────────────────────────────────────────
// ─── Shared playwright page function for listing sites ───────────────────────
function buildListingPageFunction(site: 'idealista' | 'imovirtual'): string {
  return `async function pageFunction(context) {
    const { page, request } = context;
    const site = '${site}';
    const precoMax = request.userData.precoMax || 0;
    await page.waitForTimeout(4000);

    // Try __NEXT_DATA__ / embedded JSON first
    const embedded = await page.evaluate(() => {
      try {
        const nd = window.__NEXT_DATA__;
        if (nd) return JSON.stringify(nd);
      } catch {}
      try {
        const scripts = Array.from(document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]'));
        for (const s of scripts) {
          const t = s.textContent || '';
          if (t.includes('price') && t.includes('address') && t.length > 200) return t;
        }
      } catch {}
      return null;
    });

    // Extract listings from DOM
    const listings = await page.evaluate((siteName) => {
      const results = [];
      // Selectors for each platform
      const selectors = siteName === 'idealista'
        ? ['.item-info-container', 'article.item', '[class*="item-info"]', '[class*="listing-item"]']
        : ['[class*="listing"], [data-testid*="listing"]', 'article[class*="property"]', '[class*="offer-item"]', 'li[class*="property"]'];

      let items = [];
      for (const sel of selectors) {
        items = Array.from(document.querySelectorAll(sel));
        if (items.length > 2) break;
      }
      // Fallback: all articles
      if (items.length === 0) items = Array.from(document.querySelectorAll('article'));

      for (const el of items.slice(0, 20)) {
        const linkEl = el.querySelector('a[href*="imovel"], a[href*="property"], a[href*="anuncio"], a[href*="oferta"], a') ;
        const href = linkEl?.href || '';
        if (!href || href === window.location.href) continue;

        const priceEl = el.querySelector('[class*="price"], [class*="preco"], [class*="valor"], [data-testid*="price"]');
        const priceText = priceEl?.textContent?.replace(/\s/g, '') || '';
        const priceM = priceText.match(/(\\d[\\d.,]{2,12})(?:€|EUR)/i) || priceText.match(/€\\s*([\\d.,]{3,12})/i);
        let price = 0;
        if (priceM) {
          const raw = priceM[1].replace(/\\./g, '').replace(',', '.');
          price = parseFloat(raw) || 0;
          if (price < 1000 && raw.includes('.')) price = parseFloat(raw.replace('.','')) || 0;
        }

        const titleEl = el.querySelector('h2, h3, [class*="title"], [class*="titulo"]');
        const areaEl = el.querySelector('[class*="area"], [class*="size"], [class*="tamanho"]');
        const roomsEl = el.querySelector('[class*="room"], [class*="quarto"], [class*="bedroom"], [class*="t0"], [class*="t1"], [class*="t2"], [class*="t3"], [class*="t4"]');
        const locEl = el.querySelector('[class*="location"], [class*="local"], [class*="address"], [class*="morada"], [class*="zone"]');

        const areaText = areaEl?.textContent?.replace(/\\s/g,'') || '';
        const areaM = areaText.match(/(\\d+)\\s*m/i);
        const area = areaM ? parseInt(areaM[1]) : 0;

        const roomsText = roomsEl?.textContent?.trim() || '';
        const roomsM = roomsText.match(/(\\d+)/);
        const rooms = roomsM ? parseInt(roomsM[1]) : 0;

        results.push({
          url: href,
          price,
          titulo: titleEl?.textContent?.trim()?.substring(0, 100) || '',
          area,
          rooms,
          location: locEl?.textContent?.trim()?.substring(0, 80) || '',
          text: el.textContent?.trim()?.substring(0, 300) || '',
        });
      }
      return results;
    }, site);

    return { listings, embedded, pageUrl: page.url() };
  }`
}

function parseListingItems(
  items: unknown[], zona: string, platform: string, precoMax: number | undefined, defaultTipo: TipoImovel = 'apartamento'
): Deal[] {
  const deals: Deal[] = []
  for (const rawItem of items.slice(0, 25)) {
    const item = rawItem as Record<string, unknown>
    const tipoFromRequest = (item['tipoImovel'] ?? defaultTipo) as TipoImovel

    // Handle embedded __NEXT_DATA__
    const embedded = item['embedded']
    if (embedded && typeof embedded === 'string') {
      try {
        const nd = JSON.parse(embedded) as Record<string, unknown>
        const props = (nd['props'] as Record<string, unknown>) ?? {}
        const pageProps = (props['pageProps'] as Record<string, unknown>) ?? {}
        const itemList = Array.isArray(pageProps['itemList'])
          ? pageProps['itemList']
          : Array.isArray(pageProps['properties'])
            ? pageProps['properties']
            : Array.isArray(pageProps['listings'])
              ? pageProps['listings']
              : []
        for (const raw of (itemList as Record<string, unknown>[]).slice(0, 20)) {
          const preco = Number(raw['price'] ?? (raw['priceInfo'] as Record<string,unknown>)?.['amount'] ?? 0)
          const area  = Number(raw['size'] ?? raw['area'] ?? (raw['moreCharacteristics'] as Record<string,unknown>)?.['constructedArea'] ?? 0)
          const qts   = Number(raw['rooms'] ?? (raw['moreCharacteristics'] as Record<string,unknown>)?.['roomNumber'] ?? 0)
          const url    = String(raw['url'] ?? raw['propertyUrl'] ?? '')
          const morada = String(raw['address'] ?? (raw['ubication'] as Record<string,unknown>)?.['title'] ?? '')
          const titulo = String(raw['title'] ?? raw['description'] ?? '').substring(0, 100)
          if (!url || preco < 10000) continue
          if (precoMax && preco > precoMax) continue
          const dz  = detectZona(`${morada} ${titulo}`) || zona
          const zm  = getZM(dz)
          const pm2 = area > 0 ? Math.round(preco / area) : 0
          const val = computeFullValuation(tipoFromRequest, preco, area, zm, 'mercado_livre', titulo, qts, Boolean(morada))
          const yB  = area > 0 && preco > 0 ? parseFloat((zm.renda_m2 * area * 12 / preco * 100).toFixed(2)) : zm.yield_bruto
          deals.push({
            url, platform, titulo, morada, zona: dz, preco, area, quartos: qts,
            pm2, pm2_mercado: zm.pm2_trans,
            classificacao: getClassificacao(val.score),
            desconto_mercado_pct: pm2 > 0 ? Math.round((zm.pm2_trans - pm2) / zm.pm2_trans * 100) : 0,
            yield_bruto_pct: yB, roi5y_pct: 0,
            tipo_venda: 'mercado_livre', agente: platform, contacto: url, telefone: '',
            is_leilao: false, is_banca: false, var_yoy: zm.var_yoy, liquidez: zm.liquidez,
            tipo_imovel: tipoFromRequest, ...val,
          })
        }
        if (deals.length > 0) return deals
      } catch { /* fall through to DOM listings */ }
    }

    // Handle DOM-extracted listings array
    const listings = Array.isArray(item['listings']) ? item['listings'] as Record<string, unknown>[] : []
    for (const listing of listings.slice(0, 20)) {
      const preco  = Number(listing['price'] ?? 0)
      const area   = Number(listing['area'] ?? 0)
      const qts    = Number(listing['rooms'] ?? 0)
      const url    = String(listing['url'] ?? '')
      const titulo = String(listing['titulo'] ?? listing['title'] ?? '').substring(0, 100)
      const morada = String(listing['location'] ?? '')
      const text   = String(listing['text'] ?? '')

      if (!url || preco < 10000) continue
      if (precoMax && preco > precoMax) continue

      const dz  = detectZona(`${morada} ${titulo} ${text}`) || zona
      const zm  = getZM(dz)
      const pm2 = area > 0 ? Math.round(preco / area) : 0
      const val = computeFullValuation(tipoFromRequest, preco, area, zm, 'mercado_livre', titulo, qts, Boolean(morada))
      const yB  = area > 0 && preco > 0 ? parseFloat((zm.renda_m2 * area * 12 / preco * 100).toFixed(2)) : zm.yield_bruto

      deals.push({
        url, platform, titulo, morada, zona: dz, preco, area, quartos: qts,
        pm2, pm2_mercado: zm.pm2_trans,
        classificacao: getClassificacao(val.score),
        desconto_mercado_pct: pm2 > 0 ? Math.round((zm.pm2_trans - pm2) / zm.pm2_trans * 100) : 0,
        yield_bruto_pct: yB, roi5y_pct: 0,
        tipo_venda: 'mercado_livre', agente: platform, contacto: url, telefone: '',
        is_leilao: false, is_banca: false, var_yoy: zm.var_yoy, liquidez: zm.liquidez,
        tipo_imovel: tipoFromRequest, ...val,
      })
    }
  }
  return deals
}

// Idealista URL map por tipo
const IDEALISTA_TIPO_PATH: Record<TipoImovel, string> = {
  apartamento: 'comprar-casas',
  moradia:     'comprar-moradias',
  terreno:     'comprar-terrenos',
  quinta:      'comprar-casas-de-campo',
  comercial:   'comprar-escritorios',
  edificio:    'comprar-predios-e-edificios',
  hotel:       'comprar-outros',
  todos:       'comprar-casas',
}

async function scrapeIdealista(zona: string, token: string, precoMax?: number, tipo?: string, tipos?: TipoImovel[]): Promise<Deal[]> {
  try {
    const baseUrl = ZONA_TO_IDEALISTA[zona] || ZONA_TO_IDEALISTA['Lisboa']
    const tiposList: TipoImovel[] = tipos ?? (tipo ? [tipo as TipoImovel] : ['apartamento', 'moradia'])

    const startUrls = tiposList.flatMap(t => {
      const path = IDEALISTA_TIPO_PATH[t] ?? 'comprar-casas'
      let url = baseUrl.replace('comprar-casas', path)
      if (precoMax && precoMax > 0) url += `preco-ate_${precoMax}/`
      return [{ url, userData: { precoMax: precoMax || 0, tipoImovel: t } }]
    })

    const r = await fetch(
      `https://api.apify.com/v2/acts/apify~playwright-scraper/run-sync-get-dataset-items?token=${token}&timeout=50`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls,
          pageFunction: buildListingPageFunction('idealista'),
          maxPagesPerCrawl: startUrls.length,
        }),
        signal: AbortSignal.timeout(55000),
      }
    )
    if (!r.ok) return []
    const items = await r.json() as unknown[]
    if (!Array.isArray(items)) return []
    return parseListingItems(items, zona, 'Idealista', precoMax)
  } catch { return [] }
}

// ─── Imovirtual via direct HTML fetch (SSR page, no Apify needed) ─────────────
// URL map for Imovirtual by tipo
const IMOVIRTUAL_URLS: Record<TipoImovel, string[]> = {
  apartamento: ['comprar/apartamento'],
  moradia:     ['comprar/moradia'],
  terreno:     ['comprar/terreno'],
  quinta:      ['comprar/quinta-herdade'],
  comercial:   ['comprar/loja', 'comprar/escritorio'],
  edificio:    ['comprar/predio'],
  hotel:       ['comprar/hotel-hostel'],
  todos:       ['comprar/apartamento', 'comprar/moradia', 'comprar/terreno', 'comprar/quinta-herdade', 'comprar/loja', 'comprar/escritorio', 'comprar/predio'],
}

async function scrapeImovirtual(zona: string, _token: string, precoMax?: number, tipos: TipoImovel[] = ['apartamento', 'moradia']): Promise<Deal[]> {
  const deals: Deal[] = []
  try {
    const ROOMS_MAP: Record<string, number> = {
      ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, ZERO: 0,
    }
    const zonaSlug = zona.toLowerCase()
      .replace(/\s—\s.*/g, '').replace(/[àáâã]/g, 'a').replace(/[éê]/g, 'e')
      .replace(/[íî]/g, 'i').replace(/[óô]/g, 'o').replace(/[úû]/g, 'u')
      .replace(/[ç]/g, 'c').replace(/\s+/g, '-')

    // Build URL list from requested tipos
    const urlEntries: { url: string; tipo: TipoImovel }[] = []
    for (const tipo of tipos) {
      const paths = IMOVIRTUAL_URLS[tipo] ?? IMOVIRTUAL_URLS['apartamento']
      for (const path of paths) {
        urlEntries.push({ url: `https://www.imovirtual.com/${path}/${zonaSlug}/`, tipo })
      }
    }

    for (const { url: searchUrl, tipo } of urlEntries) {
      try {
        const res = await fetch(searchUrl, { headers: HEADERS, signal: AbortSignal.timeout(12000) })
        if (!res.ok) continue
        const html = await res.text()

        const slugMatches = [...html.matchAll(/"slug":"([\w-]+-ID[\w]+)"/g)]
        const prices = [...html.matchAll(/"totalPrice":\{"value":(\d+)/g)].map(m => Number(m[1]))
        const areas = [...html.matchAll(/"areaInSquareMeters":(\d+)/g)].map(m => Number(m[1]))
        const titles = [...html.matchAll(/"title":"([^"]{5,100})"/g)].map(m => m[1])
        const rooms = [...html.matchAll(/"roomsNumber":"([A-Z]+)"/g)].map(m => ROOMS_MAP[m[1]] ?? 0)
        const locations = [...html.matchAll(/"location":"([^"]+\/[^"]+\/[^"]+)"/g)].map(m => m[1])

        let priceIdx = 0, areaIdx = 0, titleIdx = 0, roomIdx = 0, locIdx = 0

        for (const [, slug] of slugMatches.slice(0, 25)) {
          if (!slug.includes('-ID')) continue
          const url = `https://www.imovirtual.com/pt/anuncio/${slug}`
          const preco = prices[priceIdx++] ?? 0
          const area  = areas[areaIdx++]  ?? 0
          const titulo = (titles[titleIdx++] ?? slug.replace(/-ID\w+$/, '').replace(/-/g, ' ')).substring(0, 100)
          const qts    = rooms[roomIdx++]  ?? 0
          const loc    = locations[locIdx++] ?? ''
          const morada = loc.split('/').pop()?.replace(/-/g, ' ') ?? zona

          if (preco < 10000) continue
          if (precoMax && preco > precoMax) continue

          const detectedZona = detectZona(`${morada} ${titulo} ${loc}`) || zona
          const zm  = getZM(detectedZona)
          const pm2 = area > 0 ? Math.round(preco / area) : 0
          const val = computeFullValuation(tipo, preco, area, zm, 'mercado_livre', titulo, qts, Boolean(morada))
          const yB  = area > 0 && preco > 0 ? parseFloat((zm.renda_m2 * area * 12 / preco * 100).toFixed(2)) : zm.yield_bruto
          deals.push({
            url, platform: 'Imovirtual', titulo, morada,
            zona: detectedZona, preco, area, quartos: qts,
            pm2, pm2_mercado: zm.pm2_trans,
            classificacao: getClassificacao(val.score),
            desconto_mercado_pct: pm2 > 0 ? Math.round((zm.pm2_trans - pm2) / zm.pm2_trans * 100) : 0,
            yield_bruto_pct: yB, roi5y_pct: 0,
            tipo_venda: 'mercado_livre', agente: 'Imovirtual', contacto: url, telefone: '',
            is_leilao: false, is_banca: false, var_yoy: zm.var_yoy, liquidez: zm.liquidez,
            tipo_imovel: tipo, ...val,
          })
        }
      } catch { /* continue to next type */ }
    }
  } catch { /* continue */ }
  return deals
}

// ─── F) Fetch comparables via Idealista playwright ──────────────────────────
async function fetchComparables(zona: string, preco: number, area: number, token: string): Promise<number> {
  try {
    const deals = await scrapeIdealista(zona, token, preco > 0 ? Math.round(preco * 1.4) : undefined)
    if (deals.length === 0) return 0
    const comparables: number[] = []
    for (const d of deals) {
      if (d.pm2 < 500) continue
      if (area > 0 && d.area > 0 && Math.abs(d.area - area) / area > 0.4) continue
      if (preco > 0 && d.preco > 0 && Math.abs(d.preco - preco) / preco > 0.5) continue
      comparables.push(d.pm2)
    }
    if (comparables.length === 0) return 0
    const slice = comparables.slice(0, 5)
    return Math.round(slice.reduce((s, v) => s + v, 0) / slice.length)
  } catch { return 0 }
}

// ─── G) Supercasa via JSON-LD (server-side rendered, clean structured data) ───
// Structure: <a href="/venda-T3-lisboa/i2170411" title="..." class="property-link">
//            + <script type="application/ld+json">{"@type":"Offer","name":"...","price":["610.000"],"addressRegion":"Arroios","telephone":"..."}
// The n-th property-link corresponds to the n-th Offer JSON-LD block
// Supercasa URL map por tipo
const SUPERCASA_TIPO_PATH: Record<TipoImovel, string> = {
  apartamento: 'comprar-apartamentos',
  moradia:     'comprar-moradias',
  terreno:     'comprar-terrenos',
  quinta:      'comprar-quintas-e-herdades',
  comercial:   'comprar-escritorios',
  edificio:    'comprar-predios',
  hotel:       'comprar-predios',
  todos:       'comprar-casas',
}

async function scrapeSupercasa(zona: string, apifyToken?: string, precoMax?: number, tipos: TipoImovel[] = ['apartamento', 'moradia']): Promise<Deal[]> {
  const deals: Deal[] = []

  // Helper to parse HTML with JSON-LD + property-link pattern
  function parseSupercasaHtml(html: string, searchUrl: string, tipo: TipoImovel): Deal[] {
    const result: Deal[] = []
    if (html.length < 5000 || !html.includes('property-link')) return result

    const linkMatches = [...html.matchAll(/href="(\/(?:venda|comprar)-[^"?#]{5,100})"[^>]*class="property-link"/g)]
    const titleMatches = [...html.matchAll(/href="\/[^"]*"[^>]*title="([^"]+)"[^>]*class="property-link"/g)]
    const offerMatches = [...html.matchAll(/"@type":"Offer","image":"[^"]*","name":"([^"]+)","category":"[^"]*","price":\["([^"]+)"\],"priceCurrency":\["[^"]*"\],"availabilityStarts":"[^"]*","availableAtOrFrom":\{"@type":"Place","address":\{"addressCountry":[0-9]+,"addressLocality":"([^"]+)","addressRegion":"([^"]+)"\}/g)]
    const phoneMatches = [...html.matchAll(/"telephone":"(\+?[\d ]{9,20})"/g)]

    const count = Math.min(linkMatches.length, offerMatches.length, 25)
    for (let i = 0; i < count; i++) {
      const href = linkMatches[i]?.[1] ?? ''
      const titleAttr = titleMatches[i]?.[1] ?? ''
      const [, name, rawPrice, locality, region] = offerMatches[i]
      const telefone = phoneMatches[i]?.[1] ?? ''
      const listingUrl = href ? `https://supercasa.pt${href}` : searchUrl
      const titulo = name || titleAttr || 'Imóvel Supercasa'
      const morada = `${region}, ${locality}`.substring(0, 100)
      const preco = parseNum(rawPrice)
      if (preco < 5000) continue
      if (precoMax && preco > precoMax) continue
      const roomsM = (titleAttr || name).match(/\bT(\d)\b/i)
      const quartos = roomsM ? Number(roomsM[1]) : 0
      const areaM = (titleAttr || name).match(/([\d]+)\s*m²/i)
      const area = areaM ? Number(areaM[1]) : 0
      const detectedZona = detectZona(`${titulo} ${morada} ${zona}`)
      const zm = getZM(detectedZona)
      const pm2 = area > 0 && preco > 0 ? Math.round(preco / area) : 0
      const val = computeFullValuation(tipo, preco, area, zm, 'mercado_livre', titulo, quartos, Boolean(morada))
      const yB  = area > 0 && preco > 0 ? parseFloat((zm.renda_m2 * area * 12 / preco * 100).toFixed(2)) : zm.yield_bruto
      result.push({
        url: listingUrl, platform: 'Supercasa',
        titulo: titulo.substring(0, 80), morada, zona: detectedZona,
        preco, area, quartos, pm2, pm2_mercado: zm.pm2_trans,
        classificacao: getClassificacao(val.score),
        desconto_mercado_pct: pm2 > 0 ? Math.round((zm.pm2_trans - pm2) / zm.pm2_trans * 100) : 0,
        yield_bruto_pct: yB, roi5y_pct: 0,
        tipo_venda: 'mercado_livre',
        agente: 'Supercasa', contacto: listingUrl, telefone,
        is_leilao: false, is_banca: false,
        var_yoy: zm.var_yoy, liquidez: zm.liquidez,
        tipo_imovel: tipo, ...val,
      })
    }
    return result
  }

  try {
    const zonaSlug = zona.toLowerCase()
      .replace(/\s—\s.*/g, '').replace(/[àáâã]/g, 'a').replace(/[éê]/g, 'e')
      .replace(/[íî]/g, 'i').replace(/[óô]/g, 'o').replace(/[úû]/g, 'u')
      .replace(/[ç]/g, 'c').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    // Search all requested tipos
    for (const tipo of tipos) {
      const path = SUPERCASA_TIPO_PATH[tipo] ?? 'comprar-casas'
      const searchUrl = `https://supercasa.pt/${path}/${zonaSlug}`
      try {
        // 1. Try direct HTML fetch (works from residential IPs)
        let html = ''
        try {
          const res = await fetch(searchUrl, {
            headers: { ...HEADERS, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Referer': 'https://www.google.pt/' },
            signal: AbortSignal.timeout(10000),
          })
          if (res.ok) html = await res.text()
        } catch { /* try Apify */ }

        const directDeals = parseSupercasaHtml(html, searchUrl, tipo)
        deals.push(...directDeals)
        if (directDeals.length > 0) continue // got results, skip Apify for this tipo

        // 2. Apify fallback (works from datacenter IPs)
        if (apifyToken) {
          try {
            const r = await fetch(
              `https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=40`,
              {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  startUrls: [{ url: searchUrl }],
                  pageFunction: `async function pageFunction(context) {
                    return [{ html: document.documentElement.outerHTML.substring(0, 300000) }];
                  }`,
                  maxPagesPerCrawl: 1,
                }),
                signal: AbortSignal.timeout(50000),
              }
            )
            if (r.ok) {
              const items = await r.json() as unknown[]
              if (Array.isArray(items) && items.length > 0) {
                const item = items[0] as Record<string, unknown>
                const apifyHtml = String(item['html'] ?? '')
                deals.push(...parseSupercasaHtml(apifyHtml, searchUrl, tipo))
              }
            }
          } catch { /* continue */ }
        }
      } catch { /* continue to next tipo */ }
    }
  } catch { /* continue */ }
  return deals
}

// Casa Sapo URL map por tipo
const CASASAPO_TIPO_PATH: Record<TipoImovel, string[]> = {
  apartamento: ['comprar-apartamentos'],
  moradia:     ['comprar-moradias'],
  terreno:     ['comprar-terrenos'],
  quinta:      ['comprar-quintas-e-herdades'],
  comercial:   ['comprar-escritorios', 'comprar-lojas'],
  edificio:    ['comprar-predios'],
  hotel:       ['comprar-predios'],
  todos:       ['comprar-apartamentos', 'comprar-moradias', 'comprar-terrenos', 'comprar-quintas-e-herdades', 'comprar-escritorios', 'comprar-predios'],
}

// ─── H) Casa Sapo via direct HTML (+ Apify fallback for datacenter IPs) ──────
async function scrapeCasaSapo(zona: string, precoMax?: number, apifyToken?: string, tipos: TipoImovel[] = ['apartamento', 'moradia']): Promise<Deal[]> {
  const deals: Deal[] = []
  try {
    const zonaSlug = zona.toLowerCase()
      .replace(/\s—\s.*/g, '').replace(/[àáâã]/g, 'a').replace(/[éê]/g, 'e')
      .replace(/[íî]/g, 'i').replace(/[óô]/g, 'o').replace(/[úû]/g, 'u')
      .replace(/[ç]/g, 'c').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    // Build URL list from requested tipos
    const urlEntries: { url: string; tipo: TipoImovel }[] = []
    for (const tipo of tipos) {
      const paths = CASASAPO_TIPO_PATH[tipo] ?? ['comprar-apartamentos']
      for (const path of paths) {
        urlEntries.push({ url: `https://casa.sapo.pt/${path}/${zonaSlug}/`, tipo })
      }
    }
    const urls = urlEntries.map(e => e.url)

    let htmlFetchWorked = false

    for (const { url: searchUrl, tipo } of urlEntries) {
      try {
        const res = await fetch(searchUrl, {
          headers: {
            ...HEADERS,
            'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
            'Accept-Language': 'pt-PT,pt;q=0.9',
            'Cache-Control': 'no-cache',
          },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) continue
        const html = await res.text()
        if (html.length < 5000 || !html.includes('property-price-value')) continue
        htmlFetchWorked = true

        // Casa Sapo SSR structure:
        // <div id="property_{guid}" class="property ...">
        //   <a class="property-info" href="https://gespub.casa.sapo.pt/...&l=https://casa.sapo.pt/...html">
        //   <div class="property-type">Apartamento T3</div>
        //   <div class="property-location">Bairro, Zona, Lisboa</div>
        //   <div class="property-features-text">94m²</div>
        //   <div class="property-price-value">529.900 €</div>

        // Split into property blocks by id="property_"
        const blocks = html.split(/(?=<div[^>]+id="property_)/)

        for (const block of blocks.slice(1, 25)) {
          // Extract direct listing URL from tracking link: &l=https://casa.sapo.pt/...
          const urlM = block.match(/(?:[?&]|&amp;)l=(https:\/\/casa\.sapo\.pt\/[^"&?]+\.html)/i)
          // Fallback: extract from title + id
          const idM = block.match(/id="property_([0-9a-f-]+)"/i)
          const titleM = block.match(/title="Ver ([^"]{5,120})"/i)

          let listingUrl = urlM?.[1] ?? ''
          if (!listingUrl && idM) {
            // Try to reconstruct URL from title attribute
            const titleAttr = titleM?.[1] ?? ''
            const slug = titleAttr.toLowerCase()
              .replace(/para comprar em /g, '').replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
            listingUrl = `https://casa.sapo.pt/${slug}-${idM[1]}.html`
          }

          // Price
          const priceM = block.match(/class="property-price-value">([^<]+)</i)
          const priceText = priceM?.[1]?.replace(/\s/g, '') ?? ''
          const preco = parseNum(priceText.replace('€', '').replace('EUR', ''))
          if (preco < 5000) continue
          if (precoMax && preco > precoMax) continue

          // Type (Apartamento T3, Moradia, etc)
          const typeM = block.match(/class="property-type">([^<]+)</i)
          const tipoImovel = typeM?.[1]?.trim() ?? ''

          // Location
          const locM = block.match(/class="property-location">([^<]+)</i)
          const morada = locM?.[1]?.trim() ?? ''

          // Area
          const areaM = block.match(/([\d]+)\s*m²/i)
          const area = Number(areaM?.[1] ?? 0)

          // Rooms from type string: T0, T1, T2, T3...
          const roomsM = tipoImovel.match(/T(\d)/i)
          const quartos = roomsM ? Number(roomsM[1]) : 0

          const titulo = tipoImovel || 'Imóvel Casa Sapo'
          const detectedZona = detectZona(`${titulo} ${morada} ${zona}`)
          const zm  = getZM(detectedZona)
          const pm2 = area > 0 && preco > 0 ? Math.round(preco / area) : 0
          const val = computeFullValuation(tipo, preco, area, zm, 'mercado_livre', titulo, quartos, Boolean(morada))
          const yB  = area > 0 && preco > 0 ? parseFloat((zm.renda_m2 * area * 12 / preco * 100).toFixed(2)) : zm.yield_bruto

          deals.push({
            url: listingUrl || searchUrl,
            platform: 'Casa Sapo',
            titulo: titulo.substring(0, 80),
            morada: morada.substring(0, 100),
            zona: detectedZona,
            preco, area, quartos, pm2,
            pm2_mercado: zm.pm2_trans,
            classificacao: getClassificacao(val.score),
            desconto_mercado_pct: pm2 > 0 ? Math.round((zm.pm2_trans - pm2) / zm.pm2_trans * 100) : 0,
            yield_bruto_pct: yB, roi5y_pct: 0,
            tipo_venda: 'mercado_livre',
            tipo_imovel: tipo,
            agente: 'Casa Sapo', contacto: listingUrl || searchUrl, telefone: '',
            is_leilao: false, is_banca: false,
            var_yoy: zm.var_yoy, liquidez: zm.liquidez,
            ...val,
          })
        }
      } catch { /* continue to next URL */ }
    }

    // ── Apify fallback when direct HTML is blocked ──────────────────────────
    if (!htmlFetchWorked && apifyToken) {
      try {
        const searchUrl = `https://casa.sapo.pt/comprar-apartamentos/${zonaSlug}/`
        const r = await fetch(
          `https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=40`,
          {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startUrls: [{ url: searchUrl }],
              pageFunction: `async function pageFunction(context) {
                const blocks = Array.from(document.querySelectorAll('[id^="property_"]'));
                return blocks.slice(0, 20).map(el => ({
                  tipo: el.querySelector('.property-type')?.textContent?.trim() || '',
                  local: el.querySelector('.property-location')?.textContent?.trim() || '',
                  preco: el.querySelector('.property-price-value')?.textContent?.trim() || '',
                  area: el.querySelector('.property-features-text')?.textContent?.trim() || '',
                  url: (function() {
                    const raw = el.querySelector('a.property-info')?.href || '';
                    // Extract real URL from tracking link: gespub.casa.sapo.pt/...&l=https://casa.sapo.pt/...
                    const m = raw.match(/[?&]l=(https:\/\/casa\.sapo\.pt\/[^&"]+\.html)/i);
                    return m ? m[1] : raw || document.location.href;
                  })(),
                }));
              }`,
              maxPagesPerCrawl: 1,
            }),
            signal: AbortSignal.timeout(45000),
          }
        )
        if (r.ok) {
          const rows = await r.json() as unknown[]
          if (Array.isArray(rows)) {
            for (const rawRow of rows.flat().slice(0, 20)) {
              const row = rawRow as Record<string, string>
              const preco = parseNum((row['preco'] ?? '').replace(/[€\s]/g, ''))
              if (preco < 5000) continue
              if (precoMax && preco > precoMax) continue
              const areaM = (row['area'] ?? '').match(/([\d,]+)\s*m²/i)
              const area = parseNum(areaM?.[1])
              const roomsM = (row['tipo'] ?? '').match(/T(\d)/i)
              const quartos = roomsM ? Number(roomsM[1]) : 0
              const morada = row['local'] ?? ''
              const titulo = row['tipo'] ?? 'Imóvel Casa Sapo'
              const detectedZona = detectZona(`${titulo} ${morada} ${zona}`)
              const zm = getZM(detectedZona)
              const pm2 = area > 0 && preco > 0 ? Math.round(preco / area) : 0
              // Apify fallback only fetches apartamentos; use first tipo from the requested list
              const apifyTipo: TipoImovel = tipos[0] ?? 'apartamento'
              const val = computeFullValuation(apifyTipo, preco, area, zm, 'mercado_livre', titulo, quartos, Boolean(morada))
              deals.push({
                url: row['url'] || searchUrl, platform: 'Casa Sapo',
                titulo: titulo.substring(0, 80), morada: morada.substring(0, 100),
                zona: detectedZona, preco, area, quartos, pm2,
                pm2_mercado: zm.pm2_trans, classificacao: getClassificacao(val.score),
                desconto_mercado_pct: pm2 > 0 ? Math.round((zm.pm2_trans - pm2) / zm.pm2_trans * 100) : 0,
                yield_bruto_pct: area > 0 && preco > 0
                  ? parseFloat((zm.renda_m2 * area * 12 / preco * 100).toFixed(2)) : zm.yield_bruto,
                roi5y_pct: 0, tipo_venda: 'mercado_livre',
                tipo_imovel: apifyTipo,
                agente: 'Casa Sapo', contacto: row['url'] || searchUrl, telefone: '',
                is_leilao: false, is_banca: false,
                var_yoy: zm.var_yoy, liquidez: zm.liquidez,
                ...val,
              })
            }
          }
        }
      } catch { /* continue */ }
    }
  } catch { /* continue */ }
  return deals
}

// ─── I) Rightmove Overseas Portugal ──────────────────────────────────────────
async function scrapeRightmove(zona: string, precoMax?: number): Promise<Deal[]> {
  const deals: Deal[] = []
  try {
    // Rightmove Overseas: country-level page has embedded JSON with hotProperties + search results
    // URL: https://www.rightmove.co.uk/overseas-property/in-portugal.html
    const searchUrl = 'https://www.rightmove.co.uk/overseas-property/in-portugal.html'

    const res = await fetch(searchUrl, {
      headers: {
        ...HEADERS,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return deals
    const html = await res.text()
    if (html.length < 5000) return deals

    // Rightmove SSR JSON structure (hotProperties array):
    // {"id":171530525,"displayAddress":"Vale do Lobo, Algarve","price":{"amount":6250000,...},"propertyType":"Houses","bedrooms":4}
    // Property URL: https://www.rightmove.co.uk/properties/{id}
    const propertyBlocks = [...html.matchAll(/"id":(\d{7,12}),"displayAddress":"([^"]+)","price":\{"amount":(\d+)[^}]*\},"propertyType":"([^"]+)","bedrooms":(\d+)/g)]

    for (const m of propertyBlocks.slice(0, 25)) {
      const [, id, address, rawPrice, propType, rawBeds] = m
      const preco = Number(rawPrice)
      const quartos = Number(rawBeds)

      if (!preco || preco < 10000) continue
      if (precoMax && preco > precoMax) continue

      // Filter by zone (Rightmove returns all Portugal — filter by address mention)
      const zmRef = getZM(zona)
      const region = zmRef.region.toLowerCase()
      const addressLower = address.toLowerCase()
      // If zona is not Lisboa/Nacional, only include if address matches
      if (zona !== 'Lisboa' && zona !== 'Nacional') {
        const zonaKeywords = zona.toLowerCase().split(/[\s—\/]+/)
        const regionKeywords = region.split(/[\s\/]+/)
        const allKeywords = [...new Set([...zonaKeywords, ...regionKeywords])]
        const matches = allKeywords.some(kw => kw.length > 3 && addressLower.includes(kw))
        if (!matches) continue
      }

      const propertyUrl = `https://www.rightmove.co.uk/properties/${id}`
      const detectedZona = detectZona(`${address} ${zona}`)
      const zmD = getZM(detectedZona)

      // Map Rightmove propType → TipoImovel for accurate scoring
      const ptLower = propType.toLowerCase()
      const rmTipo: TipoImovel = ptLower.includes('flat') || ptLower.includes('apartment') ? 'apartamento'
        : ptLower.includes('house') || ptLower.includes('villa') ? 'moradia'
        : ptLower.includes('land') ? 'terreno'
        : ptLower.includes('farm') || ptLower.includes('country') ? 'quinta'
        : ptLower.includes('commercial') || ptLower.includes('office') ? 'comercial'
        : ptLower.includes('hotel') || ptLower.includes('hostel') ? 'hotel'
        : 'moradia'
      // Note: area=0 from Rightmove — comparable model uses estimated size from quartos
      const rmArea = quartos > 0 ? quartos * 30 + 40 : 0  // rough estimate for income model
      const val = computeFullValuation(rmTipo, preco, rmArea, zmD, 'mercado_livre', `${propType} ${address}`, quartos, true)
      deals.push({
        url: propertyUrl,
        platform: 'Rightmove Overseas',
        titulo: `${propType} T${quartos} — ${address}`.substring(0, 100).trim(),
        morada: address.substring(0, 100),
        zona: detectedZona,
        preco, area: 0, quartos,
        pm2: 0, pm2_mercado: zmD.pm2_trans,
        classificacao: getClassificacao(val.score),
        desconto_mercado_pct: 0,
        yield_bruto_pct: zmD.yield_bruto, roi5y_pct: 0,
        tipo_venda: 'mercado_livre',
        tipo_imovel: rmTipo,
        agente: 'Rightmove UK', contacto: propertyUrl, telefone: '',
        is_leilao: false, is_banca: false,
        var_yoy: zmD.var_yoy, liquidez: zmD.liquidez,
        ...val,
      })
    }
  } catch { /* continue */ }
  return deals
}

// ─── Store deal in price history (fire-and-forget) ───────────────────────────
function trackPriceHistory(deal: Deal, baseUrl: string): void {
  const historyUrl = `${baseUrl}/api/radar/history`
  fetch(historyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: deal.url,
      preco: deal.preco,
      zona: deal.zona,
      platform: deal.platform,
      score: deal.score,
    }),
  }).catch(() => { /* fire and forget — don't block response */ })
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!checkRate(ip)) {
      return NextResponse.json(
        { error: 'Rate limit: 10 buscas/hora. Aguarda ou usa o análise de URL.' },
        { status: 429 }
      )
    }

    const APIFY_TOKEN = process.env.APIFY_TOKEN
    const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN
    // Derive base URL from the request itself — works on any port (dev/prod)
    const reqHost  = req.headers.get('host') ?? 'localhost:3000'
    const reqProto = req.headers.get('x-forwarded-proto') ?? (reqHost.includes('localhost') ? 'http' : 'https')
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? `${reqProto}://${reqHost}`

    const body = (await req.json()) as Record<string, unknown>
    const zona = String(body['zona'] ?? 'Lisboa')
    const preco_min = Number(body['preco_min'] ?? 0)
    const preco_max = Number(body['preco_max'] ?? 0)
    const score_min = Number(body['score_min'] ?? 55)
    const fontesList: string[] = Array.isArray(body['fontes'])
      ? (body['fontes'] as unknown[]).map(f => String(f))
      : ['imovirtual', 'casasapo', 'eleiloes', 'banca', 'citius']

    // Tipos de imóvel — suporta array (novos) ou string legacy (retrocompatível)
    const tipoRaw = body['tipos'] ?? body['tipo']
    const tipos: TipoImovel[] = Array.isArray(tipoRaw)
      ? (tipoRaw as unknown[]).map(t => String(t) as TipoImovel)
      : tipoRaw
        ? [String(tipoRaw) as TipoImovel]
        : ['apartamento', 'moradia']

    const tasks: Promise<Deal[]>[] = []

    if (fontesList.includes('idealista') && APIFY_TOKEN) {
      tasks.push(scrapeIdealista(zona, APIFY_TOKEN, preco_max || undefined, undefined, tipos).catch(() => []))
    }
    if (fontesList.includes('imovirtual')) {
      tasks.push(scrapeImovirtual(zona, APIFY_TOKEN ?? '', preco_max || undefined, tipos).catch(() => []))
    }
    if (fontesList.includes('eleiloes')) {
      tasks.push(scrapeEleiloesListings(BROWSERLESS_TOKEN, APIFY_TOKEN).catch(() => []))
    }
    if (fontesList.includes('banca')) {
      tasks.push(scrapeBankListings(BROWSERLESS_TOKEN, APIFY_TOKEN).catch(() => []))
    }
    if (fontesList.includes('citius')) {
      tasks.push(scrapeCitiusListings(BROWSERLESS_TOKEN).catch(() => []))
    }
    if (fontesList.includes('supercasa')) {
      tasks.push(scrapeSupercasa(zona, APIFY_TOKEN, preco_max || undefined, tipos).catch(() => []))
    }
    if (fontesList.includes('casasapo')) {
      tasks.push(scrapeCasaSapo(zona, preco_max || undefined, APIFY_TOKEN, tipos).catch(() => []))
    }
    if (fontesList.includes('rightmove')) {
      tasks.push(scrapeRightmove(zona, preco_max || undefined).catch(() => []))
    }

    // ── FASE 1: Scraping em paralelo + arrendamentos reais ────────────────────
    const [settled, realRents] = await Promise.all([
      Promise.allSettled(tasks),
      scrapeRealRentals(zona, tipos).catch(() => ({ residencial:0, escritorio:0, loja:0 })),
    ])

    let allDeals: Deal[] = settled.flatMap(r => r.status === 'fulfilled' ? r.value : [])

    // Filter by budget
    if (preco_min > 0) allDeals = allDeals.filter(d => d.preco === 0 || d.preco >= preco_min)
    if (preco_max > 0) allDeals = allDeals.filter(d => d.preco === 0 || d.preco <= preco_max)

    // Deduplicate by URL
    const seenPre = new Set<string>()
    allDeals = allDeals.filter(d => {
      if (!d.url || seenPre.has(d.url)) return false
      seenPre.add(d.url)
      return true
    })

    // ── FASE 2: Post-process base (texto + rendas reais + comparáveis) ────────
    allDeals = postProcessDeals(allDeals, realRents)
    allDeals = allDeals.filter(d => d.score >= score_min)
    const top = allDeals.slice(0, 25)

    const comparables_used = top.some(d => (d.comparaveis_reais ?? 0) >= 2)

    // ── FASE 3: Deep enrichment em paralelo (top 5/10 apenas) ─────────────────
    // Ficha completa (top 5) + Geocoding (top 5, sequencial) + Histórico (top 10)
    const top5 = top.slice(0, 5)
    const top10 = top.slice(0, 10)

    await Promise.all([
      // Ficha completa — scrape individual pages for top 5
      Promise.allSettled(top5.map(d => enrichFromListingPage(d))),
      // Geocoding — sequential inside, max 5.5s for 5 deals
      applyGeoToDeals(top5),
      // Price history — cross-reference existing tracker
      Promise.allSettled(top10.map(d => checkPriceHistory(d, baseUrl))),
    ])

    // Re-sort after deep enrichment (scores may have changed)
    top.sort((a, b) => b.score - a.score)

    // Track price history for top deals (fire and forget — write new points)
    for (const deal of top.slice(0, 5)) {
      trackPriceHistory(deal, baseUrl)
    }

    // Stats
    const avgScore = top.length > 0 ? Math.round(top.reduce((s, d) => s + d.score, 0) / top.length) : 0
    const bestDeal = top[0] ?? null
    const leiloes = top.filter(d => d.is_leilao).length
    const banca = top.filter(d => d.is_banca).length
    const citiusDeals = top.filter(d => d.tipo_venda === 'venda_judicial').length

    return NextResponse.json({
      success: true,
      zona,
      generated_at: new Date().toISOString(),
      total: top.length,
      stats: {
        avg_score: avgScore,
        leiloes,
        banca,
        citius: citiusDeals,
        mercado_livre: top.length - leiloes - banca,
      },
      best_deal: bestDeal,
      results: top,
      fontes_usadas: fontesList,
      apify_disponivel: Boolean(APIFY_TOKEN),
      browserless_disponivel: Boolean(BROWSERLESS_TOKEN),
      bancos_cobertura: BROWSERLESS_TOKEN ? '6/6 (Browserless)' : APIFY_TOKEN ? '6/6 (Apify)' : '2/6 (HTML)',
      fontes_activas: fontesList,
      citius_deals: citiusDeals,
      comparables_used,
      real_rent_m2: realRents.residencial > 0 ? realRents.residencial : null,
      real_rent_escritorio: realRents.escritorio > 0 ? realRents.escritorio : null,
      real_rent_loja: realRents.loja > 0 ? realRents.loja : null,
      enrichment_applied: true,
      geo_enriched: top5.some(d => d.lat !== undefined),
      page_enriched: top5.some(d => d.confidence_score !== undefined && d.confidence_score > 70),
      history_tracked: top10.some(d => d.dias_mercado !== undefined),
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
