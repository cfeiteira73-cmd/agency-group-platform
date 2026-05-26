// lib/security/securitySimulator.ts
// Security simulation engine — tests defense mechanisms
// PURPOSE: Verify that intrusion detection systems are working correctly
// USAGE: Call from /api/security/simulate (internal, authenticated endpoint)
// IMPORTANT: This is a TEST HARNESS. It does NOT make real attacks.

import { detectPrivilegeEscalation, detectTenantLeakage, detectReplayAttack, detectDataExfiltration } from './intrusionDetectionEngine'
import log from '@/lib/logger'

export interface SimulationResult {
  simulation_name: string
  attack_type: string
  defense_active: boolean
  threat_detected: boolean
  was_blocked: boolean
  severity?: string
  evidence: string[]
  passed: boolean  // true if defense correctly detected/blocked the simulated attack
}

export interface SecuritySimulationReport {
  run_at: string
  tenant_id: string
  total_simulations: number
  passed: number
  failed: number
  results: SimulationResult[]
  overall_defense_score: number  // 0-100
  security_grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

const SIMULATED_IPS = ['192.0.2.1', '198.51.100.1', '203.0.113.1']  // TEST-NET IPs (RFC 5737)

export async function runSecuritySimulations(tenantId: string): Promise<SecuritySimulationReport> {
  const runAt = new Date().toISOString()
  const results: SimulationResult[] = []

  log.info('[securitySimulator] starting simulations', { tenantId })

  // Simulation 1: Privilege Escalation — non-admin claiming ADMIN role
  const sim1 = await detectPrivilegeEscalation({
    user_id: 'SIMULATED_USER_001',
    claimed_role: 'ADMIN',
    accessed_endpoint: '/api/security/audit',
    tenant_id: tenantId,
    source_ip: SIMULATED_IPS[0],
  })
  results.push({
    simulation_name: 'Privilege Escalation Attempt',
    attack_type: 'PRIVILEGE_ESCALATION',
    defense_active: true,
    threat_detected: sim1.threat_detected,
    was_blocked: sim1.blocked,
    severity: sim1.severity,
    evidence: sim1.evidence,
    passed: sim1.threat_detected,  // should detect this
  })

  // Simulation 2: Tenant Leakage — accessing another tenant's resource
  const FAKE_TENANT_A = '00000000-0000-0000-0000-000000000001'
  const FAKE_TENANT_B = '00000000-0000-0000-0000-000000000002'
  const sim2 = await detectTenantLeakage({
    requesting_tenant_id: FAKE_TENANT_A,
    accessed_resource_tenant_id: FAKE_TENANT_B,  // DIFFERENT tenant — should be detected
    resource_type: 'journal_entries',
    resource_id: 'SIMULATED_RESOURCE_001',
    source_ip: SIMULATED_IPS[1],
  })
  results.push({
    simulation_name: 'Cross-Tenant Data Access',
    attack_type: 'TENANT_LEAKAGE',
    defense_active: true,
    threat_detected: sim2.threat_detected,
    was_blocked: sim2.blocked,
    severity: sim2.severity,
    evidence: sim2.evidence,
    passed: sim2.threat_detected && sim2.blocked,  // must detect AND block
  })

  // Simulation 3: Replay Attack — timestamp 10 minutes old
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const sim3 = await detectReplayAttack({
    idempotency_key: 'SIMULATED_REPLAY_KEY_001',
    operation_type: 'PSP_CHARGE',
    tenant_id: tenantId,
    source_ip: SIMULATED_IPS[2],
    request_timestamp: tenMinutesAgo,  // 10 min old — should trigger
  })
  results.push({
    simulation_name: 'Payment Replay Attack (10-min old timestamp)',
    attack_type: 'REPLAY_ATTACK',
    defense_active: true,
    threat_detected: sim3.threat_detected,
    was_blocked: sim3.blocked,
    severity: sim3.severity,
    evidence: sim3.evidence,
    passed: sim3.threat_detected,  // should detect the timestamp drift
  })

  // Simulation 4: Data Exfiltration — bulk response at 03:00 UTC
  const sim4 = await detectDataExfiltration({
    tenant_id: tenantId,
    endpoint: '/api/contacts',
    records_returned: 1000,  // large bulk export
    source_ip: SIMULATED_IPS[0],
    request_hour: 3,  // 03:00 UTC — outside business hours
  })
  results.push({
    simulation_name: 'Bulk Data Export at 03:00 UTC',
    attack_type: 'DATA_EXFILTRATION',
    defense_active: true,
    threat_detected: sim4.threat_detected,
    was_blocked: sim4.blocked,
    severity: sim4.severity,
    evidence: sim4.evidence,
    passed: sim4.threat_detected,  // should detect the suspicious pattern
  })

  const passedCount = results.filter(r => r.passed).length
  const overallScore = Math.round((passedCount / results.length) * 100)
  const grade: SecuritySimulationReport['security_grade'] =
    overallScore >= 95 ? 'A' :
    overallScore >= 80 ? 'B' :
    overallScore >= 65 ? 'C' :
    overallScore >= 50 ? 'D' : 'F'

  log.info('[securitySimulator] complete', { passed: passedCount, total: results.length, grade })

  return {
    run_at: runAt,
    tenant_id: tenantId,
    total_simulations: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    results,
    overall_defense_score: overallScore,
    security_grade: grade,
  }
}
