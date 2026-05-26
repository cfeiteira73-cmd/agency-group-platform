// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// CSP Violation Report Collector
// Wave 45 Agent 2 — Maximum Security Hardening
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 10

// Browsers POST CSP violations to this endpoint automatically when
// `report-uri /api/security/csp-report` is present in the CSP header.
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}) as Record<string, unknown>)
    const report = (body['csp-report'] ?? body) as Record<string, unknown>

    // Validate it looks like an actual CSP report
    if (!report['violated-directive'] && !report['violatedDirective']) {
      return NextResponse.json({ ok: true }) // silently ignore non-CSP bodies
    }

    void (supabaseAdmin as any)
      .from('csp_violation_reports')
      .insert({
        document_uri: String(report['document-uri'] ?? report['documentURI'] ?? '').slice(0, 512),
        violated_directive: String(report['violated-directive'] ?? report['violatedDirective'] ?? '').slice(0, 256),
        blocked_uri: String(report['blocked-uri'] ?? report['blockedURI'] ?? '').slice(0, 512),
        original_policy: String(report['original-policy'] ?? report['originalPolicy'] ?? '').slice(0, 2048),
        source_file: String(report['source-file'] ?? report['sourceFile'] ?? '').slice(0, 512),
        status_code: Number(report['status-code'] ?? report['statusCode'] ?? 0),
        ip_hash: request.headers.get('x-real-ip') ?? 'unknown',
        reported_at: new Date().toISOString(),
      })
      .catch((e: unknown) => console.warn('[csp-report] insert failed', e))

    return NextResponse.json({ ok: true })
  } catch {
    // Always return 200 — a non-200 causes some browsers to retry aggressively
    return NextResponse.json({ ok: true })
  }
}
