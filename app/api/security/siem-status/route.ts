// app/api/security/siem-status/route.ts
// GET /api/security/siem-status — SIEM and secrets management status
// POST /api/security/siem-status — run security simulations (Bearer auth required)

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getSiemStatus } from '@/lib/security/siemIntegration'
import { checkSecretsHealth, getActiveProvider } from '@/lib/security/kmsSecretsManager'
import { runSecuritySimulations } from '@/lib/security/securitySimulator'

export const runtime = 'nodejs'
export const maxDuration = 30

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

function requireBearer(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.CRON_SECRET ?? ''
  if (!expected) return false
  return safeCompare(token, expected)
}

export async function GET(): Promise<NextResponse> {
  try {
    const [siemStatus, secretsHealth] = await Promise.allSettled([
      Promise.resolve(getSiemStatus()),
      checkSecretsHealth(),
    ])

    const siemValue = siemStatus.status === 'fulfilled' ? siemStatus.value : null
    const secretsValue = secretsHealth.status === 'fulfilled' ? secretsHealth.value : null

    return NextResponse.json({
      checked_at: new Date().toISOString(),
      siem: siemValue,
      secrets_management: {
        provider: getActiveProvider(),
        health: secretsValue,
      },
      production_ready: {
        siem_external: siemValue !== null &&
          (siemValue.datadog.configured || siemValue.azure_sentinel.configured),
        secrets_kms: ['AWS_SECRETS_MANAGER', 'HASHICORP_VAULT'].includes(getActiveProvider()),
        local_threat_log: true,  // always active
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'SIEM status check failed', detail: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!requireBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    typeof body !== 'object' || body === null ||
    (body as Record<string, unknown>)['action'] !== 'run-security-simulations'
  ) {
    return NextResponse.json({ error: 'Body must be { action: "run-security-simulations" }' }, { status: 400 })
  }

  try {
    const report = await runSecuritySimulations(TENANT_ID)
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json(
      { error: 'Security simulation failed', detail: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}
