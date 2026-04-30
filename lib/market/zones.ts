// =============================================================================
// Agency Group — Portugal Real Estate Zone Intelligence
// lib/market/zones.ts
//
// Single source of truth for all zone market data.
// Extracted from app/api/radar/route.ts to enable reuse by:
//   - Opportunity scoring engine (lib/scoring/opportunityScore.ts)
//   - Radar API (app/api/radar/route.ts)
//   - Sync-listings cron
//   - Investor alert automation
//
// Data: Q1 2026 · Sources: INE, Confidencial Imobiliário, Idealista, Cushman
// =============================================================================

export interface ZoneMarket {
  pm2_trans:          number  // median transaction price €/m²
  pm2_ask:            number  // median asking price €/m²
  var_yoy:            number  // YoY price change %
  var_qtq:            number  // QoQ price change %
  renda_m2:           number  // avg monthly rental €/m²
  yield_bruto:        number  // gross rental yield % (long-term)
  yield_al:           number  // AL (Airbnb/short-term) gross yield %
  abs_meses:          number  // absorption rate in months (supply/demand)
  dias_mercado:       number  // median days on market
  comp_int_pct:       number  // % international buyers
  demanda:            number  // demand score 0-10
  liquidez:           number  // liquidity score 0-10
  risco:              number  // risk score 0-10 (lower = safer)
  construcao_novo_m2: number  // new construction cost €/m²
  region:             string  // parent region label
}

// ---------------------------------------------------------------------------
// Zone dataset — 80+ zones, Portugal 2026
// ---------------------------------------------------------------------------

export const ZONES: Record<string, ZoneMarket> = {
  // ── LISBOA ────────────────────────────────────────────────────────────────────
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
  'Cascais':                       { pm2_trans:4700,  pm2_ask:5100,  var_yoy:18.0, var_qtq:4.3, renda_m2:16.0, yield_bruto:4.1, yield_al:6.5, abs_meses:2.5, dias_mercado:90,  comp_int_pct:42, demanda:8.0, liquidez:8.0, risco:3.4, construcao_novo_m2:1700, region:'Cascais/Sintra' },
  'Cascais — Centro':              { pm2_trans:5400,  pm2_ask:5800,  var_yoy:17.0, var_qtq:4.0, renda_m2:18.0, yield_bruto:4.0, yield_al:7.0, abs_meses:2.2, dias_mercado:75,  comp_int_pct:45, demanda:8.5, liquidez:8.0, risco:3.3, construcao_novo_m2:1800, region:'Cascais/Sintra' },
  'Cascais — Quinta da Marinha':   { pm2_trans:6900,  pm2_ask:7400,  var_yoy:18.0, var_qtq:4.3, renda_m2:22.0, yield_bruto:3.8, yield_al:7.5, abs_meses:3.5, dias_mercado:120, comp_int_pct:62, demanda:7.5, liquidez:7.5, risco:3.5, construcao_novo_m2:2000, region:'Cascais/Sintra' },
  'Estoril':                       { pm2_trans:5000,  pm2_ask:5400,  var_yoy:17.0, var_qtq:4.0, renda_m2:16.5, yield_bruto:3.9, yield_al:6.8, abs_meses:2.5, dias_mercado:90,  comp_int_pct:48, demanda:7.5, liquidez:7.5, risco:3.4, construcao_novo_m2:1700, region:'Cascais/Sintra' },
  'Sintra':                        { pm2_trans:3400,  pm2_ask:3700,  var_yoy:15.0, var_qtq:3.5, renda_m2:12.0, yield_bruto:4.2, yield_al:5.5, abs_meses:3.0, dias_mercado:120, comp_int_pct:18, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1500, region:'Cascais/Sintra' },
  'Ericeira':                      { pm2_trans:3700,  pm2_ask:4000,  var_yoy:21.0, var_qtq:5.2, renda_m2:13.0, yield_bruto:4.2, yield_al:7.5, abs_meses:2.5, dias_mercado:100, comp_int_pct:28, demanda:7.5, liquidez:7.0, risco:3.8, construcao_novo_m2:1500, region:'Cascais/Sintra' },
  'Almada/Caparica':               { pm2_trans:3000,  pm2_ask:3200,  var_yoy:19.0, var_qtq:4.5, renda_m2:11.0, yield_bruto:4.4, yield_al:6.0, abs_meses:2.0, dias_mercado:80,  comp_int_pct:12, demanda:7.5, liquidez:7.5, risco:3.8, construcao_novo_m2:1400, region:'AML' },
  'Amadora/Queluz':                { pm2_trans:2750,  pm2_ask:2950,  var_yoy:19.0, var_qtq:4.7, renda_m2:11.0, yield_bruto:4.8, yield_al:4.0, abs_meses:1.8, dias_mercado:75,  comp_int_pct:8,  demanda:7.5, liquidez:7.5, risco:4.2, construcao_novo_m2:1300, region:'AML' },
  // ── PORTO ─────────────────────────────────────────────────────────────────────
  'Porto':                         { pm2_trans:3600,  pm2_ask:3900,  var_yoy:19.0, var_qtq:4.7, renda_m2:13.0, yield_bruto:4.3, yield_al:7.2, abs_meses:1.8, dias_mercado:55,  comp_int_pct:28, demanda:8.5, liquidez:8.0, risco:3.5, construcao_novo_m2:1500, region:'Porto' },
  'Porto — Foz/Nevogilde':         { pm2_trans:5400,  pm2_ask:5800,  var_yoy:20.0, var_qtq:4.9, renda_m2:18.0, yield_bruto:4.0, yield_al:7.5, abs_meses:2.2, dias_mercado:65,  comp_int_pct:38, demanda:8.5, liquidez:8.0, risco:3.3, construcao_novo_m2:1800, region:'Porto' },
  'Porto — Boavista':              { pm2_trans:4400,  pm2_ask:4700,  var_yoy:18.0, var_qtq:4.3, renda_m2:15.0, yield_bruto:4.1, yield_al:7.0, abs_meses:2.0, dias_mercado:60,  comp_int_pct:30, demanda:8.0, liquidez:8.0, risco:3.5, construcao_novo_m2:1600, region:'Porto' },
  'Porto — Bonfim/Campanhã':       { pm2_trans:3700,  pm2_ask:4000,  var_yoy:22.0, var_qtq:5.4, renda_m2:13.5, yield_bruto:4.3, yield_al:7.8, abs_meses:1.8, dias_mercado:55,  comp_int_pct:22, demanda:8.5, liquidez:8.0, risco:3.7, construcao_novo_m2:1400, region:'Porto' },
  'Porto — Cedofeita':             { pm2_trans:3500,  pm2_ask:3800,  var_yoy:21.0, var_qtq:5.1, renda_m2:13.0, yield_bruto:4.4, yield_al:8.0, abs_meses:1.8, dias_mercado:55,  comp_int_pct:25, demanda:8.0, liquidez:8.0, risco:3.6, construcao_novo_m2:1400, region:'Porto' },
  'Porto — Ribeira/Miragaia':      { pm2_trans:4100,  pm2_ask:4400,  var_yoy:19.0, var_qtq:4.6, renda_m2:14.5, yield_bruto:4.2, yield_al:9.0, abs_meses:2.0, dias_mercado:70,  comp_int_pct:35, demanda:8.0, liquidez:7.5, risco:3.5, construcao_novo_m2:1500, region:'Porto' },
  'Matosinhos':                    { pm2_trans:3100,  pm2_ask:3400,  var_yoy:19.0, var_qtq:4.6, renda_m2:11.5, yield_bruto:4.4, yield_al:7.0, abs_meses:2.0, dias_mercado:60,  comp_int_pct:18, demanda:7.5, liquidez:7.5, risco:3.7, construcao_novo_m2:1400, region:'Porto' },
  'Matosinhos — Mar':              { pm2_trans:3800,  pm2_ask:4100,  var_yoy:21.0, var_qtq:5.2, renda_m2:14.0, yield_bruto:4.4, yield_al:8.5, abs_meses:1.8, dias_mercado:55,  comp_int_pct:25, demanda:8.0, liquidez:8.0, risco:3.5, construcao_novo_m2:1500, region:'Porto' },
  'Vila Nova de Gaia':             { pm2_trans:2800,  pm2_ask:3000,  var_yoy:18.0, var_qtq:4.3, renda_m2:10.0, yield_bruto:4.3, yield_al:6.5, abs_meses:2.2, dias_mercado:65,  comp_int_pct:15, demanda:7.5, liquidez:7.5, risco:3.8, construcao_novo_m2:1300, region:'Porto' },
  // ── ALGARVE ───────────────────────────────────────────────────────────────────
  'Algarve':                       { pm2_trans:3900,  pm2_ask:4200,  var_yoy:19.0, var_qtq:4.7, renda_m2:14.0, yield_bruto:4.3, yield_al:8.5, abs_meses:3.5, dias_mercado:150, comp_int_pct:58, demanda:7.5, liquidez:7.0, risco:3.8, construcao_novo_m2:1500, region:'Algarve' },
  'Quinta do Lago':                { pm2_trans:12000, pm2_ask:13500, var_yoy:15.0, var_qtq:3.7, renda_m2:42.0, yield_bruto:4.2, yield_al:9.0, abs_meses:5.5, dias_mercado:300, comp_int_pct:78, demanda:7.0, liquidez:6.0, risco:3.5, construcao_novo_m2:3000, region:'Algarve' },
  'Vale do Lobo':                  { pm2_trans:10000, pm2_ask:11200, var_yoy:15.0, var_qtq:3.7, renda_m2:35.0, yield_bruto:4.2, yield_al:9.0, abs_meses:5.0, dias_mercado:280, comp_int_pct:75, demanda:7.0, liquidez:6.0, risco:3.5, construcao_novo_m2:2800, region:'Algarve' },
  'Vilamoura':                     { pm2_trans:5000,  pm2_ask:5400,  var_yoy:18.0, var_qtq:4.3, renda_m2:17.5, yield_bruto:4.2, yield_al:8.8, abs_meses:4.0, dias_mercado:180, comp_int_pct:62, demanda:7.5, liquidez:7.0, risco:3.6, construcao_novo_m2:1700, region:'Algarve' },
  'Loulé/Almancil':                { pm2_trans:5500,  pm2_ask:5900,  var_yoy:18.0, var_qtq:4.3, renda_m2:18.5, yield_bruto:4.0, yield_al:8.5, abs_meses:3.8, dias_mercado:150, comp_int_pct:65, demanda:7.5, liquidez:7.0, risco:3.6, construcao_novo_m2:1800, region:'Algarve' },
  'Lagos':                         { pm2_trans:4400,  pm2_ask:4800,  var_yoy:19.0, var_qtq:4.7, renda_m2:15.5, yield_bruto:4.2, yield_al:8.5, abs_meses:3.5, dias_mercado:150, comp_int_pct:55, demanda:7.5, liquidez:7.0, risco:3.7, construcao_novo_m2:1600, region:'Algarve' },
  'Portimão':                      { pm2_trans:3100,  pm2_ask:3400,  var_yoy:18.0, var_qtq:4.3, renda_m2:11.0, yield_bruto:4.3, yield_al:7.5, abs_meses:3.0, dias_mercado:130, comp_int_pct:40, demanda:7.0, liquidez:7.0, risco:4.0, construcao_novo_m2:1400, region:'Algarve' },
  'Albufeira':                     { pm2_trans:3700,  pm2_ask:4000,  var_yoy:19.0, var_qtq:4.7, renda_m2:13.5, yield_bruto:4.4, yield_al:9.0, abs_meses:3.5, dias_mercado:140, comp_int_pct:48, demanda:7.5, liquidez:7.0, risco:3.8, construcao_novo_m2:1500, region:'Algarve' },
  'Tavira':                        { pm2_trans:3000,  pm2_ask:3200,  var_yoy:18.0, var_qtq:4.3, renda_m2:10.5, yield_bruto:4.2, yield_al:7.5, abs_meses:3.8, dias_mercado:160, comp_int_pct:42, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1400, region:'Algarve' },
  'Faro':                          { pm2_trans:2700,  pm2_ask:2900,  var_yoy:17.0, var_qtq:4.0, renda_m2:10.0, yield_bruto:4.4, yield_al:7.0, abs_meses:3.0, dias_mercado:120, comp_int_pct:28, demanda:7.0, liquidez:7.0, risco:4.0, construcao_novo_m2:1400, region:'Algarve' },
  'Olhão':                         { pm2_trans:2500,  pm2_ask:2700,  var_yoy:20.0, var_qtq:4.9, renda_m2:9.5,  yield_bruto:4.6, yield_al:8.0, abs_meses:3.0, dias_mercado:130, comp_int_pct:25, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1300, region:'Algarve' },
  'Sagres/Vila do Bispo':          { pm2_trans:3500,  pm2_ask:3800,  var_yoy:20.0, var_qtq:4.9, renda_m2:12.5, yield_bruto:4.3, yield_al:9.0, abs_meses:4.0, dias_mercado:200, comp_int_pct:45, demanda:7.0, liquidez:6.0, risco:4.2, construcao_novo_m2:1400, region:'Algarve' },
  'Aljezur/Sudoeste':              { pm2_trans:3200,  pm2_ask:3500,  var_yoy:20.0, var_qtq:4.9, renda_m2:11.5, yield_bruto:4.3, yield_al:8.5, abs_meses:4.0, dias_mercado:200, comp_int_pct:40, demanda:7.0, liquidez:6.0, risco:4.2, construcao_novo_m2:1400, region:'Algarve' },
  // ── COMPORTA / ALENTEJO LITORAL ───────────────────────────────────────────────
  'Comporta':                      { pm2_trans:8500,  pm2_ask:9500,  var_yoy:12.0, var_qtq:2.9, renda_m2:29.0, yield_bruto:4.1, yield_al:9.5, abs_meses:5.5, dias_mercado:300, comp_int_pct:72, demanda:7.0, liquidez:6.0, risco:4.0, construcao_novo_m2:2200, region:'Alentejo Litoral' },
  'Melides':                       { pm2_trans:6000,  pm2_ask:6700,  var_yoy:14.0, var_qtq:3.4, renda_m2:20.0, yield_bruto:4.0, yield_al:8.5, abs_meses:5.0, dias_mercado:280, comp_int_pct:58, demanda:6.5, liquidez:5.5, risco:4.2, construcao_novo_m2:1800, region:'Alentejo Litoral' },
  'Grândola':                      { pm2_trans:2800,  pm2_ask:3100,  var_yoy:18.0, var_qtq:4.3, renda_m2:10.5, yield_bruto:4.5, yield_al:7.0, abs_meses:4.0, dias_mercado:160, comp_int_pct:22, demanda:6.5, liquidez:6.0, risco:4.5, construcao_novo_m2:1300, region:'Alentejo Litoral' },
  'Évora':                         { pm2_trans:2400,  pm2_ask:2600,  var_yoy:16.0, var_qtq:3.8, renda_m2:9.0,  yield_bruto:4.5, yield_al:6.5, abs_meses:3.5, dias_mercado:150, comp_int_pct:15, demanda:6.5, liquidez:6.0, risco:4.5, construcao_novo_m2:1300, region:'Alentejo' },
  // ── MADEIRA ───────────────────────────────────────────────────────────────────
  'Madeira':                       { pm2_trans:3750,  pm2_ask:4100,  var_yoy:18.0, var_qtq:4.3, renda_m2:13.5, yield_bruto:4.3, yield_al:8.5, abs_meses:2.8, dias_mercado:120, comp_int_pct:45, demanda:7.5, liquidez:7.0, risco:3.8, construcao_novo_m2:1600, region:'Madeira' },
  'Madeira — Funchal':             { pm2_trans:4200,  pm2_ask:4600,  var_yoy:19.0, var_qtq:4.7, renda_m2:15.0, yield_bruto:4.3, yield_al:9.0, abs_meses:2.5, dias_mercado:100, comp_int_pct:48, demanda:7.5, liquidez:7.5, risco:3.7, construcao_novo_m2:1700, region:'Madeira' },
  'Madeira — Funchal Centro':      { pm2_trans:4700,  pm2_ask:5100,  var_yoy:20.0, var_qtq:4.9, renda_m2:17.0, yield_bruto:4.3, yield_al:9.5, abs_meses:2.2, dias_mercado:90,  comp_int_pct:52, demanda:8.0, liquidez:7.5, risco:3.6, construcao_novo_m2:1800, region:'Madeira' },
  'Madeira — Câmara de Lobos':     { pm2_trans:3400,  pm2_ask:3700,  var_yoy:17.0, var_qtq:4.0, renda_m2:12.0, yield_bruto:4.2, yield_al:8.0, abs_meses:3.0, dias_mercado:130, comp_int_pct:35, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1500, region:'Madeira' },
  'Madeira — Calheta':             { pm2_trans:4400,  pm2_ask:4800,  var_yoy:19.0, var_qtq:4.7, renda_m2:15.5, yield_bruto:4.2, yield_al:9.0, abs_meses:3.2, dias_mercado:150, comp_int_pct:42, demanda:7.0, liquidez:6.0, risco:4.0, construcao_novo_m2:1700, region:'Madeira' },
  'Madeira — Santa Cruz':          { pm2_trans:3200,  pm2_ask:3500,  var_yoy:17.0, var_qtq:4.0, renda_m2:11.5, yield_bruto:4.3, yield_al:7.5, abs_meses:3.0, dias_mercado:140, comp_int_pct:30, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1500, region:'Madeira' },
  'Porto Santo':                   { pm2_trans:2600,  pm2_ask:2900,  var_yoy:15.0, var_qtq:3.6, renda_m2:10.0, yield_bruto:4.6, yield_al:8.5, abs_meses:4.0, dias_mercado:180, comp_int_pct:28, demanda:6.5, liquidez:5.5, risco:4.5, construcao_novo_m2:1400, region:'Madeira' },
  // ── AÇORES ────────────────────────────────────────────────────────────────────
  'Açores':                        { pm2_trans:1800,  pm2_ask:2000,  var_yoy:13.0, var_qtq:3.1, renda_m2:7.5,  yield_bruto:5.0, yield_al:7.0, abs_meses:3.5, dias_mercado:170, comp_int_pct:15, demanda:6.0, liquidez:5.5, risco:5.0, construcao_novo_m2:1300, region:'Açores' },
  'Açores — Ponta Delgada':        { pm2_trans:2000,  pm2_ask:2200,  var_yoy:14.0, var_qtq:3.4, renda_m2:8.5,  yield_bruto:5.1, yield_al:7.5, abs_meses:3.0, dias_mercado:150, comp_int_pct:18, demanda:6.5, liquidez:6.0, risco:4.8, construcao_novo_m2:1300, region:'Açores' },
  'Açores — Angra do Heroísmo':    { pm2_trans:1550,  pm2_ask:1700,  var_yoy:12.0, var_qtq:2.9, renda_m2:6.5,  yield_bruto:5.0, yield_al:6.5, abs_meses:4.0, dias_mercado:200, comp_int_pct:12, demanda:5.5, liquidez:5.0, risco:5.2, construcao_novo_m2:1200, region:'Açores' },
  // ── OUTRAS ────────────────────────────────────────────────────────────────────
  'Braga':                         { pm2_trans:2700,  pm2_ask:2950,  var_yoy:20.0, var_qtq:4.9, renda_m2:10.0, yield_bruto:4.4, yield_al:6.5, abs_meses:2.2, dias_mercado:75,  comp_int_pct:12, demanda:7.5, liquidez:7.0, risco:4.0, construcao_novo_m2:1400, region:'Minho' },
  'Coimbra':                       { pm2_trans:2300,  pm2_ask:2500,  var_yoy:17.0, var_qtq:4.0, renda_m2:9.0,  yield_bruto:4.7, yield_al:6.0, abs_meses:2.5, dias_mercado:100, comp_int_pct:10, demanda:7.0, liquidez:6.5, risco:4.2, construcao_novo_m2:1300, region:'Centro' },
  'Aveiro':                        { pm2_trans:2500,  pm2_ask:2700,  var_yoy:18.0, var_qtq:4.3, renda_m2:9.5,  yield_bruto:4.6, yield_al:6.5, abs_meses:2.5, dias_mercado:90,  comp_int_pct:12, demanda:7.0, liquidez:6.5, risco:4.0, construcao_novo_m2:1300, region:'Centro' },
  'Viseu':                         { pm2_trans:1650,  pm2_ask:1800,  var_yoy:14.0, var_qtq:3.4, renda_m2:7.0,  yield_bruto:5.1, yield_al:5.5, abs_meses:3.5, dias_mercado:160, comp_int_pct:5,  demanda:6.0, liquidez:5.5, risco:4.5, construcao_novo_m2:1200, region:'Centro' },
  'Setúbal':                       { pm2_trans:2100,  pm2_ask:2300,  var_yoy:17.0, var_qtq:4.0, renda_m2:8.5,  yield_bruto:4.9, yield_al:5.5, abs_meses:2.8, dias_mercado:120, comp_int_pct:8,  demanda:6.5, liquidez:6.5, risco:4.3, construcao_novo_m2:1300, region:'Setúbal' },
}

// Default fallback for unknown zones
export const ZONE_DEFAULT: ZoneMarket = {
  pm2_trans:2500, pm2_ask:2700, var_yoy:15.0, var_qtq:3.6,
  renda_m2:9.0, yield_bruto:4.5, yield_al:6.0,
  abs_meses:3.0, dias_mercado:150, comp_int_pct:12,
  demanda:6.0, liquidez:6.0, risco:5.0,
  construcao_novo_m2:1400, region:'Portugal',
}

// ---------------------------------------------------------------------------
// Zone detection — maps free text to a known ZONES key
// ---------------------------------------------------------------------------

const ZONA_MAP: [RegExp, string][] = [
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

/**
 * Detect zone from any free-text field (titulo, zona, address, descricao).
 * Returns a ZONES key or 'Lisboa' as fallback.
 */
export function detectZona(texto: string): string {
  const t = texto.toLowerCase()
  for (const [rx, zona] of ZONA_MAP) if (rx.test(t)) return zona
  return 'Lisboa'
}

/**
 * Resolve zone market data from a zone key.
 * Falls back to ZONE_DEFAULT for unknown zones.
 */
export function getZone(zona: string): ZoneMarket {
  return ZONES[zona] ?? ZONE_DEFAULT
}

/**
 * Resolve zone from multiple property fields (tries zona first, then full text).
 */
export function resolvePropertyZone(property: {
  zona?: string | null
  zone?: string | null
  city?: string | null
  concelho?: string | null
  address?: string | null
  nome?: string | null
  titulo?: string | null
  title?: string | null
}): string {
  // Try direct ZONES lookup first
  const directFields = [property.zona, property.zone, property.city, property.concelho]
  for (const f of directFields) {
    if (f && ZONES[f]) return f
  }
  // Fall back to text detection
  const fullText = [
    property.zona, property.zone, property.city, property.concelho,
    property.address, property.nome, property.titulo, property.title,
  ].filter(Boolean).join(' ')
  return fullText ? detectZona(fullText) : 'Lisboa'
}
