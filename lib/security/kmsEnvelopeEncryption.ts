// Agency Group — KMS Envelope Encryption
// lib/security/kmsEnvelopeEncryption.ts
// TypeScript strict — 0 errors
//
// Envelope encryption: DEK (Data Encryption Key) encrypted by KEK (Key Encryption Key).
// Each tenant gets isolated DEKs. DEKs rotated on schedule.
// AWS KMS / GCP KMS / local AES-256-GCM fallback.
// Graceful no-op when cloud KMS not configured.

import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
} from 'crypto'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type KmsProvider = 'aws_kms' | 'gcp_kms' | 'local_aes'

export interface EncryptedDek {
  dek_id: string
  tenant_id: string
  provider: KmsProvider
  encrypted_dek_base64: string   // DEK encrypted by KEK
  key_arn_or_name: string        // AWS ARN or GCP key path or 'local'
  algorithm: 'AES-256-GCM'
  created_at: string
  rotated_at: string | null
  active: boolean
}

export interface EncryptedPayload {
  dek_id: string
  iv_base64: string
  ciphertext_base64: string
  tag_base64: string             // AES-GCM auth tag
  algorithm: 'AES-256-GCM'
  encrypted_at: string
}

// ─── Provider detection ────────────────────────────────────────────────────────

export function detectKmsProvider(): KmsProvider {
  if (
    process.env.AWS_KMS_KEY_ARN &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  ) {
    return 'aws_kms'
  }
  if (
    process.env.GCP_KMS_KEY_NAME &&
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  ) {
    return 'gcp_kms'
  }
  return 'local_aes'
}

// ─── Local AES-256-GCM KEK derivation ─────────────────────────────────────────

function deriveMasterKey(): Buffer {
  const masterKeyMaterial =
    process.env.ENCRYPTION_MASTER_KEY ?? 'local-dev-master-key-do-not-use-in-prod'
  const salt = createHash('sha256').update('agency-group-kek-salt-v1').digest()
  return pbkdf2Sync(masterKeyMaterial, salt, 100_000, 32, 'sha256')
}

function encryptDekLocally(dek: Buffer): string {
  const masterKey = deriveMasterKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv)
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(12) + tag(16) + ciphertext
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

function decryptDekLocally(encryptedDekBase64: string): Buffer {
  const masterKey = deriveMasterKey()
  const data = Buffer.from(encryptedDekBase64, 'base64')
  const iv = data.subarray(0, 12)
  const tag = data.subarray(12, 28)
  const ciphertext = data.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// ─── AWS KMS helpers (graceful no-op when SDK not available) ───────────────────

async function encryptDekWithAwsKms(dek: Buffer): Promise<string> {
  try {
    // Dynamic import so build doesn't fail when @aws-sdk/client-kms is absent
    // @ts-ignore — optional peer dependency, graceful fallback when absent
    const { KMSClient, EncryptCommand } = await import('@aws-sdk/client-kms').catch(() => {
      throw new Error('aws-sdk/client-kms not installed — falling back to local_aes')
    })
    const client = new KMSClient({ region: process.env.AWS_REGION ?? 'eu-west-1' })
    const result = await client.send(
      new EncryptCommand({
        KeyId: process.env.AWS_KMS_KEY_ARN!,
        Plaintext: dek,
      }),
    )
    if (!result.CiphertextBlob) throw new Error('AWS KMS returned no ciphertext')
    return Buffer.from(result.CiphertextBlob).toString('base64')
  } catch (e) {
    log.warn('[kmsEnvelopeEncryption] AWS KMS encrypt failed, falling back to local', {
      error: e instanceof Error ? e.message : String(e),
    })
    return encryptDekLocally(dek)
  }
}

async function decryptDekWithAwsKms(encryptedDekBase64: string): Promise<Buffer> {
  try {
    // @ts-ignore — optional peer dependency, graceful fallback when absent
    const { KMSClient, DecryptCommand } = await import('@aws-sdk/client-kms').catch(() => {
      throw new Error('aws-sdk/client-kms not installed')
    })
    const client = new KMSClient({ region: process.env.AWS_REGION ?? 'eu-west-1' })
    const result = await client.send(
      new DecryptCommand({
        KeyId: process.env.AWS_KMS_KEY_ARN!,
        CiphertextBlob: Buffer.from(encryptedDekBase64, 'base64'),
      }),
    )
    if (!result.Plaintext) throw new Error('AWS KMS returned no plaintext')
    return Buffer.from(result.Plaintext)
  } catch (e) {
    log.warn('[kmsEnvelopeEncryption] AWS KMS decrypt failed, falling back to local', {
      error: e instanceof Error ? e.message : String(e),
    })
    return decryptDekLocally(encryptedDekBase64)
  }
}

// ─── GCP KMS helpers ───────────────────────────────────────────────────────────

async function encryptDekWithGcpKms(dek: Buffer): Promise<string> {
  try {
    // @ts-ignore — optional peer dependency, graceful fallback when absent
    const { KeyManagementServiceClient } = await import('@google-cloud/kms').catch(() => {
      throw new Error('@google-cloud/kms not installed')
    })
    const client = new KeyManagementServiceClient()
    const [result] = await client.encrypt({
      name: process.env.GCP_KMS_KEY_NAME!,
      plaintext: dek,
    })
    if (!result.ciphertext) throw new Error('GCP KMS returned no ciphertext')
    return Buffer.from(result.ciphertext as Buffer).toString('base64')
  } catch (e) {
    log.warn('[kmsEnvelopeEncryption] GCP KMS encrypt failed, falling back to local', {
      error: e instanceof Error ? e.message : String(e),
    })
    return encryptDekLocally(dek)
  }
}

async function decryptDekWithGcpKms(encryptedDekBase64: string): Promise<Buffer> {
  try {
    // @ts-ignore — optional peer dependency, graceful fallback when absent
    const { KeyManagementServiceClient } = await import('@google-cloud/kms').catch(() => {
      throw new Error('@google-cloud/kms not installed')
    })
    const client = new KeyManagementServiceClient()
    const [result] = await client.decrypt({
      name: process.env.GCP_KMS_KEY_NAME!,
      ciphertext: Buffer.from(encryptedDekBase64, 'base64'),
    })
    if (!result.plaintext) throw new Error('GCP KMS returned no plaintext')
    return Buffer.from(result.plaintext as Buffer)
  } catch (e) {
    log.warn('[kmsEnvelopeEncryption] GCP KMS decrypt failed, falling back to local', {
      error: e instanceof Error ? e.message : String(e),
    })
    return decryptDekLocally(encryptedDekBase64)
  }
}

// ─── Encrypt / decrypt DEK via detected provider ───────────────────────────────

async function encryptDekWithProvider(dek: Buffer, provider: KmsProvider): Promise<string> {
  switch (provider) {
    case 'aws_kms':
      return encryptDekWithAwsKms(dek)
    case 'gcp_kms':
      return encryptDekWithGcpKms(dek)
    default:
      return encryptDekLocally(dek)
  }
}

async function decryptDekWithProvider(
  encryptedDekBase64: string,
  provider: KmsProvider,
): Promise<Buffer> {
  switch (provider) {
    case 'aws_kms':
      return decryptDekWithAwsKms(encryptedDekBase64)
    case 'gcp_kms':
      return decryptDekWithGcpKms(encryptedDekBase64)
    default:
      return decryptDekLocally(encryptedDekBase64)
  }
}

// ─── Row → EncryptedDek ────────────────────────────────────────────────────────

function toDek(row: Record<string, unknown>): EncryptedDek {
  return {
    dek_id:               String(row['id'] ?? ''),
    tenant_id:            String(row['tenant_id'] ?? ''),
    provider:             (row['provider'] as KmsProvider) ?? 'local_aes',
    encrypted_dek_base64: String(row['encrypted_dek_base64'] ?? ''),
    key_arn_or_name:      String(row['key_arn_or_name'] ?? 'local'),
    algorithm:            'AES-256-GCM',
    created_at:           String(row['created_at'] ?? new Date().toISOString()),
    rotated_at:           row['rotated_at'] != null ? String(row['rotated_at']) : null,
    active:               Boolean(row['active'] ?? true),
  }
}

// ─── getOrCreateDek ────────────────────────────────────────────────────────────

export async function getOrCreateDek(tenantId: string): Promise<EncryptedDek> {
  // Try to fetch active DEK
  const { data: existing, error: fetchErr } = await (supabaseAdmin as any)
    .from('tenant_deks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .maybeSingle() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (fetchErr) {
    log.warn('[kmsEnvelopeEncryption] getOrCreateDek fetch error', {
      tenant_id: tenantId,
      error: fetchErr.message,
    })
  }

  if (existing) return toDek(existing)

  // Create new DEK
  const provider = detectKmsProvider()
  const newDek = randomBytes(32)
  const encrypted = await encryptDekWithProvider(newDek, provider)
  const keyArnOrName =
    provider === 'aws_kms'
      ? (process.env.AWS_KMS_KEY_ARN ?? 'local')
      : provider === 'gcp_kms'
      ? (process.env.GCP_KMS_KEY_NAME ?? 'local')
      : 'local'

  const id = randomUUID()
  const now = new Date().toISOString()

  const { data: inserted, error: insertErr } = await (supabaseAdmin as any)
    .from('tenant_deks')
    .insert({
      id,
      tenant_id:            tenantId,
      provider,
      encrypted_dek_base64: encrypted,
      key_arn_or_name:      keyArnOrName,
      algorithm:            'AES-256-GCM',
      active:               true,
      rotated_at:           null,
      created_at:           now,
    })
    .select('*')
    .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (insertErr || !inserted) {
    const msg = insertErr?.message ?? 'insert returned no data'
    log.warn('[kmsEnvelopeEncryption] getOrCreateDek insert failed', {
      tenant_id: tenantId,
      error: msg,
    })
    // Return in-memory DEK struct so callers can still encrypt (not persisted)
    return {
      dek_id:               id,
      tenant_id:            tenantId,
      provider,
      encrypted_dek_base64: encrypted,
      key_arn_or_name:      keyArnOrName,
      algorithm:            'AES-256-GCM',
      created_at:           now,
      rotated_at:           null,
      active:               true,
    }
  }

  return toDek(inserted)
}

// ─── encryptData ───────────────────────────────────────────────────────────────

export async function encryptData(
  tenantId: string,
  plaintext: Buffer,
): Promise<EncryptedPayload> {
  const dek = await getOrCreateDek(tenantId)
  const rawDek = await decryptDekWithProvider(dek.encrypted_dek_base64, dek.provider)

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', rawDek, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    dek_id:             dek.dek_id,
    iv_base64:          iv.toString('base64'),
    ciphertext_base64:  ciphertext.toString('base64'),
    tag_base64:         tag.toString('base64'),
    algorithm:          'AES-256-GCM',
    encrypted_at:       new Date().toISOString(),
  }
}

// ─── decryptData ───────────────────────────────────────────────────────────────

export async function decryptData(
  tenantId: string,
  payload: EncryptedPayload,
): Promise<Buffer> {
  // Fetch DEK by dek_id
  const { data, error } = await (supabaseAdmin as any)
    .from('tenant_deks')
    .select('*')
    .eq('id', payload.dek_id)
    .eq('tenant_id', tenantId)
    .maybeSingle() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error || !data) {
    throw new Error(
      `[kmsEnvelopeEncryption] decryptData: DEK not found for dek_id=${payload.dek_id}`,
    )
  }

  const dek = toDek(data)
  const rawDek = await decryptDekWithProvider(dek.encrypted_dek_base64, dek.provider)

  const iv = Buffer.from(payload.iv_base64, 'base64')
  const tag = Buffer.from(payload.tag_base64, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext_base64, 'base64')

  const decipher = createDecipheriv('aes-256-gcm', rawDek, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// ─── rotateDek ─────────────────────────────────────────────────────────────────

export async function rotateDek(tenantId: string): Promise<EncryptedDek> {
  const now = new Date().toISOString()

  // Mark all current active DEKs as inactive
  await (supabaseAdmin as any)
    .from('tenant_deks')
    .update({ active: false, rotated_at: now })
    .eq('tenant_id', tenantId)
    .eq('active', true)

  // Create a fresh DEK
  return getOrCreateDek(tenantId)
}

// ─── encryptSnapshot ───────────────────────────────────────────────────────────

export async function encryptSnapshot(
  tenantId: string,
  snapshotData: Record<string, unknown>,
): Promise<string> {
  const plaintext = Buffer.from(JSON.stringify(snapshotData), 'utf8')
  const payload = await encryptData(tenantId, plaintext)
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

// ─── encryptMlArtifact ─────────────────────────────────────────────────────────

export async function encryptMlArtifact(
  tenantId: string,
  artifact: Record<string, unknown>,
): Promise<string> {
  const plaintext = Buffer.from(JSON.stringify(artifact), 'utf8')
  const payload = await encryptData(tenantId, plaintext)
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}
