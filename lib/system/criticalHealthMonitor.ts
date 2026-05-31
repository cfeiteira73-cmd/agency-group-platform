// Agency Group — Critical Health Monitor
// lib/system/criticalHealthMonitor.ts
// Wave 53 — Real production health check with Resend email alerts
//
// Checks all critical providers and sends email alerts via Resend
// (already configured + paid) when issues are detected.
// No SIEM required. Works with existing infrastructure.
// TypeScript strict — 0 errors

import log from '@/lib/logger'
import { STRIPE_IS_LIVE, STRIPE_MODE } from '@/lib/stripe'

// ── Constants ──────────────────────────────────────────────────────────────────

const ADMIN_EMAIL  = process.env.ADMIN_EMAIL ?? 'geral@agencygroup.pt'
const RESEND_KEY   = process.env.RESEND_API_KEY
const FROM_EMAIL   = 'alerts@agencygroup.pt'
const APP_URL      = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.agencygroup.pt'

// ── Types ──────────────────────────────────────────────────────────────────────

export type HealthSeverity = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW'

export interface HealthIssue {
  severity: HealthSeverity
  component: string
  message: string
  fix: string
}

export interface SystemHealthReport {
  healthy: boolean
  p0_count: number
  p1_count: number
  issues: HealthIssue[]
  stripe_mode: 'live' | 'test'
  market_data_active: boolean
  soc_alerts_active: boolean
  checked_at: string
}

// ── Provider checks ────────────────────────────────────────────────────────────

function checkCriticalProviders(): HealthIssue[] {
  const issues: HealthIssue[] = []

  // P0 — Stripe mode
  if (!STRIPE_IS_LIVE) {
    issues.push({
      severity:  'P0_CRITICAL',
      component: 'STRIPE',
      message:   `Stripe em TEST mode (${STRIPE_MODE}). Nenhum euro real é processado.`,
      fix:       'Substituir STRIPE_SECRET_KEY por sk_live_ no Vercel Dashboard',
    })
  }

  // P0 — Market data (Idealista / Casafari)
  const hasIdealista = !!process.env.IDEALISTA_API_KEY &&
    process.env.IDEALISTA_API_KEY !== 'PREENCHER' &&
    process.env.IDEALISTA_API_KEY.length > 10
  const hasCasafari  = !!process.env.CASAFARI_API_KEY &&
    process.env.CASAFARI_API_KEY !== 'PREENCHER' &&
    process.env.CASAFARI_API_KEY.length > 10

  if (!hasIdealista && !hasCasafari) {
    issues.push({
      severity:  'P0_CRITICAL',
      component: 'MARKET_DATA',
      message:   'Idealista e Casafari não configurados. AVM e market intelligence operam com dados estáticos.',
      fix:       'Adicionar IDEALISTA_API_KEY e CASAFARI_API_KEY no Vercel Dashboard',
    })
  } else if (!hasIdealista) {
    issues.push({
      severity:  'P1_HIGH',
      component: 'IDEALISTA',
      message:   'Idealista não configurado. Usando apenas Casafari.',
      fix:       'Adicionar IDEALISTA_API_KEY',
    })
  }

  // P0 — SOC alerting
  const hasPagerDuty = !!process.env.PAGERDUTY_ROUTING_KEY
  const hasDatadog   = !!process.env.DATADOG_API_KEY
  const hasSlackSoc  = !!process.env.SLACK_SOC_WEBHOOK_URL || !!process.env.SLACK_SECURITY_WEBHOOK

  if (!hasPagerDuty && !hasDatadog && !hasSlackSoc) {
    issues.push({
      severity:  'P0_CRITICAL',
      component: 'SOC_ALERTS',
      message:   'PagerDuty, Datadog e Slack SOC não configurados. Incidentes de segurança passam despercebidos.',
      fix:       'Criar conta PagerDuty free → PAGERDUTY_ROUTING_KEY, ou adicionar SLACK_SOC_WEBHOOK_URL',
    })
  }

  // P1 — Adyen fallback
  const hasAdyen = !!process.env.ADYEN_API_KEY
  if (!hasAdyen && STRIPE_IS_LIVE) {
    issues.push({
      severity:  'P1_HIGH',
      component: 'ADYEN_FALLBACK',
      message:   'Adyen não configurado. Se Stripe falhar, pagamentos param sem fallback.',
      fix:       'Criar conta Adyen → ADYEN_API_KEY',
    })
  }

  // P1 — Bank reconciliation
  const hasSaltEdge   = !!process.env.SALTEDGE_APP_ID
  const hasGoCardless = !!process.env.GOCARDLESS_ACCESS_TOKEN
  if (!hasSaltEdge && !hasGoCardless) {
    issues.push({
      severity:  'P1_HIGH',
      component: 'BANK_RECONCILIATION',
      message:   'SaltEdge e GoCardless não configurados. Reconciliação bancária é interna-apenas.',
      fix:       'Configurar SaltEdge → SALTEDGE_APP_ID + SALTEDGE_SECRET',
    })
  }

  // P2 — WhatsApp
  if (!process.env.WHATSAPP_ACCESS_TOKEN ||
      process.env.WHATSAPP_ACCESS_TOKEN === 'PREENCHER') {
    issues.push({
      severity:  'P2_MEDIUM',
      component: 'WHATSAPP',
      message:   'WhatsApp não configurado. Sofia não envia mensagens via WhatsApp.',
      fix:       'Activar WhatsApp Business API → WHATSAPP_ACCESS_TOKEN',
    })
  }

  // P2 — Chaos testing
  if (process.env.CHAOS_TESTING_ENABLED !== 'true') {
    issues.push({
      severity:  'P2_MEDIUM',
      component: 'CHAOS_TESTING',
      message:   'CHAOS_TESTING_ENABLED não activo. DR/RTO apenas em dry-run.',
      fix:       'Activar em staging: CHAOS_TESTING_ENABLED=true',
    })
  }

  return issues
}

// ── Resend email alert ─────────────────────────────────────────────────────────

async function sendHealthAlert(issues: HealthIssue[]): Promise<void> {
  if (!RESEND_KEY) {
    log.warn('[CriticalHealthMonitor] RESEND_API_KEY not set — cannot send email alerts')
    return
  }

  const p0Issues = issues.filter(i => i.severity === 'P0_CRITICAL')
  const p1Issues = issues.filter(i => i.severity === 'P1_HIGH')

  const subject = p0Issues.length > 0
    ? `🚨 [Agency Group] ${p0Issues.length} CRITICAL issue(s) detectados`
    : `⚠️ [Agency Group] ${p1Issues.length} HIGH issue(s) detectados`

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: ${p0Issues.length > 0 ? '#dc2626' : '#d97706'}">
    ${p0Issues.length > 0 ? '🚨 CRITICAL' : '⚠️ WARNING'} — Agency Group System Health
  </h2>
  <p>Detectados ${issues.length} issue(s) em produção:</p>

  ${issues.map(issue => `
  <div style="background: ${
    issue.severity === 'P0_CRITICAL' ? '#fef2f2' :
    issue.severity === 'P1_HIGH'     ? '#fffbeb' : '#f0fdf4'
  }; border-left: 4px solid ${
    issue.severity === 'P0_CRITICAL' ? '#dc2626' :
    issue.severity === 'P1_HIGH'     ? '#d97706' : '#16a34a'
  }; padding: 12px; margin: 8px 0; border-radius: 4px;">
    <strong style="color: #1f2937;">[${issue.severity}] ${issue.component}</strong>
    <p style="margin: 4px 0; color: #374151;">${issue.message}</p>
    <p style="margin: 4px 0; color: #6b7280; font-size: 0.875em;"><strong>Fix:</strong> ${issue.fix}</p>
  </div>
  `).join('')}

  <hr style="margin: 20px 0;" />
  <p style="color: #9ca3af; font-size: 0.875em;">
    Agency Group — <a href="${APP_URL}/api/system/health">Ver health dashboard</a><br>
    ${new Date().toISOString()}
  </p>
</body>
</html>`

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to:   [ADMIN_EMAIL],
        subject,
        html: htmlBody,
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      log.warn('[CriticalHealthMonitor] Resend email failed', { status: resp.status, err })
    } else {
      log.info('[CriticalHealthMonitor] Health alert email sent', { subject, to: ADMIN_EMAIL })
    }
  } catch (e: unknown) {
    log.warn('[CriticalHealthMonitor] Email send exception', { e: String(e) })
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function runCriticalHealthMonitor(
  opts: { sendAlert?: boolean } = {},
): Promise<SystemHealthReport> {
  const issues        = checkCriticalProviders()
  const p0Count       = issues.filter(i => i.severity === 'P0_CRITICAL').length
  const p1Count       = issues.filter(i => i.severity === 'P1_HIGH').length
  const healthy       = p0Count === 0 && p1Count === 0

  const report: SystemHealthReport = {
    healthy,
    p0_count:            p0Count,
    p1_count:            p1Count,
    issues,
    stripe_mode:         STRIPE_MODE,
    market_data_active:  !issues.some(i => i.component === 'MARKET_DATA' || i.component === 'IDEALISTA'),
    soc_alerts_active:   !issues.some(i => i.component === 'SOC_ALERTS'),
    checked_at:          new Date().toISOString(),
  }

  // Log all issues
  for (const issue of issues) {
    const level = issue.severity === 'P0_CRITICAL' ? 'error' :
                  issue.severity === 'P1_HIGH'     ? 'warn'  : 'info'
    log[level](`[CriticalHealthMonitor] [${issue.severity}] ${issue.component}: ${issue.message}`)
  }

  // Send alert if there are P0 or P1 issues (and requested or on startup)
  if ((opts.sendAlert || p0Count > 0) && (p0Count > 0 || p1Count > 0)) {
    void sendHealthAlert(issues).catch((e: unknown) =>
      log.warn('[CriticalHealthMonitor] Alert send failed', { e: String(e) })
    )
  }

  return report
}

// ── Startup check (runs once on cold start) ───────────────────────────────────
// Only in production to avoid noise in dev
if (process.env.NODE_ENV === 'production') {
  void runCriticalHealthMonitor({ sendAlert: true }).catch((e: unknown) =>
    log.warn('[CriticalHealthMonitor] Startup check failed', { e: String(e) })
  )
}
