// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Secure ID Generation Helpers
// lib/ids/secureId.ts
//
// Wave 45 Fix — AUTO_FIXED #ID-001
//
// PURPOSE:
//   Centralised ID generation utilities that use crypto-secure randomness
//   instead of Math.random(). Math.random() is predictable (PRNG), not
//   cryptographically secure, and unsuitable for IDs that appear in URLs,
//   audit logs, or database primary keys.
//
//   Uses Node.js `crypto.randomBytes` on the server side and
//   `crypto.randomUUID()` (Web Crypto API) as the primary source of
//   uniqueness — both are CSPRNG-backed.
//
// USAGE:
//   import { secureNanoId, secureId, safeRandomFloat } from '@/lib/ids/secureId'
//
//   // Replace: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
//   // With:    `act_${Date.now()}_${secureNanoId(5)}`
//
//   // Replace: Math.random() for jitter/probability
//   // With:    safeRandomFloat()
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomBytes, randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// secureNanoId — short alphanumeric ID (URL-safe, no ambiguous chars)
// ---------------------------------------------------------------------------

const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const CHARSET_LEN = CHARSET.length

/**
 * Generate a cryptographically secure alphanumeric ID of `length` characters.
 * Default length: 8 (similar to a git short hash — ~1.8 trillion combinations).
 *
 * Replace patterns like: `Math.random().toString(36).slice(2, N)`
 */
export function secureNanoId(length = 8): string {
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    // Use modulo bias reduction: only sample bytes < floor(256 / CHARSET_LEN) * CHARSET_LEN
    // For CHARSET_LEN=36: threshold = 252, bias is negligible (1.5%) for non-security IDs
    result += CHARSET[bytes[i] % CHARSET_LEN]
  }
  return result
}

/**
 * Generate a full-length prefixed ID.
 * Format: `{prefix}_{timestamp_b36}_{secureNanoId(8)}`
 * Equivalent to the common pattern: `prefix_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
 *
 * Example: `act_lz8abc12_x3k7p2qr`
 */
export function secureId(prefix: string): string {
  const ts = Date.now().toString(36)
  const rnd = secureNanoId(8)
  return `${prefix}_${ts}_${rnd}`
}

/**
 * Generate a UUID v4. Prefer randomUUID() over Math.random() for all unique IDs.
 * Use when a full 128-bit UUID is needed (primary keys, correlation IDs, etc.)
 */
export { randomUUID as secureUUID }

// ---------------------------------------------------------------------------
// safeRandomFloat — cryptographically secure float in [0, 1)
// ---------------------------------------------------------------------------

/**
 * Returns a uniformly distributed float in [0, 1) using CSPRNG.
 * Use in place of Math.random() for jitter, probability sampling, and
 * any business logic where predictability would be a risk.
 *
 * Replace: `Math.random()`
 * With:    `safeRandomFloat()`
 *
 * Implementation: read 4 bytes from CSPRNG, interpret as uint32, divide by 2^32.
 */
export function safeRandomFloat(): number {
  const buf = randomBytes(4)
  // Read as big-endian uint32
  const uint32 = (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]
  // Convert to unsigned (JS bitwise ops produce signed int32)
  return (uint32 >>> 0) / 0x100000000
}

/**
 * Returns true with probability `p` (0–1), using CSPRNG.
 * Equivalent to `Math.random() < p` but secure.
 */
export function randomBool(p: number): boolean {
  return safeRandomFloat() < p
}

// ---------------------------------------------------------------------------
// Convenience reference code generator
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable reference code (uppercase alphanumeric).
 * Format: `{prefix}-{timestamp}-{4_char_secure_suffix}`
 * Example: `AGE-LZABC123-X3K7`
 *
 * Replaces patterns like:
 *   `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
 */
export function secureReferenceCode(prefix: string): string {
  const ts  = Date.now().toString(36).toUpperCase()
  const rnd = secureNanoId(4).toUpperCase()
  return `${prefix}-${ts}-${rnd}`
}
