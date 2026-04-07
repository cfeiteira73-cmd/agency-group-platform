import { timingSafeEqual } from 'crypto'

/**
 * Constant-time string comparison to prevent timing attacks on secrets.
 * Returns false (not equal) when lengths differ — no length-leak side-channel
 * beyond the binary "same length or not" which is acceptable here.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
