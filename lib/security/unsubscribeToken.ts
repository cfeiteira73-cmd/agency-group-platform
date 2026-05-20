// =============================================================================
// Agency Group — Unsubscribe Token: HMAC-SHA256 signed one-click links
// lib/security/unsubscribeToken.ts
//
// Prevents IDOR attacks on /api/alerts/unsubscribe where a plain email
// address could be used to unsubscribe any user.
//
// Token = HMAC_SHA256(AUTH_SECRET, email:zona:tipo)
// Verification: constant-time compare in the unsubscribe route
//
// USAGE (at alert subscription creation time):
//   import { generateUnsubscribeToken, buildUnsubscribeUrl } from '@/lib/security/unsubscribeToken'
//   const url = buildUnsubscribeUrl(email, zona, tipo)
//   // → 'https://agencygroup.pt/api/alerts/unsubscribe?email=...&zona=...&tipo=...&token=HMAC'
// =============================================================================

import { createHmac } from 'crypto'

const BASE_URL = 'https://www.agencygroup.pt'

/**
 * Generate a HMAC-SHA256 token for an unsubscribe link.
 * Token is tied to the specific (email, zona, tipo) triple — cannot be reused
 * for different alert subscriptions.
 */
export function generateUnsubscribeToken(
  email: string,
  zona:  string,
  tipo:  string,
): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('[unsubscribeToken] AUTH_SECRET not set — cannot generate token')
  }
  return createHmac('sha256', secret)
    .update(`${email.toLowerCase()}:${zona}:${tipo}`)
    .digest('hex')
}

/**
 * Build a complete signed unsubscribe URL ready to embed in emails.
 *
 * @example
 *   buildUnsubscribeUrl('carlos@example.com', 'Lisboa', 'Apartamento')
 *   // → 'https://www.agencygroup.pt/api/alerts/unsubscribe?email=carlos%40example.com&zona=Lisboa&tipo=Apartamento&token=abc123...'
 */
export function buildUnsubscribeUrl(
  email: string,
  zona:  string = 'Todas',
  tipo:  string = 'Todos',
): string {
  const token = generateUnsubscribeToken(email, zona, tipo)
  const params = new URLSearchParams({
    email: email.toLowerCase(),
    zona,
    tipo,
    token,
  })
  return `${BASE_URL}/api/alerts/unsubscribe?${params.toString()}`
}
