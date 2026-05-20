import http from 'k6/http'
import { sleep, check } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const errorRate = new Rate('error_rate')
const apiLatency = new Trend('api_latency')

const BASE_URL = __ENV.BASE_URL || 'https://agencygroup.pt'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // warmup
    { duration: '2m',  target: 50 },   // ramp to 50 VUs
    { duration: '3m',  target: 50 },   // sustain
    { duration: '1m',  target: 0  },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    error_rate:        ['rate<0.05'],
  },
}

export default function () {
  const headers = AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}

  // Health check (all VUs)
  {
    const res = http.get(`${BASE_URL}/api/health/deep`)
    check(res, { 'health ok': (r) => r.status === 200 || r.status === 207 })
    apiLatency.add(res.timings.duration)
    errorRate.add(res.status >= 500)
  }

  sleep(1)

  // Properties listing (60% of VUs)
  if (Math.random() < 0.6) {
    const res = http.get(`${BASE_URL}/api/properties?limit=20`, { headers })
    check(res, { 'properties ok': (r) => r.status < 500 })
    apiLatency.add(res.timings.duration)
    errorRate.add(res.status >= 500)
  }

  sleep(1)

  // Intelligence endpoint (20% of VUs)
  if (Math.random() < 0.2) {
    const res = http.get(`${BASE_URL}/api/intelligence/liquidity`, { headers })
    check(res, { 'liquidity ok': (r) => r.status < 500 })
    apiLatency.add(res.timings.duration)
    errorRate.add(res.status >= 500)
  }

  sleep(2)
}
