'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
// next-auth not used — using localStorage magic link auth
import PortalSidebar from './components/PortalSidebar'
import PortalHeader from './components/PortalHeader'
import PriceHistoryWidget from './components/PriceHistoryWidget'
import {
  CHECKLISTS, PORTAL_PROPERTIES, SECTION_NAMES,
} from './components/constants'
import type { CRMContact, JurMsg, SectionId } from './components/types'
import { computeLeadScore } from './components/utils'
import { parsePTValue } from './utils/format'

// Stores
import { useUIStore } from './stores/uiStore'
import { useDealStore } from './stores/dealStore'
import { useCRMStore } from './stores/crmStore'
import { useAVMStore } from './stores/avmStore'
import { useMarketingStore } from './stores/marketingStore'
import { useRadarStore } from './stores/radarStore'
import { useFinancialStore } from './stores/financialStore'
import { usePortfolioStore } from './stores/portfolioStore'

// Components — PortalDashboard loaded eagerly (default section); all others lazy
import dynamic from 'next/dynamic'
import PortalDashboard from './components/PortalDashboard'
import { PortalBootstrap } from './components/PortalBootstrap'
const PortalAVM           = dynamic(() => import('./components/PortalAVM'),           { ssr: false })
const PortalMortgage      = dynamic(() => import('./components/PortalMortgage'),      { ssr: false })
const PortalNHR           = dynamic(() => import('./components/PortalNHR'),           { ssr: false })
const PortalPipeline      = dynamic(() => import('./components/PortalPipeline'),      { ssr: false })
const PortalMarketing     = dynamic(() => import('./components/PortalMarketing'),     { ssr: false })
const PortalRadar         = dynamic(() => import('./components/PortalRadar'),         { ssr: false })
const PortalPortfolio     = dynamic(() => import('./components/PortalPortfolio'),     { ssr: false })
const PortalSofia         = dynamic(() => import('./components/PortalSofia'),         { ssr: false })
const PortalJuridico      = dynamic(() => import('./components/PortalJuridico'),      { ssr: false })
const PortalAgenda        = dynamic(() => import('./components/PortalAgenda'),        { ssr: false })
const PortalDocumentos    = dynamic(() => import('./components/PortalDocumentos'),    { ssr: false })
const PortalInvestorPitch = dynamic(() => import('./components/PortalInvestorPitch'), { ssr: false })
const PortalIMT           = dynamic(() => import('./components/PortalIMT'),           { ssr: false })
const PortalComissoes     = dynamic(() => import('./components/PortalComissoes'),     { ssr: false })
const PortalVisitas       = dynamic(() => import('./components/PortalVisitas'),       { ssr: false })
const PortalMaisvalias    = dynamic(() => import('./components/PortalMaisvalias'),    { ssr: false })
const PortalFinanciamento = dynamic(() => import('./components/PortalFinanciamento'), { ssr: false })
const PortalHomestaging   = dynamic(() => import('./components/PortalHomestaging'),   { ssr: false })
const PortalCRM           = dynamic(() => import('./components/PortalCRM'),           { ssr: false })
const PortalExitSim       = dynamic(() => import('./components/PortalExitSim'),       { ssr: false })
const PortalPulse         = dynamic(() => import('./components/PortalPulse'),         { ssr: false })
const PortalImoveis       = dynamic(() => import('./components/PortalImoveis'),       { ssr: false })
const PortalCampanhas     = dynamic(() => import('./components/PortalCampanhas'),     { ssr: false })
const PortalCrossCompare  = dynamic(() => import('./components/PortalCrossCompare'),  { ssr: false })
const PortalVoz           = dynamic(() => import('./components/PortalVoz'),           { ssr: false })
const PortalCollections   = dynamic(() => import('./components/PortalCollections'),   { ssr: false })
const PortalDraftOffer    = dynamic(() => import('./components/PortalDraftOffer'),    { ssr: false })
const PortalAnalytics     = dynamic(() => import('./components/PortalAnalytics'),     { ssr: false })
const PortalInvestidores  = dynamic(() => import('./components/PortalInvestidores'),  { ssr: false })
const PortalOutbound          = dynamic(() => import('./components/PortalOutbound'),          { ssr: false })
const PortalOffmarketLeads    = dynamic(() => import('./components/PortalOffmarketLeads'),    { ssr: false })
const PortalPartners          = dynamic(() => import('./components/PortalPartners'),          { ssr: false })
const PortalDealDesk          = dynamic(() => import('./components/PortalDealDesk'),          { ssr: false })
const PortalCommandPalette = dynamic(() => import('./components/PortalCommandPalette'), { ssr: false })
const PortalVideoStudio    = dynamic(
  () => import('./components/PortalVideoStudio').then(m => ({ default: m.PortalVideoStudio })),
  { ssr: false },
)
const PortalPhotoScorer    = dynamic(
  () => import('./components/PortalPhotoScorer').then(m => ({ default: m.PortalPhotoScorer })),
  { ssr: false },
)
const PortalAgentAI        = dynamic(
  () => import('./components/PortalAgentAI').then(m => ({ default: m.PortalAgentAI })),
  { ssr: false },
)

// parsePTValue imported from ./utils/format — single source of truth

export default function Portal() {
  // localStorage auth — no NextAuth
  const [ready, setReady] = useState(false)
  const [agentEmail, setAgentEmail] = useState('')
  const [agentName, setAgentName] = useState('Agente')
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([])

  function toast(msg: string) {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }
  const [priceHistoryId, setPriceHistoryId] = useState<string | null>(null)

  // UI store — use selectors to avoid re-rendering on unrelated store changes (e.g. the 1s clock)
  const darkMode       = useUIStore(s => s.darkMode)
  const setDarkMode    = useUIStore(s => s.setDarkMode)
  const section        = useUIStore(s => s.section)
  const setSection     = useUIStore(s => s.setSection)
  const sidebarOpen    = useUIStore(s => s.sidebarOpen)
  const setSidebarOpen = useUIStore(s => s.setSidebarOpen)
  const showNotifPanel = useUIStore(s => s.showNotifPanel)

  // Deal store
  const { deals, setDeals } = useDealStore()

  // CRM store
  const {
    crmContacts, setCrmContacts,
    setActiveCrmId, setCrmProfileTab,
  } = useCRMStore()

  // Financial store
  const {
    mortMontante, mortEntrada, mortPrazo, mortSpreadVal, mortUso, mortRendimento,
    setMortResult, setMortLoading, setMortMontante, setMortEntrada, setMortPrazo, setMortSpreadVal, setMortUso, setMortRendimento,
    nhrPais, nhrTipo, nhrRend, nhrFonte,
    setNhrResult, setNhrLoading, setNhrPais, setNhrTipo, setNhrRend, setNhrFonte,
  } = useFinancialStore()

  // AVM store
  const {
    avmZona, avmTipo, avmArea, avmEstado, avmVista, avmPiscina, avmGaragem,
    avmEpc, avmAndar, avmOrientacao, avmAnoConstr, avmTerraco, avmCasasBanho, avmUso,
    setAvmResult, setAvmLoading,
  } = useAVMStore()

  // Marketing store
  const {
    mktInput, mktFormat, mktLang, mktLangs, mktPersona, mktPhotos, mktVideoUrl, mktListingUrl,
    setMktResult, setMktLoading, setMktSeoScore, setMktPhotoInsights, setMktPostingSchedule,
    setMktCharCounts, setMktCharLimits, setMktLang: setMktLangStore, setMktAutoFilling,
    isListening, setIsListening,
    copied, setCopied,
  } = useMarketingStore()

  // Radar store
  const {
    radarUrl, radarMode,
    searchZona, searchPrecoMin, searchPrecoMax, searchTipos, searchFontes, searchScoreMin,
    setRadarResult, setRadarLoading, setSearchResults, setSearchLoading,
  } = useRadarStore()

  // Portfolio store
  const {
    portItems, portLoading,
    setPortResult, setPortLoading,
    ipProperty, ipInvestorType, ipHorizon, ipIrr, ipLang,
    setIpLoading, setIpResult, setIpError,
  } = usePortfolioStore()

  // Dashboard state (local - only used in dashboard)
  const [weeklyReport, setWeeklyReport] = useState<Record<string, unknown> | null>(null)
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false)
  const [imoveisList, setImoveisList] = useState<(typeof PORTAL_PROPERTIES[0] & Record<string, unknown>)[]>([])

  // Sofia state (local - refs can't go in stores easily)
  const sofiaVideoRef = useRef<HTMLVideoElement | null>(null)
  const sofiaPeerRef = useRef<RTCPeerConnection | null>(null)
  const [sofiaSessionId, setSofiaSessionId] = useState<string | null>(null)
  const [sofiaConnected, setSofiaConnected] = useState(false)
  const [sofiaLoading, setSofiaLoading] = useState(false)
  const [sofiaSpeaking, setSofiaSpeaking] = useState(false)
  const [sofiaText, setSofiaText] = useState('')
  const [sofiaError, setSofiaError] = useState<string | null>(null)
  const [sofiaScriptLoading, setSofiaScriptLoading] = useState(false)
  const [sofiaPropSel, setSofiaPropSel] = useState('')
  const [sofiaLang, setSofiaLang] = useState<'PT' | 'EN' | 'FR' | 'AR'>('EN')

  // Juridico state (local - chat messages can't live in zustand without serialization issues)
  const [jurMsgs, setJurMsgs] = useState<JurMsg[]>([
    { role: 'assistant', content: 'Bom dia. Sou o Consultor Jurídico IA da Agency Group.\n\n**Áreas de especialização:**\n- Transacções imobiliárias (CPCV, escritura, due diligence)\n- Fiscalidade (IMT, IMI, IS, AIMI, mais-valias, NHR/IFICI)\n- Vistos e residência (ARI/Golden Visa, D7, D8, D2)\n- Alojamento Local — licenciamento, RNAL, zonas de contenção\n- Arrendamento urbano (NRAU, despejo, actualização rendas)\n- Herança e sucessões imobiliárias\n- Crédito habitação e hipotecas (limites BdP, LTV, DSTI)\n- Condomínio e propriedade horizontal\n\nColoque a sua questão — respondo com base legal actualizada.\nPrefixo **MEMO:** para relatório jurídico estruturado completo.', ts: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }
  ])
  const [jurInput, setJurInput] = useState('')
  const [jurLoading, setJurLoading] = useState(false)
  const [jurWebSearch, setJurWebSearch] = useState(false)
  const [jurMode, setJurMode] = useState<'rapido' | 'memo'>('rapido')

  // ── HELPERS ──────────────────────────────────────────────────────────────────

  async function syncContactsToNotion(contacts: CRMContact[], email: string) {
    // Non-blocking fire-and-forget Notion sync
    // Retrieve magic-link token for X-AG-Token auth header
    const agToken = (() => {
      try { return JSON.parse(localStorage.getItem('ag_auth') || '{}').token || '' } catch { return '' }
    })()
    await Promise.allSettled(contacts.map(async (contact) => {
      try {
        const payload = {
          ...contact,
          agentEmail: email,
          leadScore: computeLeadScore(contact).score,
          notionId: (contact as CRMContact & { notionId?: string }).notionId,
        }
        const notionHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (agToken) notionHeaders['X-AG-Token'] = agToken
        if ((payload as CRMContact & { notionId?: string }).notionId) {
          await fetch('/api/notion/contacts', { method: 'PATCH', headers: notionHeaders, body: JSON.stringify(payload) })
        } else {
          const res = await fetch('/api/notion/contacts', { method: 'POST', headers: notionHeaders, body: JSON.stringify(payload) })
          const data = await res.json()
          if (data.notionId) {
            const idx = contacts.findIndex(c => c.id === contact.id)
            if (idx >= 0) {
              const updatedWithId = [...contacts];
              (updatedWithId[idx] as CRMContact & { notionId?: string }).notionId = data.notionId
              localStorage.setItem(`ag_crm_${email}`, JSON.stringify(updatedWithId))
            }
          }
        }
      } catch (e) { console.error('Notion sync error', e) }
    }))
  }

  function saveCrmContacts(updated: CRMContact[]) {
    setCrmContacts(updated)
    if (agentEmail) localStorage.setItem(`ag_crm_${agentEmail}`, JSON.stringify(updated))
    syncContactsToNotion(updated, agentEmail)
  }

  function saveImoveis(updated: (typeof PORTAL_PROPERTIES[0] & Record<string, unknown>)[]) {
    setImoveisList(updated)
    localStorage.setItem(`ag_imoveis_${agentEmail}`, JSON.stringify(updated))
  }

  // logout — clears BOTH the httpOnly server cookie AND localStorage.
  // Previously only localStorage was cleared; the cookie persisted (httpOnly
  // cookies cannot be touched by client JS), so IE / IE-mode would re-admit
  // the user on the next visit because the cookie was still valid and
  // middleware accepted it.
  async function logout() {
    localStorage.removeItem('ag_auth')
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* cookie will expire naturally at its 8h limit */ }
    window.location.href = '/'
  }

  function exportToPDF(title: string, htmlContent: string) {
    const w = window.open('', '_blank', 'width=960,height=780')
    if (!w) { toast('Permita pop-ups para exportar PDF'); return }
    const dateStr = new Date().toLocaleDateString('pt-PT', { year: 'numeric', month: 'long', day: 'numeric' })
    w.document.write(`<!DOCTYPE html><html lang="pt"><head>
      <meta charset="UTF-8"><title>${title} — Agency Group</title>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:var(--font-jost),sans-serif;color:#0e0e0d;background:#fff;font-size:14px}
      .hdr{background:#0c1f15;color:#f4f0e6;padding:28px 40px;display:flex;justify-content:space-between;align-items:center}
      .hdr-brand{font-family:var(--font-cormorant),serif;font-size:1.6rem;font-weight:300}.body{padding:36px 40px}
      .label{font-family:var(--font-dm-mono),monospace;font-size:.45rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(14,14,13,.35);margin-bottom:10px;margin-top:24px}
      .print-btn{position:fixed;bottom:24px;right:24px;background:#c9a96e;color:#0c1f15;border:none;padding:12px 24px;cursor:pointer;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700}
      @media print{.print-btn{display:none}}</style>
    </head><body>
      <button class="print-btn" onclick="window.print()">⬇ IMPRIMIR / PDF</button>
      <div class="hdr"><div><div class="hdr-brand">Agency Group</div><div style="font-size:.5rem;color:#c9a96e;letter-spacing:.1em;margin-top:3px">AMI 22506 · LUXO PREMIUM</div><div style="font-size:.5rem;color:rgba(244,240,230,.6);letter-spacing:.12em;text-transform:uppercase;margin-top:2px">${title}</div></div><div style="font-family:var(--font-dm-mono),monospace;font-size:.45rem;color:rgba(244,240,230,.45);text-align:right">${dateStr}</div></div>
      <div class="body">${htmlContent}</div>
      <div style="background:rgba(14,14,13,.03);border-top:1px solid rgba(14,14,13,.08);padding:16px 40px;display:flex;justify-content:space-between;margin-top:40px">
        <span style="font-family:var(--font-dm-mono),monospace;font-size:.42rem;color:rgba(14,14,13,.35)">Agency Group · AMI 22506 · Comissão 5%</span>
        <span style="font-family:var(--font-dm-mono),monospace;font-size:.42rem;color:rgba(14,14,13,.35)">${dateStr} · Confidencial</span>
      </div>
    </body></html>`)
    w.document.close()
  }

  function exportToICS(events: { title: string; date: string; time?: string; description?: string }[]) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agency Group//Portal 2026//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
    events.forEach((ev, i) => {
      const d = ev.date.replace(/-/g, '')
      const h = ev.time ? ev.time.split(':')[0] : '09'
      const m = ev.time ? ev.time.split(':')[1] : '00'
      const dtStart = ev.time ? `${d}T${h}${m}00` : d
      const dtEnd = ev.time ? `${d}T${pad(Math.min(23, parseInt(h) + 1))}${m}00` : d
      lines.push('BEGIN:VEVENT', `UID:ag-${Date.now()}-${i}@agencygroup.pt`, `DTSTART${ev.time ? '' : ';VALUE=DATE'}:${dtStart}`, `DTEND${ev.time ? '' : ';VALUE=DATE'}:${dtEnd}`, `SUMMARY:${(ev.title || '').replace(/,/g, '\\,')}`, `DESCRIPTION:${(ev.description || 'Agency Group — AMI 22506').replace(/,/g, '\\,')}`, 'END:VEVENT')
    })
    lines.push('END:VCALENDAR')
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `agenda-ag-${new Date().toISOString().split('T')[0]}.ics`; a.click()
    URL.revokeObjectURL(url)
  }

  function gerarPDF(pdfDeals: Record<string, unknown>[], filtros: Record<string, unknown>, stats: Record<string, unknown>) {
    const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
    const dealsHtml = pdfDeals.map((d) => `<div style="margin-bottom:14px;border:1px solid #e2e8f0;padding:14px"><div style="font-weight:600">${String(d.titulo || '').substring(0, 80)}</div><div style="color:#64748b;font-size:10px">${String(d.zona || '')} · ${d.preco ? `€ ${Number(d.preco).toLocaleString('pt-PT')}` : '—'}</div><a href="${String(d.url)}" style="font-size:10px;color:#1c4a35">Ver →</a></div>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Radar ${hoje}</title></head><body>${dealsHtml}<p style="font-size:9px;color:#94a3b8">Agency Group · AMI 22506 · Fontes: ${String((filtros.fontes as string[] || []).join(' · '))} · Score mín: ${String(filtros.score_min || 65)} · Total: ${pdfDeals.length} deals · Avg score: ${Number(stats.avg_score || 0)}</p></body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank')
    if (w) { setTimeout(() => { try { w.print() } catch { } setTimeout(() => URL.revokeObjectURL(url), 5000) }, 1200) }
    else { const a = document.createElement('a'); a.href = url; a.download = `radar-${new Date().toISOString().split('T')[0]}.html`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 3000) }
  }

  // ── DEAL ACTIONS ──────────────────────────────────────────────────────────────

  const saveDeals = useCallback((d: typeof deals) => {
    setDeals(d)
    if (agentEmail) localStorage.setItem(`ag_deals_${agentEmail}`, JSON.stringify(d))
  }, [agentEmail, setDeals])

  function addDealAction() {
    const { newDeal, setNewDeal, setShowNewDeal } = useDealStore.getState()
    if (!newDeal.imovel || !newDeal.valor) return
    const id = Date.now()
    const deal = {
      id,
      ref: `AG-2026-${String(deals.length + 1).padStart(3, '0')}`,
      imovel: newDeal.imovel,
      valor: newDeal.valor,
      fase: 'Angariação',
      comprador: '',
      cpcvDate: '',
      escrituraDate: '',
      checklist: Object.fromEntries(Object.keys(CHECKLISTS).map(k => [k, CHECKLISTS[k].map(() => false)])),
    }
    saveDeals([...deals, deal])
    setNewDeal({ imovel: '', valor: '' })
    setShowNewDeal(false)
    // Persist to Supabase (fire-and-forget)
    fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imovel: deal.imovel,
        valor: parsePTValue(deal.valor),
        fase: deal.fase,
        ref: deal.ref,
        comprador: deal.comprador,
      }),
    }).catch(() => { /* silently fail — data persisted to localStorage */ })
  }

  function toggleCheck(dealId: number, fase: string, idx: number) {
    saveDeals(deals.map(d => {
      if (d.id !== dealId) return d
      const newChecklist = { ...d.checklist }
      const arr = [...newChecklist[fase]]
      arr[idx] = !arr[idx]
      newChecklist[fase] = arr
      return { ...d, checklist: newChecklist }
    }))
  }

  function changeFase(dealId: number, fase: string) {
    saveDeals(deals.map(d => d.id === dealId ? { ...d, fase } : d))
    // Persist stage change to Supabase (fire-and-forget, using ref as identifier)
    const deal = useDealStore.getState().deals.find(d => d.id === dealId)
    if (deal?.ref) {
      fetch('/api/deals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: deal.ref, fase }),
      }).catch(() => { /* silently fail */ })
    }
  }

  // ── API CALLS ────────────────────────────────────────────────────────────────

  async function runAVM() {
    if (!avmZona || !avmArea) { toast('Preenche zona e área.'); return }
    setAvmLoading(true); setAvmResult(null)
    try {
      const andarNum = avmAndar === 'rc' ? 0 : avmAndar === '1-2' ? 2 : avmAndar === '3-5' ? 4 : avmAndar === '6+' ? 8 : parseInt(avmAndar) || 2
      const res = await fetch('/api/avm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zona: avmZona, tipo: avmTipo, area: parseFloat(avmArea), estado: avmEstado, vista: avmVista, piscina: avmPiscina, epc: avmEpc, garagem: avmGaragem, andar: andarNum, orientacao: avmOrientacao, anoConstr: parseInt(avmAnoConstr) || 2000, terraco: parseFloat(avmTerraco) || 0, casasBanho: parseInt(avmCasasBanho) || 1, uso: avmUso }) })
      const data = await res.json()
      if (data.success) setAvmResult(data)
      else toast(data.error || 'Erro na avaliação')
    } catch { toast('Erro de ligação.') }
    finally { setAvmLoading(false) }
  }

  async function runRadar() {
    if (!radarUrl.trim()) { toast('Cola um link ou texto.'); return }
    const { setRadarLoading, setRadarResult } = useRadarStore.getState()
    setRadarLoading(true); setRadarResult(null)
    try {
      const res = await fetch('/api/radar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: radarUrl.trim() }) })
      const data = await res.json()
      if (data.success) setRadarResult(data)
      else toast(data.error || 'Erro na análise')
    } catch { toast('Erro de ligação.') }
    finally { setRadarLoading(false) }
  }

  async function runRadarSearch() {
    setSearchLoading(true); setSearchResults(null)
    try {
      const res = await fetch('/api/radar/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zona: searchZona, preco_min: parseFloat(searchPrecoMin) || 0, preco_max: parseFloat(searchPrecoMax) || 0, tipos: searchTipos, fontes: searchFontes, score_min: parseFloat(searchScoreMin) || 65 }) })
      const data = await res.json()
      if (data.success) setSearchResults(data)
      else toast(data.error || 'Erro na busca')
    } catch { toast('Erro de ligação.') }
    finally { setSearchLoading(false) }
  }

  async function runMort(overrides?: { montante?: number; entrada?: number; prazo?: number; spread?: number; uso?: string; rendimento?: number }) {
    const montante = overrides?.montante ?? (parseFloat(mortMontante) || 0)
    const entrada_pct = overrides?.entrada ?? mortEntrada
    const prazo = overrides?.prazo ?? mortPrazo
    const spread = overrides?.spread ?? mortSpreadVal
    const uso = overrides?.uso ?? mortUso
    const rendimento_anual = overrides?.rendimento ?? (parseFloat(mortRendimento) || undefined)
    if (!montante || montante < 10000) return
    if (overrides) {
      if (overrides.montante !== undefined) setMortMontante(String(overrides.montante))
      if (overrides.entrada !== undefined) setMortEntrada(overrides.entrada)
      if (overrides.prazo !== undefined) setMortPrazo(overrides.prazo)
      if (overrides.spread !== undefined) setMortSpreadVal(overrides.spread)
      if (overrides.uso !== undefined) setMortUso(overrides.uso as 'habitacao_propria' | 'investimento')
      if (overrides.rendimento !== undefined) setMortRendimento(String(overrides.rendimento))
    }
    setMortLoading(true); setMortResult(null)
    try {
      const body: Record<string, unknown> = { montante, entrada_pct, prazo, spread, uso }
      if (rendimento_anual) body.rendimento_anual = rendimento_anual
      const res = await fetch('/api/mortgage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.success) setMortResult(data)
      else toast(data.error || 'Erro no cálculo')
    } catch { toast('Erro de ligação.') }
    finally { setMortLoading(false) }
  }

  async function runNHR(overrides?: { pais?: string; tipo?: string; rend?: number; fonte?: boolean }) {
    const pais = overrides?.pais ?? nhrPais
    const tipo = overrides?.tipo ?? nhrTipo
    const rendimento = overrides?.rend ?? (parseFloat(nhrRend) || 0)
    const fonte = overrides?.fonte ?? nhrFonte
    if (!rendimento || rendimento < 1000) return
    if (overrides) {
      if (overrides.pais) setNhrPais(overrides.pais)
      if (overrides.tipo) setNhrTipo(overrides.tipo)
      if (overrides.rend) setNhrRend(String(overrides.rend))
      if (overrides.fonte !== undefined) setNhrFonte(overrides.fonte)
    }
    setNhrLoading(true); setNhrResult(null)
    try {
      const res = await fetch('/api/nhr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pais, tipo_rendimento: tipo, rendimento_anual: rendimento, regime: 'compare', fonte_estrangeira: fonte }) })
      const data = await res.json()
      if (data.success) setNhrResult(data)
    } catch (e) {
      setNhrResult({ error: 'Erro de ligação. Tente novamente.' })
    } finally { setNhrLoading(false) }
  }

  async function runPortfolio() {
    const items = portItems.filter(x => x.trim())
    if (items.length < 2) { toast('Introduz pelo menos 2 imóveis.'); return }
    setPortLoading(true); setPortResult(null)
    try {
      const res = await fetch('/api/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ properties: items.map(url => ({ url, zona: 'Lisboa', area: 100, preco: 1, tipologia: 'T2', estado: 'usado_bom' })) }) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.success) {
        // Map API response shape → ComparisonResult display shape
        const ranking = Array.isArray(data.ranking) ? data.ranking : []
        const mapped = {
          properties: ranking.map((r: Record<string, unknown>) => ({
            name: String(r.zona_match ?? r.zona ?? `Imóvel ${r.id}`),
            price: Number(r.preco_pedido ?? 0),
            yield: Number((r.avaliacao as Record<string, unknown>)?.yield_real_ajustado_pct ?? 0),
            score: Number(r.score_total ?? 0),
          })),
          winner: ranking.length > 0 ? String(ranking[0].zona_match ?? ranking[0].zona ?? '') : undefined,
          recommendation: data.melhor_pick ? `Score ${data.melhor_pick.score}/100 — ${data.melhor_pick.classificacao}. Yield ${(data.melhor_pick as Record<string, unknown>).yield_real_pct ?? ''}% · ROI 5 anos ${(data.melhor_pick as Record<string, unknown>).roi_5_anos_pct ?? ''}%` : undefined,
          summary: data.resumo_portfolio ? `Portfolio: ${data.properties_analisadas} imóveis · Total ${data.resumo_portfolio.total_investimento ? `€${(data.resumo_portfolio.total_investimento / 1e6).toFixed(2)}M` : '—'} · Yield ${data.resumo_portfolio.yield_portfolio_pct ?? '—'}%` : undefined,
          _raw: data,
        }
        setPortResult(mapped)
      } else toast(data.error || 'Erro')
    } catch { toast('Erro de ligação.') }
    finally { setPortLoading(false) }
  }

  async function runMarketing() {
    if (!mktInput.zona || !mktInput.preco) { toast('Preenche pelo menos zona e preço.'); return }
    setMktLoading(true); setMktResult(null); setMktSeoScore(null); setMktPhotoInsights(null)
    try {
      const body = { ...mktInput, fotos_count: mktPhotos.length, fotos_base64: mktPhotos.slice(0, 4), video_url: mktVideoUrl, listing_url: mktListingUrl, persona: mktPersona, idiomas: mktLangs.length > 0 ? mktLangs : ['pt', 'en', 'fr'] }
      const res = await fetch('/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.success) {
        setMktResult(data.content)
        setMktSeoScore(data.seo_score ?? null)
        setMktPhotoInsights(data.photo_insights ?? null)
        setMktPostingSchedule(data.posting_schedule ?? null)
        setMktCharCounts(data.char_counts ?? null)
        setMktCharLimits(data.char_limits ?? null)
        if (mktLangs.length > 0 && !mktLangs.includes(mktLang)) setMktLangStore(mktLangs[0])
      } else { toast(data.error || 'Erro na geração') }
    } catch { toast('Erro de ligação.') }
    finally { setMktLoading(false) }
  }

  async function autoFillFromUrl() {
    if (!mktListingUrl.trim()) return
    setMktAutoFilling(true)
    try {
      const res = await fetch('/api/radar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: mktListingUrl }) })
      const data = await res.json()
      if (data.success && data.analise) {
        const a = data.analise as Record<string, unknown>
        const { setMktInput } = useMarketingStore.getState()
        setMktInput({ zona: String(a.zona || ''), tipo: String(a.tipologia || ''), area: String(a.area_m2 || ''), preco: String(a.preco_pedido || ''), quartos: String(a.quartos || '') })
      }
    } catch { } finally { setMktAutoFilling(false) }
  }

  function startVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { toast('O teu browser não suporta reconhecimento de voz. Usa Chrome.'); return }
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    const recognition = new (SR as new () => { lang: string; continuous: boolean; interimResults: boolean; onresult: (e: unknown) => void; onend: () => void; start: () => void })()
    recognition.lang = 'pt-PT'; recognition.continuous = false; recognition.interimResults = false
    recognition.onresult = (e: unknown) => {
      const ev = e as { results: { [0]: { [0]: { transcript: string } } } }
      const { mktInput: mi, setMktInput: smi } = useMarketingStore.getState()
      smi({ descricao: mi.descricao ? mi.descricao + ' ' + ev.results[0][0].transcript : ev.results[0][0].transcript })
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)
    setIsListening(true)
    recognition.start()
  }

  function copyContent() {
    const { mktResult: mr, mktFormat: mf, mktLang: ml } = useMarketingStore.getState()
    const content = mr && mr[mf] ? (mr[mf] as Record<string, string>)[ml] || '' : ''
    navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  function handlePhotoUpload(files: FileList | null) {
    if (!files) return
    Array.from(files).slice(0, 10).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = e => {
        if (e.target?.result) {
          const { mktPhotos: current, setMktPhotos } = useMarketingStore.getState()
          setMktPhotos([...current, e.target!.result as string].slice(0, 10))
        }
      }
      reader.readAsDataURL(file)
    })
  }

  async function runInvestorPitch() {
    if (!ipProperty) return
    setIpLoading(true); setIpResult(null); setIpError(null)
    try {
      const property = (PORTAL_PROPERTIES as Record<string, unknown>[]).find(p => String(p.id) === ipProperty)
      if (!property) {
        setIpError('Imóvel não encontrado')
      } else {
        const res = await fetch('/api/investor-pitch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ property, investorType: ipInvestorType, horizon: ipHorizon, irrTarget: ipIrr, language: ipLang }) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (data.success) setIpResult(data.pitch)
        else setIpError(data.error || 'Erro ao gerar pitch')
      }
    } catch (err) { setIpError(err instanceof Error ? err.message : 'Erro de ligação.') }
    finally { setIpLoading(false) }
  }

  async function enviarJuridico(texto?: string) {
    let pergunta = (texto ?? jurInput).trim()
    if (!pergunta || jurLoading) return
    if (jurMode === 'memo' && !pergunta.startsWith('MEMO:')) pergunta = 'MEMO: ' + pergunta
    setJurInput('')
    const ts = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    const novas: JurMsg[] = [...jurMsgs, { role: 'user', content: pergunta, ts, mode: jurMode === 'memo' ? 'memo' : undefined }]
    setJurMsgs(novas)
    setJurLoading(true); setJurWebSearch(false)
    try {
      const res = await fetch('/api/juridico', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: novas.map(m => ({ role: m.role, content: m.content })) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro HTTP ${res.status}`)
      if (data.success) {
        setJurWebSearch(data.webSearch ?? false)
        setJurMsgs(prev => [...prev, { role: 'assistant', content: data.resposta, webSearch: data.webSearch, ts: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }])
      } else {
        setJurMsgs(prev => [...prev, { role: 'assistant', content: `Erro: ${data.error || 'Resposta inválida do servidor'}`, ts: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }])
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erro desconhecido'
      setJurMsgs(prev => [...prev, { role: 'assistant', content: `Erro de ligação: ${errMsg}. Tenta novamente.`, ts: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }])
    } finally { setJurLoading(false) }
  }

  function exportarJuridico() {
    const texto = jurMsgs.map(m => `[${m.ts}] ${m.role === 'user' ? 'AGENTE' : 'CONSULTOR IA'}\n${m.content}`).join('\n\n─────────────────────────────────\n\n')
    const blob = new Blob([`CONSULTOR JURÍDICO IA — Agency Group (AMI 22506)\n${'═'.repeat(50)}\n${new Date().toLocaleDateString('pt-PT')}\n\n${texto}`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `juridico-${new Date().toISOString().split('T')[0]}.txt`; a.click(); URL.revokeObjectURL(url)
  }

  async function runDealRisk(dealId: number) {
    const { setDealRiskLoading, setDealRiskAnalysis } = useDealStore.getState()
    const deal = useDealStore.getState().deals.find(d => d.id === dealId)
    if (!deal) return
    setDealRiskLoading(true); setDealRiskAnalysis(null)
    try {
      const res = await fetch('/api/agent/deal-risk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal }) })
      const data = await res.json()
      if (data.success) setDealRiskAnalysis(data.analysis)
    } catch (e) {
      setDealRiskAnalysis({ error: 'Erro de ligação. Tente novamente.' })
    } finally { setDealRiskLoading(false) }
  }

  async function runDealNego(dealId: number) {
    const { setDealNegoLoading, setDealNego } = useDealStore.getState()
    const deal = useDealStore.getState().deals.find(d => d.id === dealId)
    if (!deal) return
    setDealNegoLoading(true); setDealNego(null)
    try {
      const res = await fetch('/api/agent/negotiation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal }) })
      const data = await res.json()
      if (data.success) setDealNego(data.strategy)
    } catch (e) {
      setDealNego({ error: 'Erro de ligação. Tente novamente.' })
    } finally { setDealNegoLoading(false) }
  }

  // Sofia
  async function sofiaConnect() {
    setSofiaLoading(true); setSofiaError(null)
    try {
      const res = await fetch('/api/sofia/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: sofiaLang }) })
      const data = await res.json()
      // API returns session_id (snake_case); also accept mock/demo sessions
      const sid = data.session_id || data.sessionId
      if (sid) {
        setSofiaSessionId(sid)
        setSofiaConnected(true)
      } else { setSofiaError(data.error || data.message || 'Erro ao conectar Sofia') }
    } catch { setSofiaError('Erro de ligação.') }
    finally { setSofiaLoading(false) }
  }

  function sofiaDisconnect() {
    if (sofiaPeerRef.current) { sofiaPeerRef.current.close(); sofiaPeerRef.current = null }
    setSofiaConnected(false); setSofiaSessionId(null); setSofiaError(null); setSofiaSpeaking(false)
  }

  async function sofiaSpeak() {
    if (!sofiaSessionId || !sofiaText.trim()) return
    setSofiaSpeaking(true)
    try {
      await fetch('/api/sofia/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sofiaSessionId, text: sofiaText, language: sofiaLang }) })
    } catch { } finally { setTimeout(() => setSofiaSpeaking(false), 3000) }
  }

  async function sofiaGenerateScript() {
    if (!sofiaPropSel) return
    setSofiaScriptLoading(true)
    try {
      const property = (PORTAL_PROPERTIES as Record<string, unknown>[]).find(p => String(p.id) === sofiaPropSel)
      const res = await fetch('/api/sofia/script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ property, language: sofiaLang }) })
      const data = await res.json()
      if (data.script) setSofiaText(data.script)
    } catch (e) {
      setSofiaText('Erro de ligação. Tente novamente.')
    } finally { setSofiaScriptLoading(false) }
  }

  // ── EFFECTS ──────────────────────────────────────────────────────────────────

  // Dark mode
  useEffect(() => {
    const stored = localStorage.getItem('ag_dark_mode')
    if (stored === '1') setDarkMode(true)
    else if (stored === '0') setDarkMode(false)
  }, [setDarkMode])
  useEffect(() => {
    localStorage.setItem('ag_dark_mode', darkMode ? '1' : '0')
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [darkMode])

  // Auth gate — magic link token in URL → verify → set localStorage + cookie → ready
  // Fallback: localStorage session → ready
  // Fallback 2: /api/auth/me (reads httpOnly cookie) → sync localStorage → ready
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      const authAbort = new AbortController()
      fetch(`/api/auth/verify?token=${encodeURIComponent(urlToken)}`, {
        signal: authAbort.signal,
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      })
        .then(r => r.json())
        .then(data => {
          if (data.ok && data.email) {
            localStorage.setItem('ag_auth', JSON.stringify({ v: '1', exp: Date.now() + 8 * 60 * 60 * 1000, email: data.email, token: urlToken }))
            window.history.replaceState({}, '', '/portal')
            setAgentEmail(data.email)
            const n = data.email.split('@')[0].split('.')[0]
            setAgentName(n.charAt(0).toUpperCase() + n.slice(1))
            setReady(true)
          } else {
            window.location.href = '/portal/login'
          }
        })
        .catch(e => { if (e.name !== 'AbortError') { window.location.href = '/portal/login' } })
      return () => authAbort.abort()
    }

    // localStorage hint: pre-populate email/name for faster display only.
    // SECURITY: do NOT call setReady(true) here and do NOT return early.
    // Without a server check, a cached /portal page (browser cache, especially
    // IE) combined with unexpired localStorage bypasses the middleware auth
    // check entirely — the portal would render with zero server-side validation.
    // We always fall through to /api/auth/me which verifies the httpOnly cookie.
    const stored = localStorage.getItem('ag_auth')
    if (stored) {
      try {
        const d = JSON.parse(stored)
        if (d.v === '1' && Date.now() < d.exp && d.email) {
          // Pre-fill name/email so the UI can show them instantly once ready —
          // but readiness is gated on the server confirming the cookie below.
          setAgentEmail(d.email)
          const n = d.email.split('@')[0].split('.')[0]
          setAgentName(n.charAt(0).toUpperCase() + n.slice(1))
        } else {
          localStorage.removeItem('ag_auth') // evict expired entry
        }
      } catch { localStorage.removeItem('ag_auth') }
    }

    // Server auth check — this is the security gate. /api/auth/me reads the
    // httpOnly ag-auth-token cookie (set by /api/auth/verify after approval).
    // setReady(true) is only called here, never from the localStorage path.
    // cache:'no-store' + credentials:'include' ensure Edge (and all browsers)
    // always hit the server fresh — never serve a cached positive auth response.
    const meAbort = new AbortController()
    fetch('/api/auth/me', { signal: meAbort.signal, cache: 'no-store', credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.email) {
          localStorage.setItem('ag_auth', JSON.stringify({ v: '1', exp: Date.now() + 8 * 60 * 60 * 1000, email: data.email, token: '' }))
          setAgentEmail(data.email)
          const n = data.email.split('@')[0].split('.')[0]
          setAgentName(n.charAt(0).toUpperCase() + n.slice(1))
          setReady(true)
        } else {
          localStorage.removeItem('ag_auth')
          window.location.href = '/portal/login'
        }
      })
      .catch(e => { if (e.name !== 'AbortError') window.location.href = '/portal/login' })
    return () => meAbort.abort()
  }, [])

  // Load deals
  useEffect(() => {
    if (!agentEmail) return
    const stored = localStorage.getItem(`ag_deals_${agentEmail}`)
    if (stored) { try { setDeals(JSON.parse(stored)) } catch { } }
  }, [agentEmail, setDeals])

  // Load CRM
  useEffect(() => {
    if (!agentEmail) return
    const stored = localStorage.getItem(`ag_crm_${agentEmail}`)
    if (stored) { try { setCrmContacts(JSON.parse(stored)) } catch { } }
    const ac = new AbortController()
    fetch(`/api/notion/contacts?agent=${encodeURIComponent(agentEmail)}`, { signal: ac.signal })
      .then(r => r.json())
      .then(data => {
        if (data.contacts && data.contacts.length > 0) {
          setCrmContacts(data.contacts)
          localStorage.setItem(`ag_crm_${agentEmail}`, JSON.stringify(data.contacts))
        }
      })
      .catch(e => { if (e.name !== 'AbortError') console.warn('[CRM] notion sync failed', e) })
    return () => ac.abort()
  }, [agentEmail, setCrmContacts])

  // Load imoveis
  useEffect(() => {
    if (!ready) return
    const saved = localStorage.getItem(`ag_imoveis_${agentEmail}`)
    if (saved) { try { setImoveisList(JSON.parse(saved)) } catch { } }
    else { setImoveisList(PORTAL_PROPERTIES) }
  }, [ready, agentEmail])

  // Cmd+K shortcut
  useEffect(() => {
    const { setCmdkOpen, setCmdkQuery } = useUIStore.getState()
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdkOpen(true); setCmdkQuery('') }
      if (e.key === 'Escape') { setCmdkOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Section transition ref ────────────────────────────────────────────────────
  const mainContentRef = useRef<HTMLElement>(null)

  // ── GSAP section transition — runs on every section change ───────────────────
  useEffect(() => {
    if (!mainContentRef.current) return
    import('gsap').then(({ gsap }) => {
      gsap.fromTo(
        mainContentRef.current!,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out', clearProps: 'transform' }
      )
    })
  }, [section])

  // ── Animated navigation ───────────────────────────────────────────────────────
  const navigateTo = useCallback((newSection: SectionId) => {
    if (!mainContentRef.current) {
      setSection(newSection)
      return
    }
    import('gsap').then(({ gsap }) => {
      gsap.to(mainContentRef.current!, {
        opacity: 0, y: -8,
        duration: 0.18, ease: 'power2.in',
        onComplete: () => {
          setSection(newSection)
          // Entry animation triggered by the section useEffect above
        }
      })
    })
  }, [setSection])

  // ── WEEKLY REPORT ─────────────────────────────────────────────────────────────

  async function handleWeeklyReport() {
    if (weeklyReport) { setWeeklyReport(null); return }
    setWeeklyReportLoading(true)
    try {
      const today2 = new Date()
      const period = `Semana de ${today2.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}`
      const res = await fetch('/api/agent/weekly-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: agentName, deals: deals, contacts: crmContacts, properties: imoveisList, period }) })
      const d = await res.json()
      if (d.report) setWeeklyReport(d.report)
    } catch { } finally { setWeeklyReportLoading(false) }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0c1f15', fontFamily: 'Cormorant,serif', fontSize: '1.5rem', color: '#c9a96e', letterSpacing: '.1em' }}>
      A carregar...
    </div>
  )

  return (
    <>
      <PortalBootstrap />
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
          {toasts.map(t => (
            <div key={t.id} style={{ background: '#1c4a35', color: '#f4f0e6', padding: '10px 16px', fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.06em', boxShadow: '0 4px 16px rgba(0,0,0,.25)', maxWidth: 320, lineHeight: 1.5 }}>
              {t.msg}
            </div>
          ))}
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-jost),sans-serif;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(14,14,13,.15);border-radius:2px}
        .p-inp{width:100%;background:#fff;border:1px solid rgba(14,14,13,.12);padding:10px 14px;font-family:var(--font-jost),sans-serif;font-size:.83rem;color:#0e0e0d;outline:none;transition:border .2s}
        .p-inp:focus{border-color:#1c4a35}
        .p-sel{width:100%;background:#fff;border:1px solid rgba(14,14,13,.12);padding:10px 14px;font-family:var(--font-jost),sans-serif;font-size:.83rem;color:#0e0e0d;outline:none;cursor:pointer;appearance:none}
        .p-btn{background:#1c4a35;color:#f4f0e6;border:none;padding:12px 24px;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:background .2s}
        .p-btn:hover{background:#163d2c}.p-btn:disabled{opacity:.5;cursor:not-allowed}
        .p-btn-gold{background:#c9a96e;color:#0c1f15}.p-btn-gold:hover{background:#b8945a}
        .p-label{font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(14,14,13,.4);margin-bottom:6px;display:block}
        .p-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px}
        .p-result-val{font-family:var(--font-cormorant),serif;font-size:2.4rem;font-weight:300;color:#1c4a35;line-height:1}
        .mkt-tab{padding:8px 16px;font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.14em;text-transform:uppercase;border:1px solid rgba(14,14,13,.12);background:none;cursor:pointer;transition:all .2s;color:rgba(14,14,13,.5)}
        .mkt-tab.active{background:#1c4a35;color:#f4f0e6;border-color:#1c4a35}
        .mkt-result{background:#fff;border:1px solid rgba(14,14,13,.1);padding:20px;min-height:120px;font-size:.83rem;line-height:1.8;color:#0e0e0d;white-space:pre-wrap;font-family:var(--font-jost),sans-serif}
        .deal-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:16px 20px;cursor:pointer;transition:all .2s;border-radius:10px;box-shadow:0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)}
        .deal-card:hover{border-color:#1c4a35;box-shadow:0 4px 16px rgba(14,14,13,.08),0 2px 6px rgba(14,14,13,.04)}.deal-card.active{border-color:#c9a96e;border-width:2px}
        .check-item{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(14,14,13,.05);font-size:.8rem;color:rgba(14,14,13,.7);cursor:pointer;transition:color .2s}
        .check-item:hover{color:#0e0e0d}.check-item.done{color:rgba(14,14,13,.35);text-decoration:line-through}
        .doc-item{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(14,14,13,.06)}
        .kpi-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:20px 24px}
        .kpi-val{font-family:var(--font-cormorant),serif;font-size:2rem;font-weight:300;color:#1c4a35;line-height:1}
        .kpi-label{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(14,14,13,.4);margin-top:6px}
        .nav-item{display:flex;align-items:center;gap:10px;padding:7px 16px;cursor:pointer;transition:all .2s;border-radius:4px;margin:1px 8px;font-size:.75rem;color:rgba(244,240,230,.45);letter-spacing:.04em}
        .nav-item:hover{background:rgba(244,240,230,.06);color:rgba(244,240,230,.8)}.nav-item.active{background:rgba(201,169,110,.15);color:#c9a96e}
        .port-card{border:1px solid rgba(14,14,13,.08);padding:16px;background:#fff}.port-card.top{border-color:#c9a96e}
        @keyframes jdot{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-4px);opacity:1}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes soundBar{0%{height:4px;opacity:.5}100%{height:18px;opacity:1}}
        .mkt-input-tab{padding:8px 16px;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:rgba(14,14,13,.4);transition:all .2s}
        .mkt-input-tab.active{color:#1c4a35;border-bottom-color:#1c4a35}
        .crm-contact-row{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(14,14,13,.06);transition:background .15s}
        .crm-contact-row:hover{background:rgba(28,74,53,.04)}.crm-contact-row.active{background:rgba(201,169,110,.08);border-left:3px solid #c9a96e}
        .crm-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-dm-mono),monospace;font-size:.56rem;font-weight:400;flex-shrink:0;letter-spacing:.04em}
        .crm-status{display:inline-flex;align-items:center;padding:2px 8px;font-family:var(--font-dm-mono),monospace;font-size:.42rem;letter-spacing:.1em;text-transform:uppercase}
        .crm-stat-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:16px 20px;flex:1}
        .crm-profile-tab{padding:8px 16px;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:rgba(14,14,13,.4);transition:all .2s}
        .crm-profile-tab.active{color:#1c4a35;border-bottom-color:#1c4a35}
        .deal-tab{padding:9px 18px;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:rgba(14,14,13,.4);transition:all .2s}
        .deal-tab.active{color:#1c4a35;border-bottom-color:#1c4a35}
        .inv-metric{background:#fff;border:1px solid rgba(14,14,13,.08);padding:14px 18px}
        .inv-scenario{border:1px solid rgba(14,14,13,.1);padding:14px;flex:1;min-width:120px;text-align:center;transition:border .2s}
        .inv-scenario.best{border-color:#c9a96e;background:rgba(201,169,110,.04)}
        .photo-drop{border:2px dashed rgba(14,14,13,.15);padding:32px;text-align:center;cursor:pointer;transition:border .2s;background:rgba(14,14,13,.02)}
        .photo-drop:hover{border-color:#1c4a35}.photo-drop.drag{border-color:#c9a96e;background:rgba(201,169,110,.05)}
        .photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
        .photo-thumb{position:relative;padding-bottom:100%;background:#f0ede4;overflow:hidden}
        .photo-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .photo-remove{position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);border:none;color:#fff;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center}
        .action-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:20px;cursor:pointer;transition:all .25s;display:flex;flex-direction:column;gap:8px}
        .action-card:hover{border-color:#1c4a35;transform:translateY(-2px);box-shadow:0 8px 24px rgba(14,14,13,.08)}
        .hamburger{display:none;background:none;border:none;cursor:pointer;padding:8px;flex-direction:column;gap:5px;align-items:center;justify-content:center}
        .hamburger span{display:block;width:20px;height:2px;background:#0e0e0d;transition:all .3s;border-radius:1px}
        .mobile-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9}
        @media(max-width:900px){.hamburger{display:flex}.mobile-overlay.show{display:block}.portal-main{flex-direction:column}.portal-sidebar{position:fixed;left:0;top:0;bottom:0;z-index:10;transform:translateX(-100%);transition:transform .3s ease}.portal-sidebar.open{transform:translateX(0)}.p-card{padding:16px}.kpi-val{font-size:1.5rem}}
        @media(max-width:768px){.kpi-grid{grid-template-columns:1fr 1fr!important}.actions-grid{grid-template-columns:1fr 1fr!important}.mkt-grid{grid-template-columns:1fr!important}.p-two-col{grid-template-columns:1fr!important}.crm-layout{flex-direction:column}.crm-list{width:100%!important;min-width:unset!important;border-right:none!important;border-bottom:1px solid rgba(14,14,13,.08)!important}.pipeline-section{overflow-x:auto}}
        html.dark .kpi-card{background:#122a1a;border-color:rgba(201,169,110,.12)}
        html.dark .kpi-val{color:#c9a96e!important}
        html.dark .action-card{background:#122a1a;border-color:rgba(201,169,110,.12);color:rgba(244,240,230,.8)}
        html.dark .deal-card{background:#122a1a;border-color:rgba(201,169,110,.12)}
        html.dark .mkt-result{background:#0e2416;border-color:rgba(201,169,110,.12);color:rgba(244,240,230,.85)}
        html.dark .p-card{background:#122a1a;border-color:rgba(201,169,110,.12)}
        html.dark .check-item{color:rgba(244,240,230,.65);border-bottom-color:rgba(244,240,230,.06)}
        html.dark .doc-item{border-bottom-color:rgba(244,240,230,.06)}
        html.dark .crm-contact-row{border-bottom-color:rgba(244,240,230,.06)}
        html.dark .crm-stat-card{background:#122a1a;border-color:rgba(201,169,110,.12)}
        html.dark .deal-tab{color:rgba(244,240,230,.35)}html.dark .deal-tab.active{color:#c9a96e;border-bottom-color:#c9a96e}
        html.dark input,html.dark select,html.dark textarea{background:#0e2416!important;border-color:rgba(201,169,110,.2)!important;color:#f4f0e6!important}
        html.dark input::placeholder,html.dark textarea::placeholder{color:rgba(244,240,230,.3)!important}
        html.dark .portal-main [style*="background:#fff"]{background:#122a1a!important}
        html.dark .portal-main [style*="color:#0e0e0d"]{color:rgba(244,240,230,.88)!important}
        html.dark .portal-main [style*="color:#1c4a35"]{color:#6fcf97!important}
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden' }} className={`portal-main${darkMode ? ' dark bg-gray-950 text-gray-100' : ''}`}>

        {/* Mobile overlay */}
        <div className={`mobile-overlay${sidebarOpen ? ' show' : ''}`} onClick={() => setSidebarOpen(false)} />

        {/* Sidebar */}
        <PortalSidebar
          agentName={agentName}
          section={section}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          setSection={(s) => navigateTo(s as SectionId)}
          logout={logout}
        />

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: darkMode ? '#0f2518' : '#f4f0e6' }}>

          {/* Command Palette — Cmd+K / Ctrl+K */}
          {ready && (
            <PortalCommandPalette
              onSetSection={setSection}
              darkMode={darkMode}
              agentName={agentName}
            />
          )}

          {/* Header */}
          <PortalHeader
            section={section}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            setSection={(s) => navigateTo(s as SectionId)}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            deals={deals}
            crmContacts={crmContacts}
            imoveisList={imoveisList}
            showNotifPanel={showNotifPanel}
            setShowNotifPanel={(v) => useUIStore.setState({ showNotifPanel: v })}
            setActiveCrmId={setActiveCrmId}
            setCrmProfileTab={setCrmProfileTab}
          />

          {/* Content */}
          <main ref={mainContentRef} style={{ flex: 1, overflowY: (section === 'juridico' || section === 'sofia') ? 'hidden' : 'auto', padding: (section === 'juridico' || section === 'sofia') ? '0' : '32px', display: 'flex', flexDirection: 'column' }}>

            {section === 'dashboard' && (
              <PortalDashboard
                agentName={agentName}
                imoveisList={imoveisList}
                weeklyReport={weeklyReport}
                weeklyReportLoading={weeklyReportLoading}
                onWeeklyReport={handleWeeklyReport}
                onCloseWeeklyReport={() => setWeeklyReport(null)}
                exportToPDF={exportToPDF}
                onSetSection={(s) => navigateTo(s)}
                onSetPriceHistoryId={setPriceHistoryId}
              />
            )}

            {section === 'avm' && (
              <PortalAVM onRunAVM={runAVM} />
            )}

            {section === 'credito' && (
              <PortalMortgage onRunMort={runMort} />
            )}

            {section === 'nhr' && (
              <PortalNHR onRunNHR={runNHR} />
            )}

            {section === 'pipeline' && (
              <PortalPipeline
                onToggleCheck={toggleCheck}
                onChangeFase={changeFase}
                onAddDeal={addDealAction}
                onDealRisk={runDealRisk}
                onDealNego={runDealNego}
                exportToPDF={exportToPDF}
              />
            )}

            {section === 'marketing' && (
              <PortalMarketing
                onRunMarketing={runMarketing}
                onAutoFillFromUrl={autoFillFromUrl}
                onStartVoice={startVoice}
                onCopyContent={copyContent}
                onPhotoUpload={handlePhotoUpload}
              />
            )}

            {section === 'radar' && (
              <PortalRadar
                onRunRadar={runRadar}
                onRunRadarSearch={runRadarSearch}
                onGerarPDF={gerarPDF}
              />
            )}

            {section === 'portfolio' && (
              <PortalPortfolio onRunPortfolio={runPortfolio} />
            )}

            {section === 'investorpitch' && (
              <PortalInvestorPitch
                onRunInvestorPitch={runInvestorPitch}
                exportToPDF={exportToPDF}
              />
            )}

            {section === 'sofia' && (
              <PortalSofia
                sofiaSessionId={sofiaSessionId}
                sofiaConnected={sofiaConnected}
                sofiaLoading={sofiaLoading}
                sofiaSpeaking={sofiaSpeaking}
                sofiaText={sofiaText}
                sofiaError={sofiaError}
                sofiaScriptLoading={sofiaScriptLoading}
                sofiaPropSel={sofiaPropSel}
                sofiaLang={sofiaLang}
                sofiaVideoRef={sofiaVideoRef}
                setSofiaText={setSofiaText}
                setSofiaPropSel={setSofiaPropSel}
                setSofiaLang={setSofiaLang}
                onConnect={sofiaConnect}
                onDisconnect={sofiaDisconnect}
                onSpeak={sofiaSpeak}
                onGenerateScript={sofiaGenerateScript}
              />
            )}

            {section === 'juridico' && (
              <PortalJuridico
                jurMsgs={jurMsgs}
                jurInput={jurInput}
                jurLoading={jurLoading}
                jurWebSearch={jurWebSearch}
                jurMode={jurMode}
                setJurInput={setJurInput}
                setJurMode={setJurMode}
                onEnviar={enviarJuridico}
                onExportar={exportarJuridico}
              />
            )}

            {section === 'agenda' && (
              <PortalAgenda exportToICS={exportToICS} />
            )}

            {section === 'documentos' && (
              <PortalDocumentos onExportPDF={exportToPDF} />
            )}

            {section === 'imt' && (
              <PortalIMT />
            )}

            {section === 'comissoes' && (
              <PortalComissoes />
            )}

            {section === 'visitas' && (
              <PortalVisitas />
            )}

            {section === 'maisvalias' && (
              <PortalMaisvalias />
            )}

            {section === 'financiamento' && (
              <PortalFinanciamento />
            )}

            {section === 'homestaging' && (
              <PortalHomestaging />
            )}

            {section === 'crm' && (
              <PortalCRM />
            )}

            {section === 'exitSim' && (
              <PortalExitSim />
            )}

            {section === 'pulse' && (
              <PortalPulse />
            )}

            {section === 'imoveis' && (
              <PortalImoveis onSave={saveImoveis} />
            )}

            {section === 'campanhas' && (
              <PortalCampanhas />
            )}

            {section === 'crossCompare' && (
              <PortalCrossCompare />
            )}

            {section === 'voz' && (
              <PortalVoz />
            )}

            {section === 'collections' && (
              <PortalCollections />
            )}

            {section === 'draftOffer' && (
              <PortalDraftOffer />
            )}

            {section === 'analytics' && (
              <PortalAnalytics />
            )}

            {section === 'investidores' && (
              <PortalInvestidores />
            )}

            {section === 'outbound' && (
              <PortalOutbound />
            )}

            {section === 'offmarket' && (
              <PortalOffmarketLeads />
            )}

            {section === 'partners' && (
              <PortalPartners />
            )}

            {section === 'dealdesk' && (
              <PortalDealDesk />
            )}

            {section === 'videoStudio' && (
              <PortalVideoStudio />
            )}

            {section === 'photos' && (
              <PortalPhotoScorer />
            )}

            {section === 'agentai' && (
              <PortalAgentAI />
            )}

            {/* Price history modal */}
            {priceHistoryId && (
              <PriceHistoryWidget
                url={priceHistoryId}
              />
            )}

            {/* Sections not yet extracted — show placeholder */}

          </main>
        </div>
      </div>
    </>
  )
}
