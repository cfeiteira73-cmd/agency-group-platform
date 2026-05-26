// lib/legal/eidasQesClient.ts
// eIDAS Qualified Electronic Signature (QES) client
// Provider: Docusign eSignature API (eIDAS QES certified)
// Regulation: EU Regulation No 910/2014 (eIDAS)
// Standard: ETSI EN 319 132 (XAdES) / EN 319 122 (CAdES)
// Alternative: Uanataca (Spain), Certifiel (Portugal/Spain)
// Requires: jose package (npm install jose) for JWT Bearer Grant

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

export type SignatureLevel =
  | 'SES'     // Simple Electronic Signature
  | 'AES'     // Advanced Electronic Signature
  | 'QES'     // Qualified Electronic Signature (eIDAS — highest legal validity)

export interface QesSignatureRequest {
  idempotency_key: string
  deal_id: string
  tenant_id: string
  document_type: 'CPCV' | 'ESCRITURA' | 'PROCURACAO' | 'KYC_DECLARATION' | 'INVESTMENT_MANDATE'
  document_content_base64: string   // PDF document as base64
  document_name: string
  signers: Array<{
    name: string
    email: string
    role: 'BUYER' | 'SELLER' | 'AGENT' | 'NOTARY' | 'WITNESS'
    routing_order: number           // signing order (1 = first)
    require_id_check: boolean       // eIDAS identity proofing
  }>
  signature_level: SignatureLevel
  expiry_hours?: number             // how long signers have (default 72h)
  locale?: 'pt' | 'es' | 'en'
}

export interface QesSignatureResult {
  signature_id: string
  provider: 'DOCUSIGN'
  envelope_id: string
  status: 'SENT' | 'DELIVERED' | 'COMPLETED' | 'DECLINED' | 'VOIDED' | 'EXPIRED'
  signing_url?: string              // URL for first signer
  completed_document_url?: string  // URL to download signed PDF when complete
  created_at: string
  expires_at?: string
}

type NotConfigured = { status: 'NOT_CONFIGURED'; system: string; reason: string; action_required: string }
type LegalError = { status: 'ERROR'; system: string; error: string }

const DS_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID
const DS_USER_ID = process.env.DOCUSIGN_USER_ID
const DS_PRIVATE_KEY = process.env.DOCUSIGN_PRIVATE_KEY?.replace(/\\n/g, '\n')  // PEM key from env
const DS_BASE_URL = process.env.DOCUSIGN_BASE_URL ?? 'https://eu.docusign.net/restapi/v2.1'

function notConfigured(reason?: string): NotConfigured {
  return {
    status: 'NOT_CONFIGURED',
    system: 'Docusign eIDAS QES',
    reason: reason ?? 'DOCUSIGN_ACCOUNT_ID, DOCUSIGN_USER_ID, or DOCUSIGN_PRIVATE_KEY not set',
    action_required: [
      'Create Docusign account at https://echeck.docusign.com',
      'Enable eIDAS QES plan (requires identity verification)',
      'Generate RSA private key for JWT auth',
      'Install jose package: npm install jose',
      'Set DOCUSIGN_ACCOUNT_ID, DOCUSIGN_USER_ID, DOCUSIGN_PRIVATE_KEY, DOCUSIGN_BASE_URL in Vercel',
      'For Portugal QES: consider Certifiel (https://www.certifiel.pt) — ANF AC certified',
      'For Spain QES: consider Uanataca (https://www.uanataca.com) — FNMT partner',
    ].join(' | '),
  }
}

async function getDocusignToken(): Promise<string> {
  if (!DS_ACCOUNT_ID || !DS_USER_ID || !DS_PRIVATE_KEY) {
    throw new Error('Docusign credentials not configured')
  }

  // Dynamic import — requires jose package (npm install jose)
  let joseModule: typeof import('jose')
  try {
    joseModule = await import('jose')
  } catch {
    throw new Error('jose package not installed — run: npm install jose')
  }

  const { SignJWT, importPKCS8 } = joseModule
  const privateKey = await importPKCS8(DS_PRIVATE_KEY, 'RS256')

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(DS_USER_ID)
    .setSubject(DS_USER_ID)
    .setAudience('account-d.docusign.com')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)

  const response = await fetch('https://account-d.docusign.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await response.json() as { access_token: string }
  return data.access_token
}

export async function requestQesSignature(req: QesSignatureRequest): Promise<QesSignatureResult | NotConfigured | LegalError> {
  if (!DS_ACCOUNT_ID || !DS_USER_ID || !DS_PRIVATE_KEY) return notConfigured()

  // Idempotency check
  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from('digital_signatures')
      .select('signature_id, envelope_id, status')
      .eq('idempotency_key', req.idempotency_key)
      .limit(1)

    type ExRow = { signature_id: string; envelope_id: string; status: string }
    const ex = (existing as ExRow[] | null)?.[0]
    if (ex) {
      return {
        signature_id: ex.signature_id,
        provider: 'DOCUSIGN',
        envelope_id: ex.envelope_id,
        status: ex.status as QesSignatureResult['status'],
        created_at: new Date().toISOString(),
      }
    }
  } catch { /* ignore */ }

  let token: string
  try {
    token = await getDocusignToken()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    if (msg.includes('jose package not installed')) {
      return notConfigured('jose package not installed — JWT auth unavailable. Run: npm install jose')
    }
    return { status: 'ERROR', system: 'Docusign QES', error: msg }
  }

  try {
    const expiryHours = req.expiry_hours ?? 72
    const expiresAt = new Date(Date.now() + expiryHours * 3600000).toISOString()

    // Build envelope with eIDAS QES tabs
    const envelope = {
      emailSubject: `Please sign: ${req.document_name}`,
      documents: [{
        documentBase64: req.document_content_base64,
        name: req.document_name,
        fileExtension: 'pdf',
        documentId: '1',
      }],
      recipients: {
        signers: req.signers.map((signer, i) => ({
          email: signer.email,
          name: signer.name,
          signerName: signer.name,
          recipientId: String(i + 1),
          routingOrder: String(signer.routing_order),
          identityVerification: signer.require_id_check ? {
            workflowId: process.env.DOCUSIGN_EIDAS_WORKFLOW_ID ?? 'eidas_qes',
          } : undefined,
          tabs: {
            signHereTabs: [{
              anchorString: `SIGNATURE_${signer.role}`,
              anchorUnits: 'pixels',
              anchorXOffset: '0',
              anchorYOffset: '0',
            }],
            dateSigned: [{
              anchorString: `DATE_${signer.role}`,
              anchorUnits: 'pixels',
            }],
          },
        })),
      },
      status: 'sent',
      expireEnabled: 'true',
      expireAfter: String(expiryHours * 60),  // minutes
      notification: {
        useAccountDefaults: false,
        reminders: { reminderEnabled: 'true', reminderDelay: '24', reminderFrequency: '24' },
        expirations: { expireEnabled: 'true', expireAfter: String(expiryHours * 60), expireWarn: '60' },
      },
    }

    const response = await fetch(`${DS_BASE_URL}/accounts/${DS_ACCOUNT_ID}/envelopes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelope),
    })

    if (!response.ok) {
      const errorData = await response.json() as { message?: string; errorCode?: string }
      return { status: 'ERROR', system: 'Docusign QES', error: errorData.message ?? `HTTP ${response.status}` }
    }

    const data = await response.json() as { envelopeId: string; status: string; uri: string }

    const result: QesSignatureResult = {
      signature_id: randomUUID(),
      provider: 'DOCUSIGN',
      envelope_id: data.envelopeId,
      status: 'SENT',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    }

    void (supabaseAdmin as any)
      .from('digital_signatures')
      .insert({
        signature_id: result.signature_id,
        tenant_id: req.tenant_id,
        deal_id: req.deal_id,
        idempotency_key: req.idempotency_key,
        document_type: req.document_type,
        document_name: req.document_name,
        provider: 'DOCUSIGN',
        envelope_id: result.envelope_id,
        status: result.status,
        signature_level: req.signature_level,
        signers_count: req.signers.length,
        expires_at: result.expires_at ?? null,
        created_at: result.created_at,
      })
      .catch((e: unknown) => log.warn('[eidasQesClient] persist error', { e }))

    log.info('[eidasQesClient] envelope sent', { signature_id: result.signature_id, envelope_id: data.envelopeId })
    return result
  } catch (e) {
    log.warn('[eidasQesClient] error', { e })
    return { status: 'ERROR', system: 'Docusign QES', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export function isConfigured(): boolean {
  return !!(DS_ACCOUNT_ID && DS_USER_ID && DS_PRIVATE_KEY)
}
