// lib/legal/legalExecutionOrchestrator.ts
// Orchestrates the complete legal execution sequence for property transactions
// Flow: eIDAS signature → Notary appointment → Land registry submission

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { isConfigured as notaryPTConfigured } from './notaryPortugalAdapter'
import { isConfigured as notaryESConfigured } from './notarySpainAdapter'
import { isConfigured as landRegistryPTConfigured } from './landRegistryPortugalAdapter'
import { isConfigured as eidasConfigured } from './eidasQesClient'

export interface LegalSystemStatus {
  checked_at: string
  country: 'PT' | 'ES'
  systems: Array<{
    system: string
    configured: boolean
    status: 'ACTIVE' | 'NOT_CONFIGURED'
    env_vars_required: string[]
    action_required?: string
  }>
  fully_configured: boolean
  minimum_viable: boolean  // can process deals with manual steps
}

export async function getLegalSystemStatus(): Promise<{ PT: LegalSystemStatus; ES: LegalSystemStatus }> {
  const checkedAt = new Date().toISOString()

  const PT: LegalSystemStatus = {
    checked_at: checkedAt,
    country: 'PT',
    systems: [
      {
        system: 'IRN Notary (Escrituras)',
        configured: notaryPTConfigured(),
        status: notaryPTConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
        env_vars_required: ['IRN_PT_API_KEY', 'IRN_PT_BASE_URL'],
        action_required: notaryPTConfigured() ? undefined : 'Contact IRN at https://www.irn.mj.pt',
      },
      {
        system: 'Predial Online (Land Registry)',
        configured: landRegistryPTConfigured(),
        status: landRegistryPTConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
        env_vars_required: ['IRN_PT_REGISTRY_API_KEY', 'IRN_PT_REGISTRY_URL'],
        action_required: landRegistryPTConfigured() ? undefined : 'Contact IRN for Predial Online API access',
      },
      {
        system: 'eIDAS QES (Docusign)',
        configured: eidasConfigured(),
        status: eidasConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
        env_vars_required: ['DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_USER_ID', 'DOCUSIGN_PRIVATE_KEY'],
        action_required: eidasConfigured() ? undefined : 'Setup Docusign eIDAS at https://echeck.docusign.com',
      },
    ],
    fully_configured: notaryPTConfigured() && landRegistryPTConfigured() && eidasConfigured(),
    minimum_viable: eidasConfigured(),  // can at least do digital signing
  }

  const ES: LegalSystemStatus = {
    checked_at: checkedAt,
    country: 'ES',
    systems: [
      {
        system: 'ANCERT Notary (Compraventas)',
        configured: notaryESConfigured(),
        status: notaryESConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
        env_vars_required: ['ANCERT_ES_API_KEY', 'ANCERT_ES_BASE_URL'],
        action_required: notaryESConfigured() ? undefined : 'Contact ANCERT at https://www.ancert.com',
      },
      {
        system: 'Registradores Spain (Land Registry)',
        configured: false,  // separate adapter TBD
        status: 'NOT_CONFIGURED',
        env_vars_required: ['REGISTRADORES_ES_API_KEY', 'REGISTRADORES_ES_BASE_URL'],
        action_required: 'Contact Colegio de Registradores at https://www.registradores.org for API access',
      },
      {
        system: 'eIDAS QES (Docusign)',
        configured: eidasConfigured(),
        status: eidasConfigured() ? 'ACTIVE' : 'NOT_CONFIGURED',
        env_vars_required: ['DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_USER_ID', 'DOCUSIGN_PRIVATE_KEY'],
        action_required: eidasConfigured() ? undefined : 'Setup Docusign eIDAS',
      },
    ],
    fully_configured: notaryESConfigured() && eidasConfigured(),
    minimum_viable: eidasConfigured(),
  }

  return { PT, ES }
}

export async function logLegalAction(params: {
  tenant_id: string
  deal_id: string
  action_type: 'SIGNATURE_REQUESTED' | 'SIGNATURE_COMPLETED' | 'NOTARY_BOOKED' | 'DEED_SIGNED' | 'REGISTRY_SUBMITTED' | 'REGISTRY_CONFIRMED'
  system: string
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  reference?: string
  detail?: string
}): Promise<void> {
  try {
    await (supabaseAdmin as any)
      .from('legal_execution_log')
      .insert({
        tenant_id: params.tenant_id,
        deal_id: params.deal_id,
        action_type: params.action_type,
        system: params.system,
        status: params.status,
        reference: params.reference ?? null,
        detail: params.detail ?? null,
        logged_at: new Date().toISOString(),
      })
  } catch (e) {
    log.warn('[legalExecutionOrchestrator] log error', { e })
  }
}
