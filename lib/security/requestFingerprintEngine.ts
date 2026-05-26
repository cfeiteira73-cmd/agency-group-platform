// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Request Fingerprint Engine — Anomaly Detection via Device/Session Profiling
// Wave 45 Agent 2 — Maximum Security Hardening
// =============================================================================

import { createHash } from 'crypto'

export interface RequestFingerprint {
  fingerprint_id: string
  ip_hash: string
  user_agent_hash: string
  accept_lang: string
  accept_encoding: string
  content_type: string | null
  forwarded_for_hash: string | null
  composite_hash: string
  risk_indicators: string[]
  risk_score: number // 0–100
}

export function computeRequestFingerprint(
  headers: Record<string, string | undefined>,
): RequestFingerprint {
  const ip =
    headers['x-real-ip'] ??
    headers['x-forwarded-for']?.split(',')[0]?.trim() ??
    'unknown'

  const ua  = headers['user-agent'] ?? ''
  const lang = headers['accept-language'] ?? ''
  const enc  = headers['accept-encoding'] ?? ''
  const ct   = headers['content-type'] ?? null
  const xff  = headers['x-forwarded-for'] ?? null

  const ipHash  = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  const uaHash  = createHash('sha256').update(ua).digest('hex').slice(0, 16)
  const xffHash = xff
    ? createHash('sha256').update(xff).digest('hex').slice(0, 16)
    : null

  const risk: string[] = []
  let riskScore = 0

  // ── Scanner / bot detection ────────────────────────────────────────────────
  if (!ua || ua.length < 10) {
    risk.push('MISSING_USER_AGENT')
    riskScore += 30
  }

  if (/sqlmap|nikto|nessus|burpsuite|masscan|nmap/i.test(ua)) {
    risk.push('SCANNER_UA')
    riskScore += 80
  }

  if (/curl|wget|python-requests|go-http/i.test(ua) && !ct) {
    risk.push('SCRIPTED_CLIENT')
    riskScore += 20
  }

  // ── XFF anomaly detection ──────────────────────────────────────────────────
  if (xff && xff.split(',').length > 5) {
    risk.push('EXCESSIVE_XFF_HOPS')
    riskScore += 15
  }

  // ── Encoding baseline check ────────────────────────────────────────────────
  if (!enc) {
    risk.push('NO_ACCEPT_ENCODING')
    riskScore += 10
  }

  const compositeHash = createHash('sha256')
    .update(`${ipHash}::${uaHash}::${lang}::${enc}`)
    .digest('hex')
    .slice(0, 32)

  return {
    fingerprint_id: compositeHash,
    ip_hash: ipHash,
    user_agent_hash: uaHash,
    accept_lang: lang.slice(0, 32),
    accept_encoding: enc.slice(0, 64),
    content_type: ct?.slice(0, 64) ?? null,
    forwarded_for_hash: xffHash,
    composite_hash: compositeHash,
    risk_indicators: risk,
    risk_score: Math.min(100, riskScore),
  }
}

export function isFingerprintSuspicious(fp: RequestFingerprint): boolean {
  return (
    fp.risk_score >= 50 ||
    fp.risk_indicators.some((r) => ['SCANNER_UA', 'EXCESSIVE_XFF_HOPS'].includes(r))
  )
}
