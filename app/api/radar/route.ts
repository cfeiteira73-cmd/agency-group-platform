import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

const RadarSchema = z.object({
  url: z.string().min(5, 'URL ou texto inválido'),
})

// ─── Cache 6h ─────────────────────────────────────────────────────────────────
const responseCache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 6 * 60 * 60 * 1000

function hashKey(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return String(Math.abs(h))
}

// ─── Rate limit 30/hour ────────────────────────────────────────────────────────
const rateMap = new Map<string, { count: number; reset: number }>()
function checkRate(ip: string): boolean {
  const now = Date.now()
  const e = rateMap.get(ip)
  if (!e || now > e.reset) { rateMap.set(ip, { count: 1, reset: now + 3600000 }); return true }
  if (e.count >= 30) return false
  e.count++; return true
}

// ─── Zone Market Data Q1 2026 ─────────────────────────────────────────────────
interface ZoneMarket {
  pm2_trans: number; pm2_ask: number; var_yoy: number; var_qtq: number
  renda_m2: number; yield_bruto: number; yield_al: number
  abs_meses: number; dias_mercado: number; comp_int_pct: number
  demanda: number; liquidez: number; risco: number
  construcao_novo_m2: number; region: string
}

const ZONES: Record<string, ZoneMarket> = {
  // ── LISBOA ───────────────────────────────────────────────────────────────────
  'Lisboa':                        { pm2_trans:5000,  pm2_ask:5400,  var_yoy:22.0, var_qtq:5.5, renda_m2:18.5, yield_bruto:4.4, yield_al:6.8, abs_meses:1.8, dias_mercado:45,  comp_int_pct:38, demanda:9.0, liquidez:8.5, risco:3.5, construcao_novo_m2:1800, region:'Lisboa' },
  'Lisboa — Chiado/Santos':        { pm2_trans:7000,  pm2_ask:7500,  var_yoy:20.0, var_qtq:4.8, renda_m2:25.0, yield_bruto:4.3, yield_al:8.2, abs_meses:1.5, dias_mercado:35,  comp_int_pct:55, demanda:9.5, liquidez:9.0, risco:3.0, construcao_novo_m2:2200, region:'Lisboa' },
  'Lisboa — Príncipe Real':        { pm2_trans:7400,  pm2_ask:7900,  var_yoy:19.0, var_qtq:4.5, renda_m2:26.0, yield_bruto:4.2, yield_al:7.9, abs_meses:1.6, dias_mercado:38,  comp_int_pct:52, demanda:9.5, liquidez:8.5, risco:3.0, construcao_novo_m2:2300, region:'Lisboa' },
  'Lisboa — Bairro Alto':          { pm2_trans:6700,  pm2_ask:7100,  var_yoy:19.0, var_qtq:4.5, renda_m2:23.5, yield_bruto:4.2, yield_al:8.0, abs_meses:1.6, dias_mercado:40,  comp_int_pct:50, demanda:9.0, liquidez:8.5, risco:3.2, construcao_novo_m2:2100, region:'Lisboa' },
  'Lisboa — Estrela/Lapa':         { pm2_trans:6500,  pm2_ask:6900,  var_yoy:18.0, var_qtq:4.3, renda_m2:22.0, yield_bruto:4.1, yield_al:7.0, abs_meses:1.8, dias_mercado:45,  comp_int_pct:45, demanda:8.5, liquidez:8.0, risco:3.2, construcao_novo_m2:2000, region:'Lisboa' },
  'Lisboa — Santos':               { pm2_trans:5800,  pm2_ask:6200,  var_yoy:20.0, var_qtq:4.8, renda_m2:20.5, yield_bruto:4.2, yield_al:7.5, abs_meses:1.7, dias_mercado:42,  comp_int_pct:48, demanda:8.5, liquidez:8.0, risco:3.2, construcao_novo_m2:1900, region:'Lisboa' },
  'Lisboa — Alfama/Mouraria':      { pm2_trans:5200,  pm2_ask:5600,  var_yoy:18.0, var_qtq:4.2, renda_m2:18.5, yield_bruto:4.3, yield_al:8.5, abs_meses:2.0, dias_mercado:55,  comp_int_pct:42, demanda:8.0, liquidez:7.5, risco:3.5, construcao_novo_m2:1700, region:'Lisboa' },
  'Lisboa — Campo de Ourique':     { pm2_trans:5700,  pm2_ask:6100,  var_yoy:17.0, var_qtq:4.0, renda_m2:20.0, yield_bruto:4.2, yield_al:6.5, abs_meses:1.8, dias_mercado:50,  comp_int_pct:35, demanda:8.5, liquidez:8.0, risco:3.3, construcao_novo_m2:1800, region:'Lisboa' },
  'Lisboa — Avenidas Novas':       { pm2_trans:5500,  pm2_ask:5900,  var_yoy:19.0, var_qtq:4.5, renda_m2:19.5, yield_bruto:4.2, yield_al:6.8, abs_meses:1.8, dias_mercado:45,  comp_int_pct:38, demanda:8.5, liquidez:8.0, risco:3.3, construcao_novo_m2:1800, region:'Lisboa' },
  'Lisboa — Alvalade':             { pm2_trans:4800,  pm2_ask:5200,  var_yoy:18.0, var_qtq:4.3, renda_m2:17.0, yield_bruto:4.2, yield_al:6.0, abs_meses:1.9, dias_mercado:50,  comp_int_pct:25, demanda:8.0, liquidez:8.0, risco:3.4, construcao_novo_m2:1700, region:'Lisboa' },
  'Lisboa — Parque das Nações':    { pm2_trans:5200,  pm2_ask:5600,  var_yoy:23.0, var_qtq:5.7, renda_m2:18.5, yield_bruto:4.3, yield_al:7.0, abs_meses:1.7, dias_mercado:40,  comp_int_pct:40, demanda:8.5, liquidez:8.5, risco:3.2, construcao_novo_m2:1800, region:'Lisboa' },
  'Lisboa — Belém/Restelo':        { pm2_trans:5500,  pm2_ask:5900,  var_yoy:17.0, var_qtq:4.0, renda_m2:19.0, yield_bruto:4.1, yield_al:6.5, abs_meses:2.0, dias_mercado:55,  comp_int_pct:35, demanda:8.0, liquidez:7.5, risco:3.4, construcao_novo_m2:1800, region:'Lisboa' },
  'Lisboa — Beato/Marvila':        { pm2_trans:4500,  pm2_ask:4900,  var_yoy:30.0, var_qtq:7.2, renda_m2:15.5, yield_bruto:4.1, yield_al:6.0, abs_meses:2.2, dias_mercado:65,  comp_int_pct:28, demanda:8.5, liquidez:7.0, risco:4.0, construcao_novo_m2:1600, region:'Lisboa' },
  'Lisboa — Intendente':           { pm2_trans:4300,  pm2_ask:4700,  var_yoy:26.0, var_qtq:6.3, renda_m2:14.5, yield_bruto:4.0, yield_al:5.5, abs_meses:2.3, dias_mercado:70,  comp_int_pct:22, demanda:7.5, liquidez:6.5, risco:4.2, construcao_novo_m2:1600, region:'Lisboa' },
  'Lisboa — Alcântara':            { pm2_trans:4900,  pm2_ask:5300,  var_yoy:22.0, var_qtq:5.3, renda_m2:17.0, yield_bruto:4.1, yield_al:6.5, abs_meses:2.0, dias_mercado:52,  comp_int_pct:30, demanda:8.0, liquidez:7.5, risco:3.6, construcao_novo_m2:1700, region:'Lisboa' },
  // ── CASCAIS / OEIRAS ──────────────────────────────────────────────────────────
  'Oeiras':                        { pm2_trans:4000,  pm2_ask:4300,  var_yoy:20.0, var_qtq:4.8, renda_m2:14.0, yield_bruto:4.2, yield_al:5.5, abs_meses:2.0, dias_mercado:60,  comp_int_pct:32, demanda:8.0, liquidez:8.0, risco:3.3, construcao_novo_m2:1600, region:'AML' },
  'Cascais':                        { pm2_trans:4700,  pm2_ask:5100,  var_yoy:18.0, var_qtq:4.3, renda_m2:16.0, yield_bruto:4.1, yield_al:6.5, abs_meses:2.5, dias_mercado:90,  comp_int_pct:42, demanda:8.0, liquidez:8.0, risco:3.4, construcao_novo_m2:1700, region:'Cascais/Sintra' },
  'Cascais — Centro':               { pm2_trans:5400,  pm2_ask:5800,  var_yoy:17.0, var_qtq:4.0, renda_m2:18.0, yield_bruto:4.0, yield_al:7.0, abs_meses:2.2, dias_mercado:75,  comp_int_pct:45, demanda:8.5, liquidez:8.0, risco:3.3, construcao_novo_m2:1800, region:'Cascais/Sintra' },
  'Cascais — Quinta da Marinha':    { pm2_trans:6900,  pm2_ask:7400,  var_yoy:18.0, var_qtq:4.3, renda_m2:22.0, yield_bruto:3.8, yield_al:7.5, abs_meses:3.5, dias_mercado:120, comp_int_pct:62, demanda:7.5, liquidez:7.5, risco:3.5, construcao_novo_m2:2000, region:'Cascais/Sintra' },
  'Estoril':                        { pm2_trans:5000,  pm2_ask:5400,  var_yoy:17.0, var_qtq:4.0, renda_m2:16.5, yield_bruto:3.9, yield_al:6.8, abs_meses:2.5, dias_mercado:90,  comp_int_pct:48, demanda:7.5, liquidez:7.5, risco:3.4, construcao_novo_m2:1700, region:'Cascais/Sintra' },
  'Sintra':                         { pm2_trans:3400,  pm2_ask:3700,  var_yoy:15.0, var_qtq:3.5, renda_m2:12.0, yield_bruto:4.2, yield_al:5.5, abs_meses:3.0, dias_mercado:120, comp_int_pct:18, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1500, region:'Cascais/Sintra' },
  'Ericeira':                       { pm2_trans:3700,  pm2_ask:4000,  var_yoy:21.0, var_qtq:5.2, renda_m2:13.0, yield_bruto:4.2, yield_al:7.5, abs_meses:2.5, dias_mercado:100, comp_int_pct:28, demanda:7.5, liquidez:7.0, risco:3.8, construcao_novo_m2:1500, region:'Cascais/Sintra' },
  'Almada/Caparica':                { pm2_trans:3000,  pm2_ask:3200,  var_yoy:19.0, var_qtq:4.5, renda_m2:11.0, yield_bruto:4.4, yield_al:6.0, abs_meses:2.0, dias_mercado:80,  comp_int_pct:12, demanda:7.5, liquidez:7.5, risco:3.8, construcao_novo_m2:1400, region:'AML' },
  'Amadora/Queluz':                 { pm2_trans:2750,  pm2_ask:2950,  var_yoy:19.0, var_qtq:4.7, renda_m2:11.0, yield_bruto:4.8, yield_al:4.0, abs_meses:1.8, dias_mercado:75,  comp_int_pct:8,  demanda:7.5, liquidez:7.5, risco:4.2, construcao_novo_m2:1300, region:'AML' },
  // ── PORTO ─────────────────────────────────────────────────────────────────────
  'Porto':                          { pm2_trans:3600,  pm2_ask:3900,  var_yoy:19.0, var_qtq:4.7, renda_m2:13.0, yield_bruto:4.3, yield_al:7.2, abs_meses:1.8, dias_mercado:55,  comp_int_pct:28, demanda:8.5, liquidez:8.0, risco:3.5, construcao_novo_m2:1500, region:'Porto' },
  'Porto — Foz/Nevogilde':          { pm2_trans:5400,  pm2_ask:5800,  var_yoy:20.0, var_qtq:4.9, renda_m2:18.0, yield_bruto:4.0, yield_al:7.5, abs_meses:2.2, dias_mercado:65,  comp_int_pct:38, demanda:8.5, liquidez:8.0, risco:3.3, construcao_novo_m2:1800, region:'Porto' },
  'Porto — Boavista':               { pm2_trans:4400,  pm2_ask:4700,  var_yoy:18.0, var_qtq:4.3, renda_m2:15.0, yield_bruto:4.1, yield_al:7.0, abs_meses:2.0, dias_mercado:60,  comp_int_pct:30, demanda:8.0, liquidez:8.0, risco:3.5, construcao_novo_m2:1600, region:'Porto' },
  'Porto — Bonfim/Campanhã':        { pm2_trans:3700,  pm2_ask:4000,  var_yoy:22.0, var_qtq:5.4, renda_m2:13.5, yield_bruto:4.3, yield_al:7.8, abs_meses:1.8, dias_mercado:55,  comp_int_pct:22, demanda:8.5, liquidez:8.0, risco:3.7, construcao_novo_m2:1400, region:'Porto' },
  'Porto — Cedofeita':              { pm2_trans:3500,  pm2_ask:3800,  var_yoy:21.0, var_qtq:5.1, renda_m2:13.0, yield_bruto:4.4, yield_al:8.0, abs_meses:1.8, dias_mercado:55,  comp_int_pct:25, demanda:8.0, liquidez:8.0, risco:3.6, construcao_novo_m2:1400, region:'Porto' },
  'Porto — Ribeira/Miragaia':       { pm2_trans:4100,  pm2_ask:4400,  var_yoy:19.0, var_qtq:4.6, renda_m2:14.5, yield_bruto:4.2, yield_al:9.0, abs_meses:2.0, dias_mercado:70,  comp_int_pct:35, demanda:8.0, liquidez:7.5, risco:3.5, construcao_novo_m2:1500, region:'Porto' },
  'Matosinhos':                     { pm2_trans:3100,  pm2_ask:3400,  var_yoy:19.0, var_qtq:4.6, renda_m2:11.5, yield_bruto:4.4, yield_al:7.0, abs_meses:2.0, dias_mercado:60,  comp_int_pct:18, demanda:7.5, liquidez:7.5, risco:3.7, construcao_novo_m2:1400, region:'Porto' },
  'Matosinhos — Mar':               { pm2_trans:3800,  pm2_ask:4100,  var_yoy:21.0, var_qtq:5.2, renda_m2:14.0, yield_bruto:4.4, yield_al:8.5, abs_meses:1.8, dias_mercado:55,  comp_int_pct:25, demanda:8.0, liquidez:8.0, risco:3.5, construcao_novo_m2:1500, region:'Porto' },
  'Vila Nova de Gaia':              { pm2_trans:2800,  pm2_ask:3000,  var_yoy:18.0, var_qtq:4.3, renda_m2:10.0, yield_bruto:4.3, yield_al:6.5, abs_meses:2.2, dias_mercado:65,  comp_int_pct:15, demanda:7.5, liquidez:7.5, risco:3.8, construcao_novo_m2:1300, region:'Porto' },
  // ── ALGARVE ───────────────────────────────────────────────────────────────────
  'Algarve':                        { pm2_trans:3900,  pm2_ask:4200,  var_yoy:19.0, var_qtq:4.7, renda_m2:14.0, yield_bruto:4.3, yield_al:8.5, abs_meses:3.5, dias_mercado:150, comp_int_pct:58, demanda:7.5, liquidez:7.0, risco:3.8, construcao_novo_m2:1500, region:'Algarve' },
  'Quinta do Lago':                 { pm2_trans:12000, pm2_ask:13500, var_yoy:15.0, var_qtq:3.7, renda_m2:42.0, yield_bruto:4.2, yield_al:9.0, abs_meses:5.5, dias_mercado:300, comp_int_pct:78, demanda:7.0, liquidez:6.0, risco:3.5, construcao_novo_m2:3000, region:'Algarve' },
  'Vale do Lobo':                   { pm2_trans:10000, pm2_ask:11200, var_yoy:15.0, var_qtq:3.7, renda_m2:35.0, yield_bruto:4.2, yield_al:9.0, abs_meses:5.0, dias_mercado:280, comp_int_pct:75, demanda:7.0, liquidez:6.0, risco:3.5, construcao_novo_m2:2800, region:'Algarve' },
  'Vilamoura':                      { pm2_trans:5000,  pm2_ask:5400,  var_yoy:18.0, var_qtq:4.3, renda_m2:17.5, yield_bruto:4.2, yield_al:8.8, abs_meses:4.0, dias_mercado:180, comp_int_pct:62, demanda:7.5, liquidez:7.0, risco:3.6, construcao_novo_m2:1700, region:'Algarve' },
  'Loulé/Almancil':                 { pm2_trans:5500,  pm2_ask:5900,  var_yoy:18.0, var_qtq:4.3, renda_m2:18.5, yield_bruto:4.0, yield_al:8.5, abs_meses:3.8, dias_mercado:150, comp_int_pct:65, demanda:7.5, liquidez:7.0, risco:3.6, construcao_novo_m2:1800, region:'Algarve' },
  'Lagos':                          { pm2_trans:4400,  pm2_ask:4800,  var_yoy:19.0, var_qtq:4.7, renda_m2:15.5, yield_bruto:4.2, yield_al:8.5, abs_meses:3.5, dias_mercado:150, comp_int_pct:55, demanda:7.5, liquidez:7.0, risco:3.7, construcao_novo_m2:1600, region:'Algarve' },
  'Portimão':                       { pm2_trans:3100,  pm2_ask:3400,  var_yoy:18.0, var_qtq:4.3, renda_m2:11.0, yield_bruto:4.3, yield_al:7.5, abs_meses:3.0, dias_mercado:130, comp_int_pct:40, demanda:7.0, liquidez:7.0, risco:4.0, construcao_novo_m2:1400, region:'Algarve' },
  'Albufeira':                      { pm2_trans:3700,  pm2_ask:4000,  var_yoy:19.0, var_qtq:4.7, renda_m2:13.5, yield_bruto:4.4, yield_al:9.0, abs_meses:3.5, dias_mercado:140, comp_int_pct:48, demanda:7.5, liquidez:7.0, risco:3.8, construcao_novo_m2:1500, region:'Algarve' },
  'Tavira':                         { pm2_trans:3000,  pm2_ask:3200,  var_yoy:18.0, var_qtq:4.3, renda_m2:10.5, yield_bruto:4.2, yield_al:7.5, abs_meses:3.8, dias_mercado:160, comp_int_pct:42, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1400, region:'Algarve' },
  'Faro':                           { pm2_trans:2700,  pm2_ask:2900,  var_yoy:17.0, var_qtq:4.0, renda_m2:10.0, yield_bruto:4.4, yield_al:7.0, abs_meses:3.0, dias_mercado:120, comp_int_pct:28, demanda:7.0, liquidez:7.0, risco:4.0, construcao_novo_m2:1400, region:'Algarve' },
  'Olhão':                          { pm2_trans:2500,  pm2_ask:2700,  var_yoy:20.0, var_qtq:4.9, renda_m2:9.5,  yield_bruto:4.6, yield_al:8.0, abs_meses:3.0, dias_mercado:130, comp_int_pct:25, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1300, region:'Algarve' },
  'Sagres/Vila do Bispo':           { pm2_trans:3500,  pm2_ask:3800,  var_yoy:20.0, var_qtq:4.9, renda_m2:12.5, yield_bruto:4.3, yield_al:9.0, abs_meses:4.0, dias_mercado:200, comp_int_pct:45, demanda:7.0, liquidez:6.0, risco:4.2, construcao_novo_m2:1400, region:'Algarve' },
  'Aljezur/Sudoeste':               { pm2_trans:3200,  pm2_ask:3500,  var_yoy:20.0, var_qtq:4.9, renda_m2:11.5, yield_bruto:4.3, yield_al:8.5, abs_meses:4.0, dias_mercado:200, comp_int_pct:40, demanda:7.0, liquidez:6.0, risco:4.2, construcao_novo_m2:1400, region:'Algarve' },
  // ── COMPORTA / ALENTEJO LITORAL ───────────────────────────────────────────────
  'Comporta':                       { pm2_trans:8500,  pm2_ask:9500,  var_yoy:12.0, var_qtq:2.9, renda_m2:29.0, yield_bruto:4.1, yield_al:9.5, abs_meses:5.5, dias_mercado:300, comp_int_pct:72, demanda:7.0, liquidez:6.0, risco:4.0, construcao_novo_m2:2200, region:'Alentejo Litoral' },
  'Melides':                        { pm2_trans:6000,  pm2_ask:6700,  var_yoy:14.0, var_qtq:3.4, renda_m2:20.0, yield_bruto:4.0, yield_al:8.5, abs_meses:5.0, dias_mercado:280, comp_int_pct:58, demanda:6.5, liquidez:5.5, risco:4.2, construcao_novo_m2:1800, region:'Alentejo Litoral' },
  'Grândola':                       { pm2_trans:2800,  pm2_ask:3100,  var_yoy:18.0, var_qtq:4.3, renda_m2:10.5, yield_bruto:4.5, yield_al:7.0, abs_meses:4.0, dias_mercado:160, comp_int_pct:22, demanda:6.5, liquidez:6.0, risco:4.5, construcao_novo_m2:1300, region:'Alentejo Litoral' },
  'Évora':                          { pm2_trans:2400,  pm2_ask:2600,  var_yoy:16.0, var_qtq:3.8, renda_m2:9.0,  yield_bruto:4.5, yield_al:6.5, abs_meses:3.5, dias_mercado:150, comp_int_pct:15, demanda:6.5, liquidez:6.0, risco:4.5, construcao_novo_m2:1300, region:'Alentejo' },
  // ── MADEIRA ───────────────────────────────────────────────────────────────────
  'Madeira':                        { pm2_trans:3750,  pm2_ask:4100,  var_yoy:18.0, var_qtq:4.3, renda_m2:13.5, yield_bruto:4.3, yield_al:8.5, abs_meses:2.8, dias_mercado:120, comp_int_pct:45, demanda:7.5, liquidez:7.0, risco:3.8, construcao_novo_m2:1600, region:'Madeira' },
  'Madeira — Funchal':              { pm2_trans:4200,  pm2_ask:4600,  var_yoy:19.0, var_qtq:4.7, renda_m2:15.0, yield_bruto:4.3, yield_al:9.0, abs_meses:2.5, dias_mercado:100, comp_int_pct:48, demanda:7.5, liquidez:7.5, risco:3.7, construcao_novo_m2:1700, region:'Madeira' },
  'Madeira — Funchal Centro':       { pm2_trans:4700,  pm2_ask:5100,  var_yoy:20.0, var_qtq:4.9, renda_m2:17.0, yield_bruto:4.3, yield_al:9.5, abs_meses:2.2, dias_mercado:90,  comp_int_pct:52, demanda:8.0, liquidez:7.5, risco:3.6, construcao_novo_m2:1800, region:'Madeira' },
  'Madeira — Câmara de Lobos':      { pm2_trans:3400,  pm2_ask:3700,  var_yoy:17.0, var_qtq:4.0, renda_m2:12.0, yield_bruto:4.2, yield_al:8.0, abs_meses:3.0, dias_mercado:130, comp_int_pct:35, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1500, region:'Madeira' },
  'Madeira — Calheta':              { pm2_trans:4400,  pm2_ask:4800,  var_yoy:19.0, var_qtq:4.7, renda_m2:15.5, yield_bruto:4.2, yield_al:9.0, abs_meses:3.2, dias_mercado:150, comp_int_pct:42, demanda:7.0, liquidez:6.0, risco:4.0, construcao_novo_m2:1700, region:'Madeira' },
  'Madeira — Santa Cruz':           { pm2_trans:3200,  pm2_ask:3500,  var_yoy:17.0, var_qtq:4.0, renda_m2:11.5, yield_bruto:4.3, yield_al:7.5, abs_meses:3.0, dias_mercado:140, comp_int_pct:30, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1500, region:'Madeira' },
  'Porto Santo':                    { pm2_trans:2600,  pm2_ask:2900,  var_yoy:15.0, var_qtq:3.6, renda_m2:10.0, yield_bruto:4.6, yield_al:8.5, abs_meses:4.0, dias_mercado:180, comp_int_pct:28, demanda:6.5, liquidez:5.5, risco:4.5, construcao_novo_m2:1400, region:'Madeira' },
  // ── AÇORES ────────────────────────────────────────────────────────────────────
  'Açores':                         { pm2_trans:1800,  pm2_ask:2000,  var_yoy:13.0, var_qtq:3.1, renda_m2:7.5,  yield_bruto:5.0, yield_al:7.0, abs_meses:3.5, dias_mercado:170, comp_int_pct:15, demanda:6.0, liquidez:5.5, risco:5.0, construcao_novo_m2:1300, region:'Açores' },
  'Açores — Ponta Delgada':         { pm2_trans:2000,  pm2_ask:2200,  var_yoy:14.0, var_qtq:3.4, renda_m2:8.5,  yield_bruto:5.1, yield_al:7.5, abs_meses:3.0, dias_mercado:150, comp_int_pct:18, demanda:6.5, liquidez:6.0, risco:4.8, construcao_novo_m2:1300, region:'Açores' },
  'Açores — Angra do Heroísmo':     { pm2_trans:1550,  pm2_ask:1700,  var_yoy:12.0, var_qtq:2.9, renda_m2:6.5,  yield_bruto:5.0, yield_al:6.5, abs_meses:4.0, dias_mercado:200, comp_int_pct:12, demanda:5.5, liquidez:5.0, risco:5.2, construcao_novo_m2:1200, region:'Açores' },
  // ── OUTRAS ────────────────────────────────────────────────────────────────────
  'Braga':                          { pm2_trans:2700,  pm2_ask:2950,  var_yoy:20.0, var_qtq:4.9, renda_m2:10.0, yield_bruto:4.4, yield_al:6.5, abs_meses:2.2, dias_mercado:75,  comp_int_pct:12, demanda:7.5, liquidez:7.0, risco:4.0, construcao_novo_m2:1400, region:'Minho' },
  'Coimbra':                        { pm2_trans:2300,  pm2_ask:2500,  var_yoy:17.0, var_qtq:4.0, renda_m2:9.0,  yield_bruto:4.7, yield_al:6.0, abs_meses:2.5, dias_mercado:100, comp_int_pct:10, demanda:7.0, liquidez:6.5, risco:4.2, construcao_novo_m2:1300, region:'Centro' },
  'Aveiro':                         { pm2_trans:2500,  pm2_ask:2700,  var_yoy:18.0, var_qtq:4.3, renda_m2:9.5,  yield_bruto:4.6, yield_al:6.5, abs_meses:2.5, dias_mercado:90,  comp_int_pct:12, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1300, region:'Centro' },
  'Viseu':                          { pm2_trans:1650,  pm2_ask:1800,  var_yoy:14.0, var_qtq:3.4, renda_m2:7.0,  yield_bruto:5.1, yield_al:5.5, abs_meses:3.5, dias_mercado:160, comp_int_pct:5,  demanda:6.0, liquidez:5.5, risco:4.5, construcao_novo_m2:1200, region:'Centro' },
  'Setúbal':                        { pm2_trans:2100,  pm2_ask:2300,  var_yoy:17.0, var_qtq:4.0, renda_m2:8.5,  yield_bruto:4.9, yield_al:5.5, abs_meses:2.8, dias_mercado:120, comp_int_pct:8,  demanda:6.5, liquidez:6.5, risco:4.3, construcao_novo_m2:1300, region:'Setúbal' },
}

// ─── Zone detection ────────────────────────────────────────────────────────────
function detectZona(texto: string): string {
  const t = texto.toLowerCase()
  const mapa: [RegExp, string][] = [
    [/chiado|santos(?! tirso)|bairro alto|príncipe real|príncipe\s*real|principe real|campo de ourique|estrela\b|lapa\b/, 'Lisboa — Chiado/Santos'],
    [/príncipe real|principe real/, 'Lisboa — Príncipe Real'],
    [/bairro alto/, 'Lisboa — Bairro Alto'],
    [/estrela|lapa/, 'Lisboa — Estrela/Lapa'],
    [/santos\b(?!.*tirso)/, 'Lisboa — Santos'],
    [/parque das nações|nações|oriente\b|expo\b/, 'Lisboa — Parque das Nações'],
    [/marvila|beato|chelas/, 'Lisboa — Beato/Marvila'],
    [/mouraria|intendente|martim moniz/, 'Lisboa — Intendente'],
    [/alfama/, 'Lisboa — Alfama/Mouraria'],
    [/alcântara|alcantara/, 'Lisboa — Alcântara'],
    [/belém|belem|restelo|ajuda/, 'Lisboa — Belém/Restelo'],
    [/campo de ourique/, 'Lisboa — Campo de Ourique'],
    [/avenidas novas|marquês|marques de pombal/, 'Lisboa — Avenidas Novas'],
    [/alvalade|roma\b|areeiro|entrecampos/, 'Lisboa — Alvalade'],
    [/quinta da marinha|quinta\s*marinha/, 'Cascais — Quinta da Marinha'],
    [/estoril/, 'Estoril'],
    [/cascais|birre|alapraia|guincho|malveira da serra/, 'Cascais'],
    [/algés|linda.a.velha|carcavelos|paço de arcos|porto salvo|oeiras/, 'Oeiras'],
    [/comporta|carvalhal\b/, 'Comporta'],
    [/melides/, 'Melides'],
    [/grândola|grandola/, 'Grândola'],
    [/foz do douro|nevogilde/, 'Porto — Foz/Nevogilde'],
    [/boavista/, 'Porto — Boavista'],
    [/bonfim|campanhã|campanha|paranhos|ramalde/, 'Porto — Bonfim/Campanhã'],
    [/cedofeita/, 'Porto — Cedofeita'],
    [/ribeira|miragaia/, 'Porto — Ribeira/Miragaia'],
    [/matosinhos sul|matosinhos\s*-?\s*mar/, 'Matosinhos — Mar'],
    [/matosinhos/, 'Matosinhos'],
    [/gaia|vila nova de gaia/, 'Vila Nova de Gaia'],
    [/porto/, 'Porto'],
    [/quinta do lago/, 'Quinta do Lago'],
    [/vale do lobo/, 'Vale do Lobo'],
    [/vilamoura|quarteira/, 'Vilamoura'],
    [/loulé|loule|almancil/, 'Loulé/Almancil'],
    [/sagres|vila do bispo/, 'Sagres/Vila do Bispo'],
    [/aljezur/, 'Aljezur/Sudoeste'],
    [/albufeira/, 'Albufeira'],
    [/tavira/, 'Tavira'],
    [/portimão|portimao/, 'Portimão'],
    [/olhão|olhao/, 'Olhão'],
    [/lagos\b/, 'Lagos'],
    [/faro/, 'Faro'],
    [/algarve/, 'Algarve'],
    [/funchal centro|funchal\s*-\s*centro/, 'Madeira — Funchal Centro'],
    [/câmara de lobos|camara de lobos/, 'Madeira — Câmara de Lobos'],
    [/calheta/, 'Madeira — Calheta'],
    [/santa cruz.*madeira|madeira.*santa cruz/, 'Madeira — Santa Cruz'],
    [/porto santo/, 'Porto Santo'],
    [/funchal|madeira/, 'Madeira — Funchal'],
    [/ponta delgada/, 'Açores — Ponta Delgada'],
    [/angra do heroísmo|heroismo|terceira/, 'Açores — Angra do Heroísmo'],
    [/açores|acores|azores|horta|faial|são miguel|s\.?\s*miguel/, 'Açores — Ponta Delgada'],
    [/ericeira/, 'Ericeira'],
    [/sintra|colares|azenhas/, 'Sintra'],
    [/almada|caparica|costa da caparica/, 'Almada/Caparica'],
    [/amadora|queluz|damaia/, 'Amadora/Queluz'],
    [/setúbal|setubal/, 'Setúbal'],
    [/évora|evora/, 'Évora'],
    [/coimbra/, 'Coimbra'],
    [/aveiro/, 'Aveiro'],
    [/braga/, 'Braga'],
    [/viseu/, 'Viseu'],
    [/lisbo|amoreiras|benfica|lumiar|odivelas|loures/, 'Lisboa'],
  ]
  for (const [rx, zona] of mapa) if (rx.test(t)) return zona
  return 'Lisboa'
}

function getZone(zona: string): ZoneMarket {
  return ZONES[zona] ?? { pm2_trans:2500, pm2_ask:2700, var_yoy:15.0, var_qtq:3.6, renda_m2:9.0, yield_bruto:4.5, yield_al:6.0, abs_meses:3.0, dias_mercado:150, comp_int_pct:12, demanda:6.0, liquidez:6.0, risco:5.0, construcao_novo_m2:1400, region:'Portugal' }
}

// ─── IMT 2026 ─────────────────────────────────────────────────────────────────
function calcIMT(p: number, habitPropria = true): number {
  if (habitPropria) {
    if (p <= 97064)   return 0
    if (p <= 132774)  return p * 0.02  - 1941.28
    if (p <= 182349)  return p * 0.05  - 5924.50
    if (p <= 316772)  return p * 0.07  - 9561.46
    if (p <= 633453)  return p * 0.08  - 16729.20
    if (p <= 1050400) return p * 0.06
    return p * 0.075
  } else {
    if (p <= 97064)   return p * 0.01
    if (p <= 132774)  return p * 0.02  - 971.64
    if (p <= 182349)  return p * 0.05  - 4953.87
    if (p <= 316772)  return p * 0.07  - 8599.91
    if (p <= 633453)  return p * 0.08  - 16768.08
    if (p <= 1050400) return p * 0.06
    return p * 0.075
  }
}

function calcPMT(principal: number, annualRate: number, months: number): number {
  if (annualRate <= 0) return principal / months
  const r = annualRate / 12
  return principal * (r * Math.pow(1+r, months)) / (Math.pow(1+r, months) - 1)
}

// ─── Live rates ────────────────────────────────────────────────────────────────
async function fetchLiveRates(): Promise<{ euribor_6m: number; euribor_12m: number }> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.agencygroup.pt'
    const res = await fetch(`${base}/api/rates`, { signal: AbortSignal.timeout(4000), next: { revalidate: 14400 } })
    if (!res.ok) throw new Error('rates failed')
    const d = await res.json()
    return { euribor_6m: d.euribor_6m ?? 0.0295, euribor_12m: d.euribor_12m ?? 0.0278 }
  } catch {
    return { euribor_6m: 0.0295, euribor_12m: 0.0278 }
  }
}

// ─── Platform detection ────────────────────────────────────────────────────────
type Platform =
  | 'idealista' | 'imovirtual' | 'era' | 'remax' | 'kw' | 'sothebys' | 'supercasa'
  // Leilões
  | 'eleiloes' | 'leiloestax' | 'leiloesverde' | 'vende'
  // Banca
  | 'bpi' | 'millenniumbcp' | 'cgd' | 'novobanco' | 'santander' | 'montepio' | 'credagricola' | 'bankinter'
  // Judicial
  | 'citius'
  // Fallback
  | 'texto' | 'other'

function detectPlatform(url: string): Platform {
  const u = url.toLowerCase()
  // Portais imobiliários
  if (u.includes('idealista'))  return 'idealista'
  if (u.includes('imovirtual')) return 'imovirtual'
  if (u.includes('supercasa'))  return 'supercasa'
  if (u.includes('era.pt') || u.includes('era-portugal')) return 'era'
  if (u.includes('remax'))      return 'remax'
  if (u.includes('kw.pt') || u.includes('kwportugal')) return 'kw'
  if (u.includes('sotheby'))    return 'sothebys'
  // Leilões
  if (u.includes('e-leiloes') || u.includes('eleiloes')) return 'eleiloes'
  if (u.includes('leiloestax') || u.includes('taxleiloes')) return 'leiloestax'
  if (u.includes('leiloesverde') || u.includes('leilões-verde')) return 'leiloesverde'
  if (u.includes('vende.pt'))   return 'vende'
  // Banca
  if (u.includes('imobiliario.bpi') || u.includes('bpi.pt')) return 'bpi'
  if (u.includes('millenniumbcp') || u.includes('millenniumbcp.pt') || u.includes('imoveis.millennium')) return 'millenniumbcp'
  if (u.includes('cgd.pt') || u.includes('caixagestao') || u.includes('imoveiscgd')) return 'cgd'
  if (u.includes('novobanco') || u.includes('novo-banco')) return 'novobanco'
  if (u.includes('santander.pt') || u.includes('imobiliario.santander')) return 'santander'
  if (u.includes('montepio') || u.includes('imoveis.montepio')) return 'montepio'
  if (u.includes('credagricola') || u.includes('caixa-agricola') || u.includes('creditoagricola')) return 'credagricola'
  if (u.includes('bankinter.pt')) return 'bankinter'
  // Judicial
  if (u.includes('citius') || u.includes('tribunaisnet')) return 'citius'
  if (!u.startsWith('http')) return 'texto'
  return 'other'
}

function isAuctionPlatform(p: Platform): boolean {
  return ['eleiloes', 'leiloestax', 'leiloesverde', 'vende', 'citius'].includes(p)
}

function isBankPlatform(p: Platform): boolean {
  return ['bpi', 'millenniumbcp', 'cgd', 'novobanco', 'santander', 'montepio', 'credagricola', 'bankinter'].includes(p)
}

function getBankName(p: Platform): string {
  const names: Partial<Record<Platform, string>> = {
    bpi: 'BPI', millenniumbcp: 'Millennium BCP', cgd: 'Caixa Geral de Depósitos',
    novobanco: 'Novo Banco', santander: 'Santander Portugal', montepio: 'Montepio',
    credagricola: 'Crédito Agrícola', bankinter: 'Bankinter Portugal',
  }
  return names[p] || 'Banco'
}

// ─── HTML scraping helpers ─────────────────────────────────────────────────────

const SCRAPE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en-GB;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Referer': 'https://www.google.pt/',
}

function extractPrice(html: string): number {
  // Various price patterns in PT
  const patterns = [
    /Valor\s*base[^\d€]*(?:€\s*)?([\d\s.,]+)\s*€?/i,
    /Licita[çc][aã]o\s*m[ií]nima[^\d€]*(?:€\s*)?([\d\s.,]+)\s*€?/i,
    /"price"\s*:\s*([\d]+)/i,
    /data-price="([\d]+)"/i,
    /<span[^>]*class="[^"]*price[^"]*"[^>]*>\s*€?\s*([\d.,\s]+)/i,
    /<strong[^>]*>\s*€\s*([\d.,\s]+)/i,
    /€\s*([\d]{3}[\s.,][\d]{3}(?:[\s.,][\d]{3})?)/,
    /([\d]{3}[\s.,][\d]{3}(?:[\s.,][\d]{3})?)\s*€/,
  ]
  for (const rx of patterns) {
    const m = html.match(rx)
    if (m?.[1]) {
      const clean = m[1].replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')
      const v = parseFloat(clean)
      if (v >= 5000 && v <= 50_000_000) return Math.round(v)
    }
  }
  return 0
}

function extractArea(html: string): number {
  const patterns = [
    /[Á]rea(?:\s*[Uu]til|\s*[Hh]ab[^.]*)?[^\d]*([\d.,]+)\s*m[²2]/i,
    /"area"\s*:\s*([\d.]+)/i,
    /data-area="([\d.]+)"/i,
    /([\d.,]+)\s*m[²2]/,
  ]
  for (const rx of patterns) {
    const m = html.match(rx)
    if (m?.[1]) {
      const v = parseFloat(m[1].replace(',', '.'))
      if (v >= 15 && v <= 10000) return Math.round(v)
    }
  }
  return 0
}

function extractText(html: string, maxLen = 1500): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim()
    .substring(0, maxLen)
}

// ─── e-Leilões scraper (OSAE — leilões judiciais e voluntários) ───────────────
async function scrapeEleiloes(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { headers: SCRAPE_HEADERS, signal: AbortSignal.timeout(12000) })
    if (!res.ok) return null
    const html = await res.text()
    const txt = extractText(html, 3000)

    // e-leiloes specific patterns
    const baseMatch = html.match(/[Vv]alor\s*[Bb]ase[^\d€]*(?:€\s*)?([\d\s.,]+)/i)
      || html.match(/Base\s*da\s*[Ll]icitação[^\d€]*(?:€\s*)?([\d\s.,]+)/i)
    const minBidMatch = html.match(/[Ll]icitação\s*[Mm]ínima[^\d€]*(?:€\s*)?([\d\s.,]+)/i)
      || html.match(/[Ll]iciação\s*mínima[^\d€]*(?:€\s*)?([\d\s.,]+)/i)
    const lotMatch = html.match(/[Ll]ote\s*(?:n[.º°]?\s*)?([\d\w-]+)/i)
    const processMatch = html.match(/[Pp]rocesso[^\w]*([\w\d\/.-]+(?:\/\d+)?)/i)
    const endDateMatch = html.match(/[Ff]im\s*da\s*[Ll]icitação[^:]*:\s*([^\n<]{8,30})/i)
      || html.match(/[Ee]ncerra\s*em[^:]*:\s*([^\n<]{8,30})/i)
      || html.match(/(\d{2}\/\d{2}\/\d{4}\s*\d{2}:\d{2})/i)
    const courtMatch = html.match(/[Tt]ribunal[^\n<:]*:\s*([^\n<,]{5,60})/i)
      || html.match(/([A-Z][a-zÀ-ú]+\s+Tribunal[^\n<]{0,40})/i)
    const titleMatch = html.match(/<h1[^>]*>([^<]{5,120})<\/h1>/i)
      || html.match(/<title>([^<]{5,100})<\/title>/i)

    const parseNum = (s: string | undefined) => {
      if (!s) return 0
      const clean = s.replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')
      return parseFloat(clean) || 0
    }

    const valorBase = parseNum(baseMatch?.[1])
    const licitacaoMin = parseNum(minBidMatch?.[1])
    const preco = valorBase || licitacaoMin || extractPrice(html)

    return {
      price: preco,
      valorBase,
      licitacaoMinima: licitacaoMin,
      area: extractArea(html),
      title: titleMatch?.[1]?.trim() || '',
      description: txt,
      lote: lotMatch?.[1]?.trim() || '',
      processo: processMatch?.[1]?.trim() || '',
      prazoFimLicitacao: endDateMatch?.[1]?.trim() || 'Verificar em e-leiloes.pt',
      tribunal: courtMatch?.[1]?.trim() || '',
      tipoVenda: 'leilao_judicial',
      platform: 'e-Leilões (OSAE)',
    }
  } catch { return null }
}

// ─── Leilões Tax (AT — penhoras fiscais) ──────────────────────────────────────
async function scrapeLeiloesTax(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { headers: SCRAPE_HEADERS, signal: AbortSignal.timeout(12000) })
    if (!res.ok) return null
    const html = await res.text()
    const txt = extractText(html, 2000)
    const preco = extractPrice(html)
    const area = extractArea(html)
    const endDateMatch = html.match(/[Ff]im[^:]*:\s*([^\n<]{8,30})/i)
    const refMatch = html.match(/[Rr]ef[^\w]*([\w\d\/.-]+)/i)
    const titleMatch = html.match(/<h1[^>]*>([^<]{5,120})<\/h1>/i)
    return {
      price: preco, area,
      title: titleMatch?.[1]?.trim() || '',
      description: txt,
      prazoFimLicitacao: endDateMatch?.[1]?.trim() || 'Verificar plataforma',
      referencia: refMatch?.[1]?.trim() || '',
      tipoVenda: 'leilao_fiscal',
      platform: 'Leilões Tax (AT)',
    }
  } catch { return null }
}

// ─── Citius — vendas judiciais (portal oficial DGAJ) ─────────────────────────
async function scrapeCitius(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { headers: SCRAPE_HEADERS, signal: AbortSignal.timeout(12000) })
    if (!res.ok) return null
    const html = await res.text()
    const txt = extractText(html, 2000)
    const preco = extractPrice(html)
    const area = extractArea(html)
    const processMatch = html.match(/[Pp]rocesso[^\w]*([\d\w\/.-]+)/i)
    const courtMatch = html.match(/[Tt]ribunal[^\n<:]*:\s*([^\n<,]{5,60})/i)
    const dateMatch = html.match(/(\d{2}\/\d{2}\/\d{4})/i)
    const titleMatch = html.match(/<h1[^>]*>([^<]{5,120})<\/h1>/i)
    return {
      price: preco, area,
      title: titleMatch?.[1]?.trim() || '',
      description: txt,
      processo: processMatch?.[1]?.trim() || '',
      tribunal: courtMatch?.[1]?.trim() || '',
      dataVenda: dateMatch?.[1]?.trim() || '',
      tipoVenda: 'venda_judicial',
      platform: 'Citius (Portal Judicial)',
    }
  } catch { return null }
}

// ─── Bank portals (generic HTML fetch) ────────────────────────────────────────
async function scrapeBankPortal(url: string, bank: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { ...SCRAPE_HEADERS, 'Referer': `https://www.${bank.toLowerCase().replace(/\s+/g, '')}.pt/` },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const txt = extractText(html, 2000)
    const preco = extractPrice(html)
    const area = extractArea(html)
    const titleMatch = html.match(/<h1[^>]*>([^<]{5,120})<\/h1>/i)
      || html.match(/<title>([^|<-]{5,80})<\/title>/i)
    const refMatch = html.match(/[Rr]ef[^\w]*([\w\d-]+)/i)
    const vppMatch = html.match(/VPP[^\d€]*([\d.,\s]+)/i) || html.match(/[Vv]alor\s*[Pp]atrimonial[^\d€]*([\d.,\s]+)/i)
    const parseNum = (s: string | undefined) => {
      if (!s) return 0
      return parseFloat(s.replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0
    }
    return {
      price: preco, area,
      title: titleMatch?.[1]?.trim() || '',
      description: txt,
      banco: bank,
      referencia: refMatch?.[1]?.trim() || '',
      vpp: parseNum(vppMatch?.[1]),
      tipoVenda: 'imovel_banca',
      platform: bank,
    }
  } catch { return null }
}

// ─── Idealista / Imovirtual — scrapers de terceiros removidos ────────────────
// dz-omar~idealista-scraper e epctex~imovirtual-scraper foram removidos por
// violarem os ToS da Idealista e da Imovirtual.
// Substituição: Idealista API Oficial (developers.idealista.com) — pendente credenciais AMI 22506

// ─── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRate(ip)) return NextResponse.json({ error: 'Rate limit: 30 pedidos/hora.' }, { status: 429 })

    const rawBody = await req.json()
    const parsedBody = RadarSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsedBody.error.flatten() }, { status: 400 })
    }
    const urlStr = parsedBody.data.url.trim()

    const cacheKey = hashKey(urlStr)
    const cached = responseCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json({ ...cached.data as object, cached: true })

    const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY

    const platform = detectPlatform(urlStr)
    const isAuction = isAuctionPlatform(platform)
    const isBank = isBankPlatform(platform)
    const bankName = isBank ? getBankName(platform) : ''

    // ── Parallel: scrape + live rates ──────────────────────────────────────────
    let raw: Record<string, unknown> | null = null
    let apifyOk = false
    let specialSaleData: Record<string, unknown> | null = null

    const [, liveRates] = await Promise.all([
      (async () => {
        // 1. Idealista / Imovirtual — integração via Idealista API Oficial (pendente credenciais)
        // TODO: substituir por lib/idealista-api.ts quando IDEALISTA_API_KEY configurado
        // 2. e-Leilões (OSAE)
        if (platform === 'eleiloes') {
          specialSaleData = await scrapeEleiloes(urlStr)
          if (specialSaleData) { raw = specialSaleData; apifyOk = true; return }
        }
        // 3. Leilões Tax (AT)
        if (platform === 'leiloestax') {
          specialSaleData = await scrapeLeiloesTax(urlStr)
          if (specialSaleData) { raw = specialSaleData; apifyOk = true; return }
        }
        // 4. Citius — vendas judiciais
        if (platform === 'citius') {
          specialSaleData = await scrapeCitius(urlStr)
          if (specialSaleData) { raw = specialSaleData; apifyOk = true; return }
        }
        // 5. Portais da Banca
        if (isBank) {
          specialSaleData = await scrapeBankPortal(urlStr, bankName)
          if (specialSaleData) { raw = specialSaleData; apifyOk = true; return }
        }
        // 6. Outros portais — fetch HTML genérico
        if (platform !== 'texto') {
          try {
            const res = await fetch(urlStr, { headers: SCRAPE_HEADERS, signal: AbortSignal.timeout(10000) })
            if (res.ok) {
              const html = await res.text()
              const preco = extractPrice(html)
              const area = extractArea(html)
              const desc = extractText(html, 1200)
              if (preco > 0 || area > 0) {
                raw = { price: preco, area, description: desc }
                apifyOk = true
              }
            }
          } catch { /* continue */ }
        }
      })(),
      fetchLiveRates(),
    ])

    // ── Extract core data ──────────────────────────────────────────────────────
    const rawData = raw as Record<string, unknown> | null
    const tipoVenda = String(rawData?.tipoVenda || '')
    const platformLabel = String(rawData?.platform || platform)

    const textoBase = [
      urlStr,
      (rawData?.ubication as Record<string,unknown>)?.title ?? '',
      rawData?.description ?? '',
      rawData?.title ?? '',
      rawData?.address ?? '',
      rawData?.morada ?? '',
    ].join(' ')

    const zona = detectZona(textoBase)
    const zm   = getZone(zona)

    const preco  = Number(rawData?.price ?? (rawData?.priceInfo as Record<string,unknown>)?.amount ?? rawData?.totalPrice ?? 0)
    const area   = Number((rawData?.moreCharacteristics as Record<string,unknown>)?.constructedArea ?? (rawData?.moreCharacteristics as Record<string,unknown>)?.usableArea ?? rawData?.area ?? rawData?.usableArea ?? 0)
    const qts    = Number((rawData?.moreCharacteristics as Record<string,unknown>)?.roomNumber ?? rawData?.rooms ?? rawData?.quartos ?? 0)
    const bths   = Number((rawData?.moreCharacteristics as Record<string,unknown>)?.bathNumber ?? rawData?.bathrooms ?? 0)
    const pm2a   = area > 0 && preco > 0 ? Math.round(preco / area) : 0
    const diffPct = pm2a > 0 && zm.pm2_trans > 0 ? ((pm2a / zm.pm2_trans - 1) * 100).toFixed(1) : 'N/D'

    // Auction specific
    const valorBase = Number(rawData?.valorBase || 0)
    const licitacaoMinima = Number(rawData?.licitacaoMinima || 0)
    const prazoFim = String(rawData?.prazoFimLicitacao || '')
    const processo = String(rawData?.processo || rawData?.referencia || '')
    const tribunal = String(rawData?.tribunal || '')
    const vpp = Number(rawData?.vpp || 0)

    // Discount vs market for auction/bank
    const precoRef = preco || valorBase || licitacaoMinima
    const descontoLeilao = precoRef > 0 && zm.pm2_trans > 0 && area > 0
      ? (((zm.pm2_trans * area) - precoRef) / (zm.pm2_trans * area) * 100).toFixed(1)
      : '—'

    // ── Financial calculations ──────────────────────────────────────────────────
    const imt_hp  = precoRef > 0 ? Math.round(calcIMT(precoRef, true))  : 0
    const imt_inv = precoRef > 0 ? Math.round(calcIMT(precoRef, false)) : 0
    const is      = precoRef > 0 ? Math.round(precoRef * 0.008) : 0
    const legal   = 1500
    const registo = 500
    const bankFee = precoRef > 0 ? Math.round(precoRef * 0.003) : 0
    const total_hp  = precoRef + imt_hp  + is + legal + registo + bankFee
    const total_inv = precoRef + imt_inv + is + legal + registo

    const entrada30 = Math.round(precoRef * 0.30)
    const capital   = Math.round(precoRef * 0.70)
    const tan       = liveRates.euribor_6m + 0.014
    const pmt30     = precoRef > 0 ? Math.round(calcPMT(capital, tan, 360)) : 0

    const rendaEst     = area > 0 ? Math.round(zm.renda_m2 * area) : 0
    const rendaAnual   = rendaEst * 12
    const yieldBruto   = precoRef > 0 && rendaAnual > 0 ? (rendaAnual / precoRef * 100).toFixed(2) : zm.yield_bruto.toFixed(2)
    const custoAnuais  = precoRef > 0 ? Math.round(precoRef * 0.025) : 0
    const rendaLiq     = rendaAnual - custoAnuais
    const yieldLiq     = precoRef > 0 && rendaLiq > 0 ? (rendaLiq / precoRef * 100).toFixed(2) : '0'
    const rendaAL      = area > 0 ? Math.round(zm.renda_m2 * area * 1.8) : 0
    const yieldAL      = precoRef > 0 && rendaAL > 0 ? (rendaAL * 12 / precoRef * 100).toFixed(2) : zm.yield_al.toFixed(2)

    const val5y  = precoRef > 0 ? Math.round(precoRef * Math.pow(1 + zm.var_yoy/100 * 0.6, 5)) : 0
    const val10y = precoRef > 0 ? Math.round(precoRef * Math.pow(1 + zm.var_yoy/100 * 0.5, 10)) : 0
    const roi5y  = precoRef > 0 ? (((val5y + rendaLiq * 5) / precoRef - 1) * 100).toFixed(1) : '0'
    const roi10y = precoRef > 0 ? (((val10y + rendaLiq * 10) / precoRef - 1) * 100).toFixed(1) : '0'

    const morada = String((rawData?.ubication as Record<string,unknown>)?.title ?? rawData?.address ?? rawData?.title ?? '')

    // ── Special sale context for Claude ────────────────────────────────────────
    const contextLeilao = isAuction ? `
═══════════════════════════════════════════════════════
⚠️  ATENÇÃO: VENDA ESPECIAL — ${tipoVenda === 'leilao_judicial' ? 'LEILÃO JUDICIAL (OSAE/Citius)' : tipoVenda === 'leilao_fiscal' ? 'LEILÃO FISCAL (AT)' : 'VENDA JUDICIAL'}
═══════════════════════════════════════════════════════
Plataforma: ${platformLabel}
Valor base leilão: ${valorBase > 0 ? `€${valorBase.toLocaleString('pt-PT')}` : 'N/D'}
Licitação mínima: ${licitacaoMinima > 0 ? `€${licitacaoMinima.toLocaleString('pt-PT')}` : 'N/D'}
Processo: ${processo || 'N/D'}
Tribunal: ${tribunal || 'N/D'}
Prazo fim licitação: ${prazoFim || 'Verificar plataforma'}
Desconto implícito vs valor de mercado: ${descontoLeilao}%

REGRAS OBRIGATÓRIAS ANÁLISE LEILÃO:
- Leilões judiciais tipicamente têm ónus, hipotecas, encargos (art. 824° CC — purgados na arrematação, MAS verificar)
- Possível ocupação (inquilinos protegidos: 12-36 meses para desocupar)
- Vendido "no estado em que se encontra" — sem garantias do vendedor
- Desconto típico leilão judicial PT: 25-40% vs mercado livre
- Desconto típico leilão fiscal AT: 15-30% vs mercado livre
- Custos adicionais: advogado licitação €800-1500, registo arrematação €300
- Financiamento bancário em leilão é possível mas complexo (max 60-70% LTV vs 80-90% normal)
- UPSIDE: podem ser negócios excelentes para investidores com liquidez` : ''

    const contextBanca = isBank ? `
═══════════════════════════════════════════════════════
🏦  ATENÇÃO: IMÓVEL DA BANCA — ${bankName}
═══════════════════════════════════════════════════════
Banco vendedor: ${bankName}
Referência: ${processo || rawData?.referencia || 'N/D'}
VPP (Valor Patrimonial Permanente): ${vpp > 0 ? `€${vpp.toLocaleString('pt-PT')}` : 'N/D'}

REGRAS OBRIGATÓRIAS ANÁLISE BANCA:
- Imóvel adjudicado ao banco (non-performing loan / REO — Real Estate Owned)
- Desconto típico banca Portugal: 10-25% vs mercado livre (mas CGD/Novo Banco têm carteiras grandes → mais flexíveis)
- Banco quer liquidar carteira → margem de negociação real de 5-15% abaixo do preço pedido
- Estado de conservação variável: pode precisar obras 5-20% do valor
- Possível ocupação anterior (validar se livre ou arrendado)
- Vantagem financiamento: alguns bancos oferecem crédito preferencial nas suas propriedades (90-95% LTV, spread favorável)
- Due diligence essencial: certidão permanente, caderneta predial, declaração de encargos` : ''

    // ── Build Claude prompt ────────────────────────────────────────────────────
    const dadosImovel = apifyOk && precoRef > 0 ? `
DADOS DO IMÓVEL (${platformLabel} — extraídos em tempo real: ${new Date().toLocaleString('pt-PT')}):
URL: ${urlStr}
Preço pedido/base: €${precoRef.toLocaleString('pt-PT')}
Área: ${area > 0 ? `${area}m²` : 'N/D'} | Preço/m²: ${pm2a > 0 ? `€${pm2a.toLocaleString('pt-PT')}/m²` : 'N/D'}
Tipologia: ${qts > 0 ? `T${qts} (${qts} quartos, ${bths} WC)` : 'N/D'}
Morada: ${morada || 'N/D'}
Diferencial vs INE zona: ${diffPct}%
Descrição: ${String(rawData?.description ?? '').substring(0, 1000)}
${contextLeilao}${contextBanca}` : `
URL/TEXTO: ${urlStr}
(Tipo de plataforma: ${isAuction ? '🔨 LEILÃO' : isBank ? '🏦 BANCA' : platform})
Zona detectada: ${zona}
${contextLeilao}${contextBanca}`

    const prompt = `És o mais rigoroso analista imobiliário de Portugal — ex-CBRE, JLL, Savills Portugal — especialista em leilões judiciais, imóveis de banca e vendas especiais. Analisas como um investidor que compra com o próprio dinheiro.

${dadosImovel}

═══ DADOS DE MERCADO Q1 2026 — ZONA: ${zona} ═══
Mediana transacção AT Q4 2025:  €${zm.pm2_trans.toLocaleString('pt-PT')}/m²
Preço pedido mediana:           €${zm.pm2_ask.toLocaleString('pt-PT')}/m²
Variação homóloga (YoY):        +${zm.var_yoy}%
Variação trimestral (QoQ):      +${zm.var_qtq}%
Renda mediana novos contratos:  €${zm.renda_m2}/m²/mês
Yield bruto arrendamento:       ${zm.yield_bruto}%
Yield AL (Alojamento Local):    ${zm.yield_al}%
Absorção de mercado:            ${zm.abs_meses} meses
Dias médios em mercado:         ${zm.dias_mercado} dias
Compradores internacionais:     ${zm.comp_int_pct}%
Score de procura:               ${zm.demanda}/10
Score de liquidez:              ${zm.liquidez}/10
Custo nova construção:          €${zm.construcao_novo_m2}/m²

${precoRef > 0 ? `═══ ANÁLISE FINANCEIRA PRÉ-CALCULADA ═══
Diferencial preço/m² vs mediana: ${diffPct}%
Desconto vs mercado (estimativa): ${descontoLeilao}%
IMT habitação própria:          €${imt_hp.toLocaleString('pt-PT')}
IMT investimento:               €${imt_inv.toLocaleString('pt-PT')}
Imposto de Selo (0.8%):         €${is.toLocaleString('pt-PT')}
Custos legais + registo:        €${(legal + registo).toLocaleString('pt-PT')}
TOTAL aquisição (hab. própria): €${Math.round(total_hp).toLocaleString('pt-PT')}
TOTAL aquisição (investimento): €${Math.round(total_inv).toLocaleString('pt-PT')}
Entrada 30%:                    €${entrada30.toLocaleString('pt-PT')}
Capital crédito 70%:            €${capital.toLocaleString('pt-PT')}
Euribor 6M (live BCE):          ${(liveRates.euribor_6m * 100).toFixed(2)}%
TAN estimada (Eur+spread 1.4%): ${(tan * 100).toFixed(2)}%
Prestação crédito 30 anos:      €${pmt30.toLocaleString('pt-PT')}/mês
Renda arrendamento estimada:    €${rendaEst.toLocaleString('pt-PT')}/mês
Renda AL estimada:              €${rendaAL.toLocaleString('pt-PT')}/mês
Yield bruto arrendamento:       ${yieldBruto}%
Yield líquido arrendamento:     ${yieldLiq}%
Yield AL estimado:              ${yieldAL}%
Valor estimado 5 anos:          €${val5y.toLocaleString('pt-PT')}
Valor estimado 10 anos:         €${val10y.toLocaleString('pt-PT')}
ROI total estimado 5 anos:      +${roi5y}%
ROI total estimado 10 anos:     +${roi10y}%` : ''}

INSTRUÇÃO: Analisa com rigor máximo. ${isAuction ? 'É um LEILÃO — avalia desconto real, riscos jurídicos e oportunidade real de negócio.' : isBank ? 'É um IMÓVEL DA BANCA — avalia desconto vs mercado, margem negociação e condição.' : ''} Usa dados de mercado reais. Sê directo com números. Responde EXCLUSIVAMENTE em JSON válido:

{
  "score": <0-100 — rigoroso: 50=mercado justo, 70+=bom, 85+=excelente, 90+=raridade>,
  "classificacao": <"🔥 ATAQUE IMEDIATO"|"⭐ PRIORITÁRIO"|"✅ BOM NEGÓCIO"|"⚖️ VALOR JUSTO"|"⚠️ SOBREVALORIZADO"|"❌ EVITAR">,
  "tipo_venda": <"mercado_livre"|"leilao_judicial"|"leilao_fiscal"|"imovel_banca"|"venda_judicial">,
  "valor_justo": <€ estimativa AVM — arredondado a €500>,
  "preco_pedido": <€ do anúncio/base ou 0>,
  "oferta_recomendada": <€ — arredondado a €500>,
  "desconto_percentagem": <% desconto vs pedido, ex -7.5>,
  "desconto_vs_mercado_pct": <% desconto real do preço vs valor mercado livre>,
  "margem_negociacao_pct": <% gap pedido vs justo>,
  "pm2_anuncio": ${pm2a > 0 ? pm2a : 0},
  "pm2_mercado": ${zm.pm2_trans},
  "diferencial_mercado_pct": <% diferencial pm2 vs mediana>,
  "custo_total_aquisicao_hp": <€>,
  "custo_total_aquisicao_inv": <€>,
  "imt_hp": ${imt_hp},
  "imt_inv": ${imt_inv},
  "imposto_selo": ${is},
  "prestacao_mensal_estimada": ${pmt30},
  "renda_mensal_estimada": ${rendaEst > 0 ? rendaEst : '<calcula>'},
  "renda_al_estimada": ${rendaAL > 0 ? rendaAL : '<calcula>'},
  "yield_bruto": <% float>,
  "yield_liquido": <% float>,
  "yield_al": <% float>,
  "roi_5_anos_pct": ${roi5y !== '0' ? roi5y : '<estima>'},
  "roi_10_anos_pct": ${roi10y !== '0' ? roi10y : '<estima>'},
  "valor_5_anos": ${val5y > 0 ? val5y : '<estima>'},
  "valor_10_anos": ${val10y > 0 ? val10y : '<estima>'},
  "20_dimensoes": {
    "preco_vs_mediana_ine":        {"s":<0-10>,"n":"<max 12 palavras exactas>"},
    "preco_por_m2_zona":           {"s":<0-10>,"n":"<max 12 palavras>"},
    "localizacao_macro_regiao":    {"s":<0-10>,"n":"<max 12 palavras>"},
    "localizacao_micro_rua":       {"s":<0-10>,"n":"<max 12 palavras>"},
    "estado_conservacao_obras":    {"s":<0-10>,"n":"<max 12 palavras>"},
    "tipologia_funcionalidade":    {"s":<0-10>,"n":"<max 12 palavras>"},
    "exposicao_solar_luz":         {"s":<0-10>,"n":"<max 12 palavras>"},
    "transportes_acessibilidade":  {"s":<0-10>,"n":"<max 12 palavras>"},
    "liquidez_velocidade_saida":   {"s":<0-10>,"n":"<max 12 palavras>"},
    "potencial_valorizacao_5a":    {"s":<0-10>,"n":"<max 12 palavras>"},
    "yield_arrendamento_longo":    {"s":<0-10>,"n":"<max 12 palavras>"},
    "yield_al_turistico":          {"s":<0-10>,"n":"<max 12 palavras>"},
    "custo_obras_entrada_estado":  {"s":<0-10>,"n":"<max 12 palavras>"},
    "carga_fiscal_imt_imi":        {"s":<0-10>,"n":"<max 12 palavras>"},
    "procura_internacional":       {"s":<0-10>,"n":"<max 12 palavras>"},
    "risco_juridico_documental":   {"s":<0-10>,"n":"<max 12 palavras>"},
    "oportunidade_negociacao":     {"s":<0-10>,"n":"<max 12 palavras>"},
    "qualidade_construcao":        {"s":<0-10>,"n":"<max 12 palavras>"},
    "condominio_infraestrutura":   {"s":<0-10>,"n":"<max 12 palavras>"},
    "sustentabilidade_mercado":    {"s":<0-10>,"n":"<max 12 palavras>"}
  },
  ${isAuction || isBank ? `"venda_especial": {
    "tipo": <"leilao_judicial"|"leilao_fiscal"|"imovel_banca"|"venda_judicial">,
    "desconto_real_estimado_pct": <% desconto vs mercado livre>,
    "risco_ocupacao": <"livre"|"desconhecido"|"possivelmente_ocupado"|"ocupado">,
    "risco_juridico_nivel": <"baixo"|"medio"|"alto">,
    "onerus_estimados": <"purgados_arrematacao"|"verificar_certidao"|"possivelmente_existem">,
    "obras_estimadas_pct": <% do valor>,
    "financiamento_possivel": <true|false>,
    "vantagem_principal": "<max 15 palavras>",
    "risco_principal": "<max 15 palavras>",
    "prazo_decisao": "<imediato|dias|semanas>",
    "processo_referencia": "${processo || 'N/D'}"
  },` : ''}
  "veredicto": "<2-3 frases directas, específicas, com números>",
  "pontos_fortes": ["<específico com dados>","<específico>","<específico>"],
  "riscos_criticos": ["<risco específico>","<risco específico>"],
  "estrategia_negociacao": "<táctica específica com argumentos a usar e preço alvo>",
  "timing_recomendado": "<agir agora / aguardar X semanas / passar>",
  "nhr_enquadramento": "<se elegível NHR/IFICI — 1 frase>",
  "msg_wa_comprador": "<WhatsApp para o agente/vendedor — 3 linhas max, pt-PT, menciona oferta em €>",
  "msg_wa_cliente": "<WhatsApp para enviar ao cliente sobre este imóvel — 2 linhas, pt-PT, profissional>"
}`

    // ── Graceful mock when no API key ─────────────────────────────────────────
    if (!CLAUDE_KEY) {
      const mockScore = precoRef > 0 && pm2a > 0
        ? Math.max(40, Math.min(85, Math.round(55 + ((zm.pm2_trans - pm2a) / zm.pm2_trans) * 40)))
        : 55
      const mockAnalise: Record<string, unknown> = {
        score: mockScore,
        classificacao: mockScore >= 70 ? '✅ BOM NEGÓCIO' : mockScore >= 55 ? '⚖️ VALOR JUSTO' : '⚠️ SOBREVALORIZADO',
        veredicto: `Análise de demonstração — zona ${zona}. Configure ANTHROPIC_API_KEY para análise completa com IA.`,
        pontos_fortes: [`Zona ${zona} com procura activa`, `Yield estimado ${yieldBruto}%`, `Mercado: +${zm.var_yoy}% YoY`],
        riscos_criticos: ['Análise sem IA — dados incompletos', 'Verificar documentação do imóvel'],
        estrategia_negociacao: 'Configure a API key para obter estratégia de negociação personalizada.',
        yield_bruto: parseFloat(yieldBruto),
        yield_liquido: parseFloat(yieldLiq),
        roi_5_anos_pct: parseFloat(roi5y),
        roi_10_anos_pct: parseFloat(roi10y),
        pm2_anuncio: pm2a,
        pm2_mercado: zm.pm2_trans,
      }
      const mockResponse = {
        success: true, zona, platform, apify_ok: apifyOk,
        tipo_venda: tipoVenda || 'mercado_livre',
        is_leilao: isAuction, is_banca: isBank,
        banco: isBank ? bankName : null,
        leilao_info: null,
        mercado: {
          pm2_trans: zm.pm2_trans, pm2_ask: zm.pm2_ask,
          var_yoy: zm.var_yoy, var_qtq: zm.var_qtq,
          renda_m2: zm.renda_m2, yield_bruto: zm.yield_bruto, yield_al: zm.yield_al,
          abs_meses: zm.abs_meses, dias_mercado: zm.dias_mercado,
          comp_int_pct: zm.comp_int_pct, demanda: zm.demanda, liquidez: zm.liquidez,
          region: zm.region, fonte: 'INE/AT Q4 2025 · Demo Mode',
        },
        imovel: apifyOk ? { preco: precoRef, area, quartos: qts, casas_banho: bths, morada, pm2: pm2a, descricao: '' } : null,
        financeiro: {
          imt_hp, imt_inv, is, legal, registo,
          total_hp: Math.round(total_hp), total_inv: Math.round(total_inv),
          entrada30, capital, euribor_6m: liveRates.euribor_6m, euribor_12m: liveRates.euribor_12m,
          tan: parseFloat((tan * 100).toFixed(2)),
          pmt30, renda_est: rendaEst, renda_al: rendaAL,
          yield_bruto: yieldBruto, yield_liq: yieldLiq, yield_al: yieldAL,
          val5y, val10y, roi5y, roi10y,
          desconto_vs_mercado_pct: parseFloat(descontoLeilao) || 0,
        },
        analise: mockAnalise,
        _demo: true,
      }
      responseCache.set(cacheKey, { data: mockResponse, ts: Date.now() })
      return NextResponse.json(mockResponse)
    }

    const cr = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:3500, messages:[{ role:'user', content: prompt }] }),
      signal: AbortSignal.timeout(58000),
    })
    if (!cr.ok) throw new Error(`Claude: ${cr.status}`)

    const cd = await cr.json()
    const rawTxt = (cd.content?.[0] as { text: string })?.text ?? '{}'
    let analise: Record<string, unknown> = {}
    try {
      const m = rawTxt.match(/\{[\s\S]*\}/)
      if (m) analise = JSON.parse(m[0])
    } catch {
      analise = {
        score: 55, classificacao: '⚖️ VALOR JUSTO', valor_justo: precoRef || 0,
        oferta_recomendada: Math.round((precoRef || 0) * 0.92 / 500) * 500,
        desconto_percentagem: -8, yield_bruto: zm.yield_bruto,
        pm2_anuncio: pm2a, pm2_mercado: zm.pm2_trans,
        veredicto: 'Análise incompleta. Fornece um link válido.',
        pontos_fortes: ['Zona com procura activa'], riscos_criticos: ['Dados insuficientes'],
        msg_wa_comprador: 'Bom dia, tenho interesse no imóvel. Podemos conversar sobre o preço?',
      }
    }

    const responseData = {
      success: true, zona, platform, apify_ok: apifyOk,
      tipo_venda: tipoVenda || 'mercado_livre',
      is_leilao: isAuction,
      is_banca: isBank,
      banco: isBank ? bankName : null,
      leilao_info: isAuction ? {
        valor_base: valorBase,
        licitacao_minima: licitacaoMinima,
        prazo_fim: prazoFim,
        processo,
        tribunal,
        plataforma: platformLabel,
        desconto_estimado_pct: parseFloat(descontoLeilao) || 0,
      } : null,
      mercado: {
        pm2_trans: zm.pm2_trans, pm2_ask: zm.pm2_ask,
        var_yoy: zm.var_yoy, var_qtq: zm.var_qtq,
        renda_m2: zm.renda_m2, yield_bruto: zm.yield_bruto, yield_al: zm.yield_al,
        abs_meses: zm.abs_meses, dias_mercado: zm.dias_mercado,
        comp_int_pct: zm.comp_int_pct, demanda: zm.demanda, liquidez: zm.liquidez,
        region: zm.region, fonte: 'INE/AT Q4 2025 · Confidencial Imobiliário Q1 2026',
      },
      imovel: apifyOk ? {
        preco: precoRef, area, quartos: qts, casas_banho: bths,
        morada, pm2: pm2a, descricao: String(rawData?.description || '').substring(0, 300),
      } : null,
      financeiro: {
        imt_hp, imt_inv, is, legal, registo,
        total_hp: Math.round(total_hp), total_inv: Math.round(total_inv),
        entrada30, capital, euribor_6m: liveRates.euribor_6m, euribor_12m: liveRates.euribor_12m,
        tan: parseFloat((tan * 100).toFixed(2)),
        pmt30, renda_est: rendaEst, renda_al: rendaAL,
        yield_bruto: yieldBruto, yield_liq: yieldLiq, yield_al: yieldAL,
        val5y, val10y, roi5y, roi10y,
        desconto_vs_mercado_pct: parseFloat(descontoLeilao) || 0,
      },
      analise,
    }

    responseCache.set(cacheKey, { data: responseData, ts: Date.now() })
    const radarRes = NextResponse.json(responseData)
    radarRes.headers.set('x-correlation-id', corrId)
    return radarRes

  } catch (e: unknown) {
    console.error('Radar error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}
