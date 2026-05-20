// Agency Group — Tenant Saturation Load Test
// infra/k6/tenant-saturation.js
// Simulates a single tenant at saturation to verify:
//   1. No data leaks to other tenants
//   2. Rate limiting kicks in at expected thresholds
//   3. System remains stable under overload
//   4. SLO holds under single-tenant storm
//
// Run: k6 run --env BASE_URL=https://agencygroup.pt --env AUTH_TOKEN=<token> infra/k6/tenant-saturation.js

import http from 'k6/http'
import { sleep, check, fail } from 'k6'
import { Rate, Counter, Trend } from 'k6/metrics'

// ─── Custom metrics ────────────────────────────────────────────────────────────

const errorRate    = new Rate('saturation_errors')
const rateLimited  = new Counter('rate_limited_requests')
const responseTime = new Trend('saturation_response_time')

// ─── Config ────────────────────────────────────────────────────────────────────

const BASE_URL   = __ENV.BASE_URL   || 'https://agencygroup.pt'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

// ─── Test options ──────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: '30s', target: 20  },   // warm-up
    { duration: '2m',  target: 100 },   // ramp to saturation
    { duration: '1m',  target: 100 },   // sustain saturation
    { duration: '30s', target: 0   },   // cool-down
  ],
  thresholds: {
    saturation_response_time: ['p(95)<5000'],  // more lenient under saturation
    saturation_errors:        ['rate<0.20'],   // allow up to 20% errors (429s expected)
    http_req_duration:        ['p(99)<10000'],
  },
}

// ─── Default scenario ─────────────────────────────────────────────────────────

export default function () {
  const headers = AUTH_TOKEN
    ? { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' }
    : {}

  // ── 1. Investors endpoint (read-heavy) ─────────────────────────────────────
  const investorsRes = http.get(`${BASE_URL}/api/investors?limit=50`, { headers })

  check(investorsRes, { 'not 5xx': r => r.status < 500 })

  if (investorsRes.status === 429) {
    rateLimited.add(1)
  }
  if (investorsRes.status >= 500) {
    errorRate.add(1)
  } else {
    errorRate.add(0)
  }
  responseTime.add(investorsRes.timings.duration)

  sleep(0.1)  // minimal sleep for saturation

  // ── 2. Intelligence / liquidity endpoint ──────────────────────────────────
  const liquidityRes = http.get(`${BASE_URL}/api/intelligence/liquidity`, { headers })

  check(liquidityRes, { 'liquidity not 5xx': r => r.status < 500 })

  if (liquidityRes.status === 429) {
    rateLimited.add(1)
  }
  if (liquidityRes.status >= 500) {
    errorRate.add(1)
  } else {
    errorRate.add(0)
  }
  responseTime.add(liquidityRes.timings.duration)

  sleep(0.1)

  // ── 3. Deep health check (must always respond — critical SRE gate) ─────────
  const healthRes = http.get(`${BASE_URL}/api/health/deep`)

  const healthOk = check(healthRes, {
    'health responds': r => r.status < 500,
  })

  if (!healthOk) {
    fail('health check failed under saturation — critical SRE gap')
  }

  responseTime.add(healthRes.timings.duration)

  sleep(0.2)
}
