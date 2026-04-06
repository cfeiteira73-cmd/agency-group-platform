// ─── Utility / Helper Functions for Agency Group Portal ─────────────────────

import type { CRMContact } from './types'

// ── Jurídico Markdown Renderer ───────────────────────────────────────────────
export function renderJurMarkdown(raw: string): string {
  // 1. HTML escape
  let h = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 2. Section dividers (═══ or ---)
  h = h.replace(/[═]{3,}/g, '<div style="height:1px;background:rgba(28,74,53,.15);margin:.7em 0"></div>')
  h = h.replace(/^-{3,}$/gm, '<div style="height:1px;background:rgba(14,14,13,.1);margin:.6em 0"></div>')

  // 3. Headers
  h = h.replace(/^### (.+)$/gm, '<strong style="display:block;font-size:.85rem;color:#1c4a35;margin:.9em 0 .2em;letter-spacing:.04em">$1</strong>')
  h = h.replace(/^## (.+)$/gm, '<strong style="display:block;font-size:.9rem;color:#0e0e0d;margin:1em 0 .3em;border-bottom:1px solid rgba(14,14,13,.1);padding-bottom:.25em">$1</strong>')
  h = h.replace(/^# (.+)$/gm, '<strong style="display:block;font-size:.95rem;color:#0e0e0d;margin:1em 0 .3em">$1</strong>')

  // 4. Bold
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // 5. Italic
  h = h.replace(/\*(.+?)\*/g, '<em style="color:rgba(14,14,13,.7)">$1</em>')

  // 6. Numbered list items
  h = h.replace(/^(\d+)\. (.+)$/gm,
    '<span style="display:flex;gap:7px;margin:.18em 0;align-items:baseline"><b style="color:#1c4a35;font-size:.78rem;min-width:1.3em;flex-shrink:0">$1.</b><span>$2</span></span>')

  // 7. Bullet list items (-, •, *)
  h = h.replace(/^[-•*] (.+)$/gm,
    '<span style="display:flex;gap:7px;margin:.18em 0;align-items:baseline"><span style="color:#c9a96e;font-size:.7em;min-width:.8em;flex-shrink:0;line-height:1.9">●</span><span>$1</span></span>')

  // 8. Base legal line (special pill styling)
  h = h.replace(/((?:Base legal|Base Legal)[:\s].+)$/gm,
    '<span style="display:block;margin-top:.7em;padding:.4em .8em;background:rgba(28,74,53,.06);border-left:2px solid rgba(28,74,53,.35);font-size:.8em;font-style:italic;color:rgba(14,14,13,.6);line-height:1.6">$1</span>')

  // 9. Newlines
  h = h.replace(/\n/g, '<br/>')

  return h
}

// ── CRM Lead Scoring (budget / completeness / source / notes) ─────────────────
export function calcLeadScore(contact: {
  budgetMax?: number | string
  phone?: string
  email?: string
  zone?: string
  source?: string
  notes?: string
  type?: string
  budgetMin?: number | string
}): { score: number; factors: string[]; label: string; color: string } {
  let score = 0
  const factors: string[] = []

  // Budget weight (0-30 points)
  const budget = Number(contact.budgetMax) || 0
  if (budget >= 3000000) { score += 30; factors.push('Budget premium €3M+') }
  else if (budget >= 1000000) { score += 22; factors.push('Budget alto €1M+') }
  else if (budget >= 500000) { score += 15; factors.push('Budget médio €500K+') }
  else if (budget > 0) { score += 8; factors.push('Budget definido') }

  // Contact info completeness (0-20 points)
  if (contact.phone) { score += 8; factors.push('Telefone disponível') }
  if (contact.email) { score += 7; factors.push('Email disponível') }
  if (contact.zone) { score += 5; factors.push('Zona definida') }

  // Source quality (0-20 points)
  const src = (contact.source || '').toLowerCase()
  if (src.includes('referral') || src.includes('referência')) { score += 20; factors.push('Referência de cliente') }
  else if (src.includes('whatsapp') || src.includes('directo')) { score += 15; factors.push('Contacto directo') }
  else if (src.includes('portal') || src.includes('idealista')) { score += 10; factors.push('Portal imobiliário') }
  else if (src.includes('instagram') || src.includes('social')) { score += 7; factors.push('Social media') }
  else { score += 5 }

  // Notes/engagement (0-15 points)
  if (contact.notes && contact.notes.length > 100) { score += 15; factors.push('Perfil detalhado') }
  else if (contact.notes && contact.notes.length > 30) { score += 8; factors.push('Notas existentes') }

  // Type specificity (0-15 points)
  if (contact.type) { score += 10; factors.push('Tipo de imóvel definido') }
  if (contact.budgetMin && contact.budgetMax && Number(contact.budgetMax) - Number(contact.budgetMin) < Number(contact.budgetMax) * 0.5) {
    score += 5; factors.push('Budget preciso')
  }

  score = Math.min(100, score)
  const label = score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : score >= 40 ? 'Cool' : 'Cold'
  const color = score >= 80 ? 'emerald' : score >= 60 ? 'yellow' : score >= 40 ? 'orange' : 'gray'

  return { score, factors, label, color }
}

// ── AI Next Action Recommendation ─────────────────────────────────────────────
export function getAINextAction(contact: {
  status: string
  lastContact: string
  nextFollowUp: string
}): { text: string; urgency: 'high' | 'medium' | 'low' } {
  const daysSinceLast = Math.max(0, Math.floor((Date.now() - new Date(contact.lastContact).getTime()) / 86400000))
  const daysUntilFollowup = Math.floor((new Date(contact.nextFollowUp || '').getTime() - Date.now()) / 86400000)
  if (daysUntilFollowup < 0 && contact.nextFollowUp) return { text: `Follow-up em atraso ${Math.abs(daysUntilFollowup)}d — Ligar agora!`, urgency: 'high' }
  if (daysUntilFollowup === 0) return { text: 'Follow-up hoje — Contactar antes das 18h', urgency: 'high' }
  if (contact.status === 'vip' && daysSinceLast >= 7) return { text: `VIP sem contacto há ${daysSinceLast}d — Enviar update de mercado`, urgency: 'high' }
  if (contact.status === 'prospect' && daysSinceLast >= 5) return { text: `Prospect frio há ${daysSinceLast}d — Partilhar novo imóvel`, urgency: 'medium' }
  if (contact.status === 'lead' && daysSinceLast >= 3) return { text: `Lead sem resposta há ${daysSinceLast}d — Tentar WhatsApp`, urgency: 'medium' }
  if (daysUntilFollowup <= 2) return { text: `Follow-up em ${daysUntilFollowup}d — Preparar proposta`, urgency: 'medium' }
  if (contact.status === 'cliente') return { text: 'Cliente activo — Agendar visita a imóvel em carteira', urgency: 'low' }
  return { text: 'Perfil actualizado — Aguardar resposta', urgency: 'low' }
}

// ── Compute Lead Score (status + recency + follow-up + budget) ────────────────
export function computeLeadScore(contact: {
  status: string
  lastContact: string
  nextFollowUp: string
  budgetMin: number
  budgetMax: number
}): { score: number; label: string; color: string; breakdown: { factor: string; pts: number }[] } {
  const breakdown: { factor: string; pts: number }[] = []
  let score = 0

  // Status score (0-35)
  const statusPts = contact.status === 'vip' ? 35 : contact.status === 'cliente' ? 28 : contact.status === 'prospect' ? 18 : 8
  score += statusPts
  breakdown.push({ factor: `Status (${contact.status})`, pts: statusPts })

  // Recency score (0-30)
  const lastDate = new Date(contact.lastContact)
  const daysSince = Math.max(0, Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)))
  const recencyPts = daysSince <= 1 ? 30 : daysSince <= 7 ? 22 : daysSince <= 30 ? 12 : daysSince <= 90 ? 5 : 0
  score += recencyPts
  breakdown.push({ factor: `Último contacto (${daysSince}d)`, pts: recencyPts })

  // Follow-up urgency (0-25)
  const followDate = new Date(contact.nextFollowUp)
  const daysUntil = Math.floor((followDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const followPts = daysUntil < 0 ? 25 : daysUntil === 0 ? 22 : daysUntil <= 3 ? 15 : daysUntil <= 7 ? 8 : 3
  score += followPts
  breakdown.push({ factor: `Follow-up (${daysUntil < 0 ? 'overdue' : daysUntil + 'd'})`, pts: followPts })

  // Budget alignment bonus (0-10)
  const midBudget = ((Number(contact.budgetMin) || 0) + (Number(contact.budgetMax) || 0)) / 2
  const budgetPts = midBudget >= 500000 ? 10 : midBudget >= 300000 ? 6 : 3
  score += budgetPts
  breakdown.push({ factor: `Budget (€${(midBudget / 1e6).toFixed(1)}M)`, pts: budgetPts })

  score = Math.min(100, score)
  const label = score >= 80 ? '🔥 Hot' : score >= 60 ? '⚡ Warm' : score >= 40 ? '📞 Active' : '💤 Cold'
  const color = score >= 80 ? '#e05454' : score >= 60 ? '#c9a96e' : score >= 40 ? '#4a9c7a' : 'rgba(14,14,13,.3)'
  return { score, label, color, breakdown }
}

// ── PDF Export (opens print window) ─────────────────────────────────────────
export function exportToPDF(title: string, htmlContent: string): void {
  const w = window.open('', '_blank', 'width=960,height=780')
  if (!w) { console.warn('PDF export blocked: allow pop-ups'); return }
  const dateStr = new Date().toLocaleDateString('pt-PT', { year: 'numeric', month: 'long', day: 'numeric' })
  w.document.write(`<!DOCTYPE html><html lang="pt"><head>
    <meta charset="UTF-8"><title>${title} — Agency Group</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:var(--font-jost),sans-serif;color:#0e0e0d;background:#fff;font-size:14px}
      @media print{.no-print{display:none!important}@page{margin:0}}
      .hdr{background:#0c1f15;color:#f4f0e6;padding:28px 40px;display:flex;justify-content:space-between;align-items:center}
      .hdr-brand{font-family:var(--font-cormorant),serif;font-size:1.6rem;font-weight:300;letter-spacing:-.01em}
      .hdr-ami{font-family:var(--font-dm-mono),monospace;font-size:.5rem;color:#c9a96e;letter-spacing:.1em;margin-top:3px}
      .hdr-date{font-family:var(--font-dm-mono),monospace;font-size:.45rem;color:rgba(244,240,230,.45);text-align:right}
      .hdr-title{font-family:var(--font-dm-mono),monospace;font-size:.5rem;color:rgba(244,240,230,.6);letter-spacing:.12em;text-transform:uppercase;margin-top:2px}
      .body{padding:36px 40px}
      .label{font-family:var(--font-dm-mono),monospace;font-size:.45rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(14,14,13,.35);margin-bottom:10px;margin-top:24px}
      .metric{font-family:var(--font-cormorant),serif;font-size:1.8rem;font-weight:600;color:#1c4a35;line-height:1}
      .row{display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap}
      .card{flex:1;min-width:160px;padding:16px 20px;border:1px solid rgba(14,14,13,.1)}
      .tag{display:inline-block;font-family:var(--font-dm-mono),monospace;font-size:.42rem;padding:3px 8px;background:rgba(28,74,53,.08);color:#1c4a35;border:1px solid rgba(28,74,53,.2);letter-spacing:.06em;margin:2px}
      .gold{color:#c9a96e}
      .green{color:#1c4a35}
      .divider{border:none;border-top:1px solid rgba(14,14,13,.08);margin:20px 0}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:rgba(14,14,13,.04);font-family:var(--font-dm-mono),monospace;font-size:.42rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(14,14,13,.5);padding:8px 12px;text-align:left;border-bottom:1px solid rgba(14,14,13,.1)}
      td{padding:10px 12px;font-size:.85rem;border-bottom:1px solid rgba(14,14,13,.05)}
      .ftr{background:rgba(14,14,13,.03);border-top:1px solid rgba(14,14,13,.08);padding:16px 40px;display:flex;justify-content:space-between;align-items:center;margin-top:40px}
      .ftr-text{font-family:var(--font-dm-mono),monospace;font-size:.42rem;color:rgba(14,14,13,.35);letter-spacing:.06em}
      .print-btn{position:fixed;bottom:24px;right:24px;background:#c9a96e;color:#0c1f15;border:none;padding:12px 24px;cursor:pointer;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;box-shadow:0 4px 20px rgba(0,0,0,.15)}
      .print-btn:hover{background:#b8904a}
    </style>
  </head><body>
    <button type="button" class="print-btn no-print" onclick="window.print()">⬇ IMPRIMIR / PDF</button>
    <div class="hdr">
      <div>
        <div class="hdr-brand">Agency Group</div>
        <div class="hdr-ami">AMI 22506 · LUXO PREMIUM</div>
        <div class="hdr-title">${title}</div>
      </div>
      <div class="hdr-date">${dateStr}</div>
    </div>
    <div class="body">${htmlContent}</div>
    <div class="ftr">
      <span class="ftr-text">Agency Group · AMI 22506 · Comissão 5% · www.agencygroup.pt</span>
      <span class="ftr-text">Documento gerado em ${dateStr} · Confidencial</span>
    </div>
  </body></html>`)
  w.document.close()
}

// ── ICS Calendar Export ───────────────────────────────────────────────────────
export function exportToICS(events: { title: string; date: string; time?: string; description?: string }[]): void {
  const pad = (n: number) => String(n).padStart(2, '0')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agency Group//Portal 2026//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  events.forEach((ev, i) => {
    const d = ev.date.replace(/-/g, '')
    const h = ev.time ? ev.time.split(':')[0] : '09'
    const m = ev.time ? ev.time.split(':')[1] : '00'
    const dtStart = ev.time ? `${d}T${h}${m}00` : d
    const dtEnd = ev.time ? `${d}T${pad(Math.min(23, parseInt(h) + 1))}${m}00` : d
    lines.push('BEGIN:VEVENT',
      `UID:ag-${Date.now()}-${i}@agencygroup.pt`,
      `DTSTART${ev.time ? '' : ';VALUE=DATE'}:${dtStart}`,
      `DTEND${ev.time ? '' : ';VALUE=DATE'}:${dtEnd}`,
      `SUMMARY:${(ev.title || '').replace(/,/g, '\\,')}`,
      `DESCRIPTION:${(ev.description || 'Agency Group — AMI 22506').replace(/,/g, '\\,')}`,
      'END:VEVENT')
  })
  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `agenda-ag-${new Date().toISOString().split('T')[0]}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

// ── CRM CSV Export ────────────────────────────────────────────────────────────
export function exportCrmCSV(contacts: CRMContact[]): void {
  const headers = ['Nome', 'Email', 'Telefone', 'Nacionalidade', 'Status', 'Budget Mín', 'Budget Máx', 'Tipologias', 'Zonas', 'Origem', 'Último Contacto', 'Follow-up', 'Score']
  const rows = contacts.map(c => [
    c.name, c.email, c.phone, c.nationality, c.status,
    c.budgetMin, c.budgetMax,
    c.tipos.join(';'), c.zonas.join(';'), c.origin,
    c.lastContact, c.nextFollowUp, computeLeadScore(c).score,
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `crm_ag_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Radar PDF Generator ────────────────────────────────────────────────────────
export function gerarPDF(
  deals: Record<string, unknown>[],
  filtros: Record<string, unknown>,
  stats: Record<string, unknown>
): void {
  const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
  const scoreColor = (s: number) => s >= 88 ? '#16a34a' : s >= 78 ? '#c9a96e' : s >= 68 ? '#2563eb' : s >= 55 ? '#6b7280' : '#dc2626'

  const dealsHtml = deals.map((d, i) => {
    const sc = Number(d.score || 0)
    const cl = String(d.classificacao || '⚖️')
    const pr = Number(d.preco || 0)
    const ar = Number(d.area || 0)
    const pm2 = Number(d.pm2 || 0)
    const pm2m = Number(d.pm2_mercado || 0)
    const yB = Number(d.yield_bruto_pct || 0)
    const desc = Number(d.desconto_mercado_pct || 0)
    const pl = String(d.platform || '')
    const isL = Boolean(d.is_leilao)
    const isB = Boolean(d.is_banca)
    return `<div class="deal" style="break-inside:avoid;margin-bottom:18px;border:1px solid #e2e8f0;border-radius:8px;padding:14px;border-left:4px solid ${scoreColor(sc)}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:22px;font-weight:900;color:${scoreColor(sc)}">${sc}</span>
            <span style="font-size:10px;background:${scoreColor(sc)}20;color:${scoreColor(sc)};padding:2px 8px;border-radius:12px;font-weight:600">${cl}</span>
            <span style="font-size:9px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:10px">${isL ? '🔨 LEILÃO' : isB ? '🏦 BANCA' : '🏠 MERCADO'} — ${pl}</span>
          </div>
          <div style="font-size:12px;font-weight:600;color:#0f172a;margin-bottom:2px">${String(d.titulo || 'Imóvel').substring(0, 80)}</div>
          <div style="font-size:10px;color:#64748b">${String(d.morada || d.zona || '').substring(0, 70)} · ${String(d.zona || '')}</div>
        </div>
        <div style="text-align:right;min-width:130px">
          <div style="font-size:16px;font-weight:700;color:#0f172a">${pr > 0 ? `€ ${pr.toLocaleString('pt-PT')}` : '—'}</div>
          <div style="font-size:9px;color:#64748b">${ar > 0 ? `${ar}m²  ·  ` : ''}${pm2 > 0 ? `€${pm2.toLocaleString('pt-PT')}/m²` : ''}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:9px;margin-bottom:8px">
        <div style="background:#f8fafc;padding:5px 8px;border-radius:5px"><div style="color:#94a3b8;text-transform:uppercase;font-size:8px">€/m² Mercado</div><div style="font-weight:600;color:#0f172a">${pm2m > 0 ? `€${pm2m.toLocaleString('pt-PT')}` : '-'}</div></div>
        <div style="background:#f8fafc;padding:5px 8px;border-radius:5px"><div style="color:#94a3b8;text-transform:uppercase;font-size:8px">Desc. Mercado</div><div style="font-weight:600;color:${desc > 10 ? '#16a34a' : desc > 0 ? '#c9a96e' : '#dc2626'}">${desc > 0 ? `-${desc.toFixed(1)}%` : desc < 0 ? `+${Math.abs(desc).toFixed(1)}%` : '—'}</div></div>
        <div style="background:#f8fafc;padding:5px 8px;border-radius:5px"><div style="color:#94a3b8;text-transform:uppercase;font-size:8px">Yield Bruto</div><div style="font-weight:600;color:#2563eb">${yB > 0 ? `${yB.toFixed(1)}%` : '—'}</div></div>
        <div style="background:#f8fafc;padding:5px 8px;border-radius:5px"><div style="color:#94a3b8;text-transform:uppercase;font-size:8px">Trend YoY</div><div style="font-weight:600;color:#16a34a">${d.var_yoy ? `+${d.var_yoy}%` : '—'}</div></div>
      </div>
      ${isL && d.valor_base ? `<div style="font-size:9px;background:#fef2f2;padding:4px 8px;border-radius:4px;color:#dc2626;margin-bottom:6px">⚠️ Leilão Judicial · Valor Base: €${Number(d.valor_base).toLocaleString('pt-PT')} · ${d.prazo_licitacao ? `Prazo: ${d.prazo_licitacao}` : ''}</div>` : ''}
      ${isB ? `<div style="font-size:9px;background:#eff6ff;padding:4px 8px;border-radius:4px;color:#2563eb;margin-bottom:6px">🏦 Imóvel da Banca — ${String(d.banco || '')} · Desconto estimado 10-25%</div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:9px;color:#64748b">${d.agente ? `Agente/Plataforma: ${String(d.agente).substring(0, 40)}` : ''} ${d.telefone ? `· ☎ ${d.telefone}` : ''}</div>
        <a href="${String(d.url)}" style="font-size:9px;color:#1c4a35;font-weight:600;text-decoration:none">Ver imóvel →</a>
      </div>
      <div style="font-size:8px;color:#94a3b8;margin-top:4px;word-break:break-all">${String(d.url).substring(0, 80)}${String(d.url).length > 80 ? '...' : ''}</div>
    </div>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<title>Agency Group — Radar Escolhas do Dia ${hoje}</title>
<style>
  @page { size:A4; margin:15mm 12mm; }
  *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;font-size:11px;line-height:1.4;margin:0;padding:0}
  .header{border-bottom:3px solid #1c4a35;padding-bottom:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end}
  .logo{font-size:22px;font-weight:900;color:#1c4a35;letter-spacing:-0.5px}
  .logo span{color:#c9a96e}
  .subtitle{font-size:10px;color:#64748b;margin-top:2px}
  .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
  .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;text-align:center}
  .stat-val{font-size:18px;font-weight:800;color:#1c4a35}
  .stat-label{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em}
  .section-title{font-size:13px;font-weight:700;color:#0f172a;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
  .footer{margin-top:20px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;display:flex;justify-content:space-between}
  @media print{body{font-size:10px}.deal{page-break-inside:avoid}}
</style></head><body>
<div class="header">
  <div>
    <div class="logo">Agency<span>Group</span></div>
    <div class="subtitle">AMI 22506 · geral@agencygroup.pt · www.agencygroup.pt</div>
    <div class="subtitle">RADAR DE OPORTUNIDADES — ${hoje} · Zona: ${String(filtros.zona || 'Portugal')} · Score mínimo: ${String(filtros.score_min || 65)}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;font-weight:700;color:#0f172a">ESCOLHAS DO DIA</div>
    <div style="font-size:9px;color:#64748b">${deals.length} oportunidades identificadas</div>
    <div style="font-size:9px;color:#64748b">Gerado: ${new Date().toLocaleTimeString('pt-PT')}</div>
  </div>
</div>
<div class="stats">
  <div class="stat"><div class="stat-val">${deals.length}</div><div class="stat-label">Deals Encontrados</div></div>
  <div class="stat"><div class="stat-val" style="color:#c9a96e">${Number(stats.avg_score || 0)}</div><div class="stat-label">Score Médio</div></div>
  <div class="stat"><div class="stat-val" style="color:#dc2626">${Number(stats.leiloes || 0)}</div><div class="stat-label">🔨 Leilões</div></div>
  <div class="stat"><div class="stat-val" style="color:#2563eb">${Number(stats.banca || 0)}</div><div class="stat-label">🏦 Banca</div></div>
  <div class="stat"><div class="stat-val">${Number(stats.mercado_livre || 0)}</div><div class="stat-label">🏠 Mercado</div></div>
</div>
<div class="section-title">Ranking de Oportunidades — Ordenado por Score Descrescente</div>
${dealsHtml}
<div class="footer">
  <span>Agency Group · AMI 22506 · Nota: Análise indicativa. Não constitui proposta de negócio. Verifique sempre informação directamente com os vendedores/plataformas.</span>
  <span>Fontes: ${String((filtros.fontes as string[] || []).join(' · '))} · Euribor live BCE · INE/AT Q4 2025</span>
</div>
</body></html>`

  // Blob URL — browsers don't block this unlike window.open('')
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (w) {
    // Auto-trigger print dialog after page renders
    setTimeout(() => {
      try { w.print() } catch { /* user can Ctrl+P manually */ }
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }, 1200)
  } else {
    // Popup blocked → silent download as HTML (open + print to PDF)
    const a = document.createElement('a')
    a.href = url
    a.download = `radar-escolhas-${new Date().toISOString().split('T')[0]}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }
}
