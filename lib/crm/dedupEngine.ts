// Agency Group — CRM Deduplication Engine
// lib/crm/dedupEngine.ts
// TypeScript strict — 0 errors
//
// Detects duplicate contacts/leads using: email match, phone match, name similarity
// Produces merge recommendations — NEVER auto-merges
// Supports: exact match, fuzzy name match, phone normalization

import { supabaseAdmin } from '@/lib/supabase'

function uuidv4(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DuplicatePair {
  pair_id: string
  tenant_id: string
  record_type: 'contact' | 'deal' | 'property'
  id_a: string
  id_b: string

  match_signals: {
    email_match: boolean
    phone_match: boolean
    name_similarity: number
    address_similarity: number
    overall_confidence: number
  }

  recommendation: 'merge_a_into_b' | 'merge_b_into_a' | 'flag_for_review' | 'not_duplicate'
  status: 'pending' | 'accepted' | 'rejected' | 'merged'

  detected_at: string
}

export interface DedupReport {
  run_id: string
  tenant_id: string
  record_type: 'contact' | 'deal' | 'property'
  records_scanned: number
  duplicate_pairs_found: number
  high_confidence_pairs: number
  estimated_savings_pct: number
  pairs: DuplicatePair[]
  generated_at: string
}

// ---------------------------------------------------------------------------
// Jaro-Winkler — pure implementation, no external library
// ---------------------------------------------------------------------------

function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1

  const len1 = s1.length
  const len2 = s2.length

  if (len1 === 0 || len2 === 0) return 0

  const matchDistance = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0)

  const s1Matches = new Array<boolean>(len1).fill(false)
  const s2Matches = new Array<boolean>(len2).fill(false)

  let matchCount    = 0
  let transpositions = 0

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance)
    const end   = Math.min(i + matchDistance + 1, len2)

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matchCount++
      break
    }
  }

  if (matchCount === 0) return 0

  // Count transpositions
  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  return (
    matchCount / len1 +
    matchCount / len2 +
    (matchCount - transpositions / 2) / matchCount
  ) / 3
}

function commonPrefixLength(s1: string, s2: string, maxLen: number): number {
  let len = 0
  const limit = Math.min(s1.length, s2.length, maxLen)
  for (let i = 0; i < limit; i++) {
    if (s1[i] !== s2[i]) break
    len++
  }
  return len
}

export function jaroWinklerDistance(s1: string, s2: string): number {
  const jaro   = jaroSimilarity(s1, s2)
  const prefix = commonPrefixLength(s1, s2, 4)
  return jaro + prefix * 0.1 * (1 - jaro)
}

// ---------------------------------------------------------------------------
// computeNameSimilarity
// ---------------------------------------------------------------------------

export function computeNameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
  return jaroWinklerDistance(normalize(a), normalize(b))
}

// ---------------------------------------------------------------------------
// normalizePhone — strips +351, spaces, dashes, normalizes to digits
// ---------------------------------------------------------------------------

export function normalizePhone(phone: string): string {
  if (!phone) return ''
  // Remove country code +351 or 00351
  let normalized = phone.replace(/^\+351/, '').replace(/^00351/, '')
  // Remove all non-digit characters
  normalized = normalized.replace(/\D/g, '')
  return normalized
}

// ---------------------------------------------------------------------------
// Internal contact shape from Supabase
// ---------------------------------------------------------------------------

interface ContactRow {
  id: string
  name?: string | null
  full_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  created_at?: string | null
}

// ---------------------------------------------------------------------------
// findDuplicateContacts
// ---------------------------------------------------------------------------

export async function findDuplicateContacts(tenantId: string): Promise<DuplicatePair[]> {
  const db = supabaseAdmin as any

  const { data } = await db
    .from('contacts')
    .select('id, name, full_name, email, phone, address, created_at')
    .eq('tenant_id', tenantId)
    .limit(2000)

  const contacts: ContactRow[] = data ?? []
  const pairs: DuplicatePair[] = []
  const seen = new Set<string>()

  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const a = contacts[i]
      const b = contacts[j]

      // Skip already-found pair combinations
      const pairKey = [a.id, b.id].sort().join('|')
      if (seen.has(pairKey)) continue

      const a_email = (a.email ?? '').toLowerCase().trim()
      const b_email = (b.email ?? '').toLowerCase().trim()
      const email_match = a_email.length > 0 && a_email === b_email

      const a_phone = normalizePhone(a.phone ?? '')
      const b_phone = normalizePhone(b.phone ?? '')
      const phone_match = a_phone.length >= 7 && a_phone === b_phone

      const a_name = a.full_name ?? a.name ?? ''
      const b_name = b.full_name ?? b.name ?? ''
      const name_similarity = computeNameSimilarity(a_name, b_name)

      const a_addr = (a.address ?? '').toLowerCase().trim()
      const b_addr = (b.address ?? '').toLowerCase().trim()
      const address_similarity = a_addr.length > 5 && b_addr.length > 5
        ? computeNameSimilarity(a_addr, b_addr)
        : 0

      // Overall confidence score (0–100)
      let overall_confidence = 0
      if (email_match)                     overall_confidence += 60
      if (phone_match)                     overall_confidence += 30
      if (name_similarity > 0.85)          overall_confidence += 20
      if (name_similarity > 0.70)          overall_confidence += 10
      if (address_similarity > 0.80)       overall_confidence += 10
      overall_confidence = Math.min(100, overall_confidence)

      // Only report if any signal matches
      if (!email_match && !phone_match && name_similarity < 0.85) continue

      seen.add(pairKey)

      // Determine recommendation
      let recommendation: DuplicatePair['recommendation']
      if (overall_confidence >= 90) {
        // Recommend merging into the older record (canonical)
        const a_created = new Date(a.created_at ?? 0).getTime()
        const b_created = new Date(b.created_at ?? 0).getTime()
        recommendation = a_created <= b_created ? 'merge_b_into_a' : 'merge_a_into_b'
      } else if (overall_confidence >= 60) {
        recommendation = 'flag_for_review'
      } else {
        recommendation = 'not_duplicate'
      }

      pairs.push({
        pair_id:      uuidv4(),
        tenant_id:    tenantId,
        record_type:  'contact',
        id_a:         a.id,
        id_b:         b.id,
        match_signals: {
          email_match,
          phone_match,
          name_similarity:    Math.round(name_similarity * 1000) / 1000,
          address_similarity: Math.round(address_similarity * 1000) / 1000,
          overall_confidence,
        },
        recommendation,
        status:       'pending',
        detected_at:  new Date().toISOString(),
      })
    }
  }

  return pairs
}

// ---------------------------------------------------------------------------
// getDedupStats
// ---------------------------------------------------------------------------

export async function getDedupStats(tenantId: string): Promise<{
  contacts: number
  duplicate_estimate: number
  dedup_score: number
}> {
  const db = supabaseAdmin as any

  const [contactCountResult, lastReportResult] = await Promise.allSettled([
    db
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),

    db
      .from('dedup_reports')
      .select('duplicate_pairs_found, records_scanned')
      .eq('tenant_id', tenantId)
      .eq('record_type', 'contact')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const contacts = contactCountResult.status === 'fulfilled'
    ? (contactCountResult.value.count ?? 0)
    : 0

  let duplicate_estimate = 0
  let dedup_score        = 100

  if (lastReportResult.status === 'fulfilled' && lastReportResult.value.data) {
    const report = lastReportResult.value.data as { duplicate_pairs_found: number; records_scanned: number }
    duplicate_estimate = report.duplicate_pairs_found ?? 0
    const scanned = report.records_scanned ?? 1
    dedup_score = Math.max(0, Math.round((1 - duplicate_estimate / scanned) * 100))
  }

  return { contacts, duplicate_estimate, dedup_score }
}

// ---------------------------------------------------------------------------
// runDedupScan — main entry point
// ---------------------------------------------------------------------------

export async function runDedupScan(
  tenantId: string,
  recordType: 'contact' | 'deal' | 'property'
): Promise<DedupReport> {
  const db = supabaseAdmin as any

  // Only contact dedup implemented — deals/properties reserved for future waves
  let pairs: DuplicatePair[] = []
  let records_scanned        = 0

  if (recordType === 'contact') {
    // Count total contacts first
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const countResult = await db
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
    records_scanned = (countResult?.count as number | null) ?? 0
    pairs = await findDuplicateContacts(tenantId)
  }

  const high_confidence_pairs    = pairs.filter(p => p.match_signals.overall_confidence > 80).length
  const estimated_savings_pct    = records_scanned > 0
    ? Math.round((pairs.length / records_scanned) * 100)
    : 0

  const report: DedupReport = {
    run_id:                 uuidv4(),
    tenant_id:              tenantId,
    record_type:            recordType,
    records_scanned,
    duplicate_pairs_found:  pairs.length,
    high_confidence_pairs,
    estimated_savings_pct,
    pairs,
    generated_at:           new Date().toISOString(),
  }

  // Persist to dedup_reports table
  await db.from('dedup_reports').insert({
    id:                     report.run_id,
    tenant_id:              report.tenant_id,
    record_type:            report.record_type,
    records_scanned:        report.records_scanned,
    duplicate_pairs_found:  report.duplicate_pairs_found,
    high_confidence_pairs:  report.high_confidence_pairs,
    pairs:                  report.pairs,
    generated_at:           report.generated_at,
  })

  return report
}
