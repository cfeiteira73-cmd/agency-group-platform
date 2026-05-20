// =============================================================================
// Agency Group — k6 Load Test: Core Revenue Pipeline
// tests/load/k6-api-pipeline.js
//
// Tests the critical revenue-path endpoints under sustained load.
// Run: k6 run --env BASE_URL=https://your-host --env SERVICE_TOKEN=xxx k6-api-pipeline.js
// =============================================================================

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

// ─── Custom metrics ───────────────────────────────────────────────────────────

const priorityDuration  = new Trend('priority_duration_ms',  true)
const dealsDuration     = new Trend('deals_duration_ms',     true)
const matchesDuration   = new Trend('matches_duration_ms',   true)
const analyticsDuration = new Trend('analytics_duration_ms', true)
const investorDuration  = new Trend('investors_duration_ms', true)
const errorRate         = new Rate('pipeline_error_rate')

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL      = __ENV.BASE_URL      || 'http://localhost:3000'
const SERVICE_TOKEN = __ENV.SERVICE_TOKEN || ''

export const options = {
  vus:          10,
  duration:     '30s',
  gracefulStop: '5s',

  thresholds: {
    // Overall HTTP request duration p95 must be under 3 000 ms
    http_req_duration:    ['p(95)<3000'],
    // Less than 5 % of requests may fail
    http_req_failed:      ['rate<0.05'],
    // Per-endpoint budget checks
    priority_duration_ms: ['p(95)<2000'],
    deals_duration_ms:    ['p(95)<1500'],
    matches_duration_ms:  ['p(95)<1500'],
    analytics_duration_ms:['p(95)<3000'],
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

  // ── 1. GET /api/priority ─────────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/priority`, params)
    const ok  = check(res, {
      'priority: status 200':         r => r.status === 200,
      'priority: duration < 2000 ms': r => r.timings.duration < 2000,
    })
    priorityDuration.add(res.timings.duration)
    errorRate.add(!ok)
  }

  sleep(0.1)

  // ── 2. GET /api/deals?limit=20 ────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/deals?limit=20`, params)
    const ok  = check(res, {
      'deals: status 200':         r => r.status === 200,
      'deals: duration < 1500 ms': r => r.timings.duration < 1500,
    })
    dealsDuration.add(res.timings.duration)
    errorRate.add(!ok)
  }

  sleep(0.1)

  // ── 3. GET /api/matches?limit=10 ─────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/matches?limit=10`, params)
    const ok  = check(res, {
      'matches: status 200':         r => r.status === 200,
      'matches: duration < 1500 ms': r => r.timings.duration < 1500,
    })
    matchesDuration.add(res.timings.duration)
    errorRate.add(!ok)
  }

  sleep(0.1)

  // ── 4. GET /api/analytics/summary ────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/analytics/summary`, params)
    const ok  = check(res, {
      'analytics/summary: status 200':         r => r.status === 200,
      'analytics/summary: duration < 3000 ms': r => r.timings.duration < 3000,
    })
    analyticsDuration.add(res.timings.duration)
    errorRate.add(!ok)
  }

  sleep(0.1)

  // ── 5. GET /api/investors (optional — may not exist yet) ─────────────────────
  {
    const res = http.get(`${BASE_URL}/api/investors`, params)
    const ok  = check(res, {
      'investors: status 200 or 404': r => r.status === 200 || r.status === 404,
    })
    investorDuration.add(res.timings.duration)
    // A 404 here is acceptable — do NOT count as error
    if (res.status !== 200 && res.status !== 404) {
      errorRate.add(true)
    }
  }

  sleep(0.2)
}
