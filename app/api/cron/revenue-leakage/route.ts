// =============================================================================
// Agency Group — Revenue Leakage Detection Cron
// GET/POST /api/cron/revenue-leakage
//
// Runs daily (recommended: 07:00 UTC Mon-Fri) to detect revenue leaks.
// Sends email alert when critical leaks are found.
// Also supports ?dry_run=true for portal preview.
//
// AUTH: CRON_SECRET header OR ops_manager+ portal auth
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { detectRevenueLeakage, summariseLeakage } from '@/lib/commercial/revenueLeakage'
import { getAdminRole, isRoleAtLeast } from '@/lib/auth/adminAuth'
import { cronCorrelationId } from '@/lib/observability/correlation'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const incoming = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')
  return incoming === secret
}

async function isPortalAuthorized(req: NextRequest): Promise<boolean> {
  const email = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!email) return false
  const admin = await getAdminRole(email)
  if (!admin) return false
  return isRoleAtLeast(admin.role, 'ops_manager')
}

// ---------------------------------------------------------------------------
// Email alert
// ---------------------------------------------------------------------------

async function sendLeakageAlert(
  criticalCount: number,
  estimatedRevenue: number,
  topItems: ReturnType<typeof summariseLeakage>['top_items'],
): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const to  = process.env.ALERT_EMAIL ?? process.env.DIGEST_EMAIL ?? process.env.FOUNDER_EMAIL ?? 'geral@agencygroup.pt'
  if (!key || criticalCount === 0) return

  const rows = topItems.slice(0, 5).map(item => `
    <tr style="border-bottom:1px solid #1a1a1a;">
      <td style="padding:10px 8px;color:${item.severity === 'critical' ? '#e74c3c' : '#c9a96e'};font-weight:700;font-size:12px;text-transform:uppercase;">${item.severity}</td>
      <td style="padding:10px 8px;color:#f4f0e6;font-size:13px;">${item.lead_name ?? '—'}</td>
      <td style="padding:10px 8px;color:#a0a0a0;font-size:12px;">${item.category.replace(/_/g, ' ')}</td>
      <td style="padding:10px 8px;color:#8fa89a;font-size:12px;">${item.description}</td>
      <td style="padding:10px 8px;color:#c9a96e;font-size:12px;">${item.revenue_est ? `€${(item.revenue_est / 1000).toFixed(0)}K` : '—'}</td>
    </tr>
  `).join('')

  const html = `
    <div style="background:#0a1a10;padding:24px;font-family:Jost,sans-serif;">
      <h2 style="color:#c9a96e;margin:0 0 8px;font-size:18px;">⚠️ Revenue Leakage Detectado</h2>
      <p style="color:#8fa89a;margin:0 0 20px;font-size:13px;">
        <strong style="color:#e74c3c">${criticalCount} itens críticos</strong> detectados —
        risco estimado: <strong style="color:#c9a96e">€${(estimatedRevenue / 1000).toFixed(0)}K</strong> em comissões
      </p>
      <table style="width:100%;border-collapse:collapse;background:#0d1f17;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1c4a35;">
            <th style="padding:10px 8px;color:#c9a96e;text-align:left;font-size:11px;">SEVERIDADE</th>
            <th style="padding:10px 8px;color:#c9a96e;text-align:left;font-size:11px;">LEAD</th>
            <th style="padding:10px 8px;color:#c9a96e;text-align:left;font-size:11px;">CATEGORIA</th>
            <th style="padding:10px 8px;color:#c9a96e;text-align:left;font-size:11px;">DETALHE</th>
            <th style="padding:10px 8px;color:#c9a96e;text-align:left;font-size:11px;">RECEITA EST.</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#8fa89a;margin:16px 0 0;font-size:11px;">
        Ver todos: <a href="https://agencygroup.pt/portal" style="color:#c9a96e;">portal →</a>
      </p>
    </div>
  `

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: 'Agency Group Ops <ops@agencygroup.pt>',
        to:   [to],
        subject: `⚠️ ${criticalCount} Revenue Leaks — €${(estimatedRevenue / 1000).toFixed(0)}K em risco`,
        html,
      }),
      signal: AbortSignal.timeout(12000),
    })
  } catch { /* non-blocking */ }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handler(req: NextRequest) {
  const corrId  = cronCorrelationId('revenue-leakage')
  const dryRun  = new URL(req.url).searchParams.get('dry_run') === 'true'

  // Auth: cron secret OR portal ops_manager+
  const cronOk   = isCronAuthorized(req)
  const portalOk = !cronOk ? await isPortalAuthorized(req) : false
  if (!cronOk && !portalOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  log.info('[revenue-leakage] scan started', { correlation_id: corrId, dry_run: dryRun })

  try {
    const items   = await detectRevenueLeakage()
    const summary = summariseLeakage(items)

    if (!dryRun && summary.critical > 0) {
      await sendLeakageAlert(summary.critical, summary.estimated_revenue, summary.top_items)
    }

    log.info('[revenue-leakage] scan complete', {
      correlation_id: corrId,
      total:          summary.total,
      critical:       summary.critical,
      revenue_at_risk: summary.estimated_revenue,
      dry_run:        dryRun,
    })

    const res = NextResponse.json({
      ok:        true,
      dry_run:   dryRun,
      summary,
      items:     dryRun ? items : items.slice(0, 20), // full list only on dry_run
      correlation_id: corrId,
    })
    res.headers.set('x-correlation-id', corrId)
    return res

  } catch (err) {
    log.error('[revenue-leakage] scan failed', err instanceof Error ? err : new Error(String(err)), {
      correlation_id: corrId,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET  = handler
export const POST = handler
