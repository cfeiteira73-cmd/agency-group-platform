// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Notary Integration
// lib/legal-execution/notaryIntegration.ts
//
// Abstraction layer for Portuguese notary APIs.
// External integrations are graceful no-ops when NOTARY_API_KEY is absent.
// All data is always persisted to Supabase regardless of external availability.
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotaryAppointment {
  appointment_id: string
  tenant_id: string
  workflow_id: string
  notary_code: string
  scheduled_date: string
  location: string
  status: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  confirmation_ref: string | null
  created_at: string
}

export interface NotaryDocument {
  doc_id: string
  workflow_id: string
  doc_type: 'CPCV' | 'ESCRITURA' | 'PROCURACAO' | 'CERTIDAO'
  doc_url: string | null
  signed: boolean
  notary_ref: string | null
  created_at: string
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToAppointment(row: Record<string, unknown>): NotaryAppointment {
  return {
    appointment_id:   String(row['appointment_id'] ?? ''),
    tenant_id:        String(row['tenant_id'] ?? ''),
    workflow_id:      String(row['workflow_id'] ?? ''),
    notary_code:      String(row['notary_code'] ?? ''),
    scheduled_date:   String(row['scheduled_date'] ?? ''),
    location:         String(row['location'] ?? ''),
    status:           String(row['status'] ?? 'REQUESTED') as NotaryAppointment['status'],
    confirmation_ref: row['confirmation_ref'] != null ? String(row['confirmation_ref']) : null,
    created_at:       String(row['created_at'] ?? new Date().toISOString()),
  }
}

function rowToDocument(row: Record<string, unknown>): NotaryDocument {
  return {
    doc_id:     String(row['doc_id'] ?? ''),
    workflow_id: String(row['workflow_id'] ?? ''),
    doc_type:   String(row['doc_type'] ?? 'CPCV') as NotaryDocument['doc_type'],
    doc_url:    row['doc_url'] != null ? String(row['doc_url']) : null,
    signed:     Boolean(row['signed'] ?? false),
    notary_ref: row['notary_ref'] != null ? String(row['notary_ref']) : null,
    created_at: String(row['created_at'] ?? new Date().toISOString()),
  }
}

// ─── requestNotaryAppointment ─────────────────────────────────────────────────

/**
 * Requests a notary appointment.
 * If NOTARY_API_KEY is set, attempts to call external API (graceful no-op on failure).
 * Always persists to notary_appointments with status REQUESTED.
 */
export async function requestNotaryAppointment(
  workflowId: string,
  tenantId: string,
  preferredDate: string,
): Promise<NotaryAppointment> {
  const appointmentId = `nap_${randomUUID().replace(/-/g, '')}`
  const createdAt = new Date().toISOString()

  // Attempt external API call if configured
  let externalNotaryCode = `NTC-${Date.now()}`
  const notaryApiKey = process.env.NOTARY_API_KEY
  const notaryApiUrl = process.env.NOTARY_API_URL ?? 'https://api.notarios.pt/v1'

  if (notaryApiKey) {
    try {
      const res = await fetch(`${notaryApiUrl}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${notaryApiKey}`,
        },
        body: JSON.stringify({
          workflow_id: workflowId,
          preferred_date: preferredDate,
          appointment_id: appointmentId,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const payload = (await res.json()) as Record<string, unknown>
        if (payload['notary_code']) externalNotaryCode = String(payload['notary_code'])
        log.info('[notaryIntegration] external appointment request succeeded', { appointment_id: appointmentId })
      } else {
        log.warn('[notaryIntegration] external API returned non-OK', { status: res.status, appointment_id: appointmentId })
      }
    } catch (err) {
      void Promise.resolve(err).catch(e => console.warn('[notaryIntegration] external API error', e))
      log.warn('[notaryIntegration] external appointment API unavailable — graceful no-op', { workflow_id: workflowId })
    }
  }

  const row: Record<string, unknown> = {
    appointment_id:   appointmentId,
    tenant_id:        tenantId,
    workflow_id:      workflowId,
    notary_code:      externalNotaryCode,
    scheduled_date:   preferredDate,
    location:         'Cartório Notarial — a confirmar',
    status:           'REQUESTED',
    confirmation_ref: null,
    created_at:       createdAt,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('notary_appointments')
    .insert(row)
    .select()
    .single()

  if (error) {
    log.error('[notaryIntegration] requestNotaryAppointment insert failed', error, { workflow_id: workflowId, tenant_id: tenantId })
    throw new Error(`Failed to persist notary appointment: ${error.message}`)
  }

  log.info('[notaryIntegration] notary appointment requested', { appointment_id: appointmentId, workflow_id: workflowId })
  return rowToAppointment(data as Record<string, unknown>)
}

// ─── confirmNotaryAppointment ─────────────────────────────────────────────────

/**
 * Updates notary_appointments status to CONFIRMED with a confirmation reference.
 */
export async function confirmNotaryAppointment(
  appointmentId: string,
  confirmationRef: string,
  tenantId: string,
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('notary_appointments')
    .update({ status: 'CONFIRMED', confirmation_ref: confirmationRef })
    .eq('appointment_id', appointmentId)
    .eq('tenant_id', tenantId)

  if (error) {
    log.error('[notaryIntegration] confirmNotaryAppointment failed', error, { appointment_id: appointmentId })
    throw new Error(`Failed to confirm notary appointment: ${error.message}`)
  }

  log.info('[notaryIntegration] appointment confirmed', { appointment_id: appointmentId, confirmation_ref: confirmationRef })
}

// ─── submitDocumentForSignature ───────────────────────────────────────────────

/**
 * Persists document to notary_documents and optionally submits to external notary API.
 */
export async function submitDocumentForSignature(
  workflowId: string,
  docType: NotaryDocument['doc_type'],
  docUrl: string,
  tenantId: string,
): Promise<NotaryDocument> {
  const docId = `ndoc_${randomUUID().replace(/-/g, '')}`
  const createdAt = new Date().toISOString()

  let externalNotaryRef: string | null = null
  const notaryApiKey = process.env.NOTARY_API_KEY
  const notaryApiUrl = process.env.NOTARY_API_URL ?? 'https://api.notarios.pt/v1'

  if (notaryApiKey) {
    try {
      const res = await fetch(`${notaryApiUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${notaryApiKey}`,
        },
        body: JSON.stringify({
          doc_id: docId,
          workflow_id: workflowId,
          doc_type: docType,
          doc_url: docUrl,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const payload = (await res.json()) as Record<string, unknown>
        if (payload['notary_ref']) externalNotaryRef = String(payload['notary_ref'])
        log.info('[notaryIntegration] document submitted to notary API', { doc_id: docId })
      } else {
        log.warn('[notaryIntegration] document submission API returned non-OK', { status: res.status, doc_id: docId })
      }
    } catch (err) {
      void Promise.resolve(err).catch(e => console.warn('[notaryIntegration] document API error', e))
      log.warn('[notaryIntegration] document submission API unavailable — graceful no-op', { workflow_id: workflowId, doc_type: docType })
    }
  }

  const row: Record<string, unknown> = {
    doc_id:     docId,
    tenant_id:  tenantId,
    workflow_id: workflowId,
    doc_type:   docType,
    doc_url:    docUrl,
    signed:     false,
    notary_ref: externalNotaryRef,
    created_at: createdAt,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('notary_documents')
    .insert(row)
    .select()
    .single()

  if (error) {
    log.error('[notaryIntegration] submitDocumentForSignature insert failed', error, { workflow_id: workflowId, doc_type: docType })
    throw new Error(`Failed to persist notary document: ${error.message}`)
  }

  log.info('[notaryIntegration] document submitted', { doc_id: docId, workflow_id: workflowId, doc_type: docType })
  return rowToDocument(data as Record<string, unknown>)
}

// ─── getNotaryDocuments ───────────────────────────────────────────────────────

export async function getNotaryDocuments(
  workflowId: string,
  tenantId: string,
): Promise<NotaryDocument[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('notary_documents')
    .select('*')
    .eq('workflow_id', workflowId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) {
    log.warn('[notaryIntegration] getNotaryDocuments query failed', { error: error.message, workflow_id: workflowId })
    return []
  }

  return Array.isArray(data) ? (data as Record<string, unknown>[]).map(rowToDocument) : []
}
