# Real-Time System Control Center
## Agency Group SH-ROS — Wave 45 Observability Reference
**Date**: 2026-05-26

---

## Metrics Endpoint
`GET /api/metrics` — Prometheus text format, scrape interval: 15s

### Available Metrics
| Metric | Type | Description |
|--------|------|-------------|
| ag_opportunities_total | gauge | Total opportunities in raw_opportunity_stream |
| ag_investors_total | gauge | Total registered investors |
| ag_escrow_positions_total | gauge | Total escrow positions |
| ag_kyc_approved_total | gauge | KYC-approved subjects |
| ag_traces_last_hour | gauge | Trace spans in last 1 hour |
| ag_active_anomalies | gauge | Unresolved anomaly alerts |
| ag_system_health_score | gauge | System health 0-100 |
| ag_api_error_rate_pct | gauge | API error rate % |
| ag_supply_ingestion_rate | gauge | New supply per hour |
| ag_dr_last_test_passed | gauge | DR test status (1=pass) |

---

## Service Level Objectives

| SLO | Target | Window |
|-----|--------|--------|
| API Availability | 99.9% | 30 days |
| Supply Freshness | 99.5% | 7 days |
| Capital Execution | 99.0% | 30 days |
| ML Accuracy | 95.0% | 7 days |
| Data Quality | 90.0% | 7 days |
| KYC SLA (48h) | 95.0% | 30 days |
| GDPR SLA (30d) | 100% | 30 days |
| Escrow Integrity | 100% | 30 days |

---

## Alert Rules (8 Active)

| Rule | Metric | Threshold | Severity |
|------|--------|-----------|----------|
| API Error Rate High | api_error_rate_pct | >5% | WARNING |
| API Error Rate Critical | api_error_rate_pct | >15% | CRITICAL |
| Critical Anomaly | active_anomalies | >0 | CRITICAL |
| Supply Data Stale | last_ingest | >24h | WARNING |
| ML Drift High | drift_score | >0.2 | WARNING |
| System Health Low | health_score | <70 | WARNING |
| System Health Critical | health_score | <50 | CRITICAL |
| Escrow Integrity | state_violations | >0 | CRITICAL |

---

## Distributed Tracing
- Correlation ID chain: API -> DB -> ML -> Capital -> Legal
- `GET /api/observability/control-plane?mode=trace&trace_id=X`

---

## Dashboards
`GET /api/system/master-status?mode=live` — System snapshot
`GET /api/system/production-os?mode=live` — Production OS status
`GET /api/observability/control-plane?mode=performance` — Performance snapshot
`GET /api/sre/status?mode=slo` — SLO report
`GET /api/sre/status?mode=dr` — DR certification
`GET /api/sre/status` — Full SRE summary
