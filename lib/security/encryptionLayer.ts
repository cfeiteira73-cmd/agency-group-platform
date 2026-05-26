// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Encryption Layer — Envelope Encryption with AES-256-GCM
// Wave 44 Agent 1 — Production Lock
// =============================================================================

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

// ── Constants ──────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // bytes
const AUTH_TAG_LENGTH = 16 // bytes

// ── Key Derivation ─────────────────────────────────────────────────────

/**
 * Safely derive a 32-byte key buffer from a hex string.
 * Handles short keys gracefully by right-padding with zeros.
 */
function deriveKey(keyHex: string): Buffer {
  const safeHex = keyHex.padEnd(64, '0').slice(0, 64)
  return Buffer.from(safeHex, 'hex')
}

function resolveKeyHex(keyHex?: string): string | null {
  const k = keyHex ?? process.env.ENCRYPTION_KEY_PRIMARY ?? ''
  if (!k || k.trim() === '') return null
  return k
}

// ── Encryption ─────────────────────────────────────────────────────────

export interface EncryptedField {
  ciphertext: string // base64
  iv: string         // hex
  tag: string        // hex
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns { ciphertext, iv, tag } all as strings.
 * Returns a sentinel value if encryption is not configured.
 */
export function encryptField(plaintext: string, keyHex?: string): EncryptedField {
  const resolvedKey = resolveKeyHex(keyHex)
  if (!resolvedKey) {
    console.warn('[encryptionLayer] ENCRYPTION_NOT_CONFIGURED — encrypt called without a key')
    return { ciphertext: '', iv: '', tag: 'ENCRYPTION_NOT_CONFIGURED' }
  }

  try {
    const key = deriveKey(resolvedKey)
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    }
  } catch (err) {
    console.warn('[encryptionLayer] encryptField error', err)
    return { ciphertext: '', iv: '', tag: 'ENCRYPTION_ERROR' }
  }
}

/**
 * Decrypt an encrypted field.
 * Returns null on any failure — never throws.
 */
export function decryptField(encrypted: EncryptedField, keyHex?: string): string | null {
  if (encrypted.tag === 'ENCRYPTION_NOT_CONFIGURED' || encrypted.tag === 'ENCRYPTION_ERROR') {
    return null
  }
  if (!encrypted.ciphertext || !encrypted.iv || !encrypted.tag) {
    return null
  }

  const resolvedKey = resolveKeyHex(keyHex)
  if (!resolvedKey) {
    console.warn('[encryptionLayer] ENCRYPTION_NOT_CONFIGURED — decrypt called without a key')
    return null
  }

  try {
    const key = deriveKey(resolvedKey)
    const iv = Buffer.from(encrypted.iv, 'hex')
    const tag = Buffer.from(encrypted.tag, 'hex')
    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64')

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch {
    // Auth tag mismatch, wrong key, etc. — swallow silently
    return null
  }
}

// ── Hashing ────────────────────────────────────────────────────────────

/**
 * Hash a value for deterministic storage (e.g., PII lookup fields).
 * Uses SHA-256 with an application-level salt.
 */
export function hashForStorage(value: string, salt?: string): string {
  const effectiveSalt = salt ?? process.env.HASH_SALT ?? 'ag-salt-2026'
  return createHash('sha256').update(value + effectiveSalt).digest('hex')
}

/**
 * Generate a stable idempotency key from component strings.
 * Returns the first 32 hex chars of SHA-256.
 */
export function generateIdempotencyKey(components: string[]): string {
  const input = components.join('::')
  return createHash('sha256').update(input).digest('hex').slice(0, 32)
}
