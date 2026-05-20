// =============================================================================
// Agency Group — k6 Load Test: Ingestion Endpoints
// tests/load/k6-ingestion.js
//
// Tests the data ingestion and financial analytics endpoints under sustained load.
// Run: k6 run --env BASE_URL=https://your-host --env SERVICE_TOKEN=xxx k6-ingestion.js
// =============================================================================

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

// ─── Custom metrics ───────────────────────────────────────────────────────────

const ingestionDuration = new Trend('ingestion_run_duration_ms', true)
const financialDuration = new Trend('financial_duration_ms',     true)
const errorRate         = new Rate('ingestion_error_rate')

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL      = __ENV.BASE_URL      || 'http://localhost:3000'
const SERVICE_TOKEN = __ENV.SERVICE_TOKEN || ''

export const options = {
  vus:      3,
  duration: '60s',

  thresholds: {
    // Overall p95 budget for ingestion workloads (heavy I/O)
    http_req_duration:          ['p(95)<8000'],
    http_req_failed:            ['rate<0.05'],
    ingestion_run_duration_ms:  ['p(95)<8000'],
    financial_duration_ms:      ['p(95)<5000'],
  },
}

// ─── Shared request params ─────────────────────────────────────────────────────

function authHeaders() {
  const h = { 'Content-Type': 'application/json' }
  if (SERVICE_TOKEN) {
    h['Authorization'] = `Bearer ${SERVICE_TOKEN}`
  }
  return { headers: h }
}

// ─── Virtual user iteration ───────────────────────────────────────────────────

export default function () {
  const params = authHeaders()

  // ── 1. POST /api/ingestion/run (may not exist; accept 200 or 202) ─────────────
  {
    const body = JSON.stringify({ provider: 'all', limit: 10 })
    const res  = http.post(
      `${BASE_URL}/api/ingestion/run`,
      body,
      { headers: { 'Content-Type': 'application/json', ...params.headers } },
    )

    const ok = check(res, {
      'ingestion/run: status 200 or 202': r => r.status === 200 || r.status === 202,
    })
    ingestionDuration.add(res.timings.duration)

    // A 404 means the route isn't deployed yet — not a load-test failure
    if (res.status !== 200 && res.status !== 202 && res.status !== 404) {
      errorRate.add(true)
    } else {
      errorRate.add(false)
    }
  }

  sleep(0.5)

  // ── 2. GET /api/analytics/financial ──────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/analytics/financial`, params)
    const ok  = check(res, {
      'analytics/financial: status 200':         r => r.status === 200,
      'analytics/financial: duration < 5000 ms': r => r.timings.duration < 5000,
    })
    financialDuration.add(res.timings.duration)
    errorRate.add(!ok)
  }

  sleep(1)
}
