// ─── Shared export utilities for Agency Group Portal ─────────────────────────

/**
 * Opens a print-ready PDF window with Agency Group branding.
 * Requires the browser to allow pop-ups.
 */
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
    <button class="print-btn no-print" onclick="window.print()">⬇ IMPRIMIR / PDF</button>
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

/**
 * Generates and triggers download of an ICS calendar file.
 * Events without a time are treated as all-day events.
 */
export function exportToICS(events: { title: string; date: string; time?: string; description?: string }[]): void {
  const pad = (n: number) => String(n).padStart(2, '0')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agency Group//Portal 2026//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  events.forEach((ev, i) => {
    const d = ev.date.replace(/-/g, '')
    const h = ev.time ? ev.time.split(':')[0] : '09'
    const m = ev.time ? ev.time.split(':')[1] : '00'
    const dtStart = ev.time ? `${d}T${h}${m}00` : d
    const dtEnd = ev.time ? `${d}T${pad(Math.min(23, parseInt(h) + 1))}${m}00` : d
    lines.push(
      'BEGIN:VEVENT',
      `UID:ag-${Date.now()}-${i}@agencygroup.pt`,
      `DTSTART${ev.time ? '' : ';VALUE=DATE'}:${dtStart}`,
      `DTEND${ev.time ? '' : ';VALUE=DATE'}:${dtEnd}`,
      `SUMMARY:${(ev.title || '').replace(/,/g, '\\,')}`,
      `DESCRIPTION:${(ev.description || 'Agency Group — AMI 22506').replace(/,/g, '\\,')}`,
      'END:VEVENT',
    )
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
