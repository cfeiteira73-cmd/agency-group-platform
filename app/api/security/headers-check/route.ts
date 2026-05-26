// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Security Headers Self-Check Endpoint
// Wave 45 Agent 2 — Maximum Security Hardening
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { validateSecurityHeaders } from '@/lib/security/nextjsSecurityHeaders'
import { getRateLimitStats } from '@/lib/security/adaptiveRateLimitEngine'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: NextRequest): Promise<NextResponse> {
  const TENANT_ID =
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  // Extract incoming request headers for validation
  const responseHeaders: Record<string, string> = {}
  request.headers.forEach((val, key) => {
    responseHeaders[key] = val
  })

  const headerValidation = validateSecurityHeaders(responseHeaders)
  const rateLimitStats = await getRateLimitStats(TENANT_ID).catch(() => null)

  return NextResponse.json({
    security_headers: headerValidation,
    rate_limiting: rateLimitStats,
    security_score: headerValidation.score,
    timestamp: new Date().toISOString(),
  })
}
