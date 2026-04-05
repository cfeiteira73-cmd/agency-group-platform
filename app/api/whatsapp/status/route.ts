import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface MetaGraphMeResponse {
  id?: string
  name?: string
  error?: {
    message: string
    code: number
    type: string
  }
}

interface MetaPhoneNumberResponse {
  id?: string
  display_phone_number?: string
  verified_name?: string
  error?: {
    message: string
    code: number
  }
}

export async function GET() {
  const phoneNumberId  = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken    = process.env.WHATSAPP_ACCESS_TOKEN
  const businessId     = process.env.WHATSAPP_BUSINESS_ID
  const sofiaActive    = process.env.WHATSAPP_ACTIVE === 'true'

  // Fast-fail if env vars not configured at all
  if (!phoneNumberId || !accessToken) {
    return NextResponse.json({
      connected: false,
      phone_number_id: phoneNumberId ?? null,
      business_id: businessId ?? null,
      token_valid: false,
      sofia_active: sofiaActive,
      error: 'WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not set',
    })
  }

  try {
    // ── 1. Validate token via /me ─────────────────────────────────────────────
    const meRes = await fetch(
      'https://graph.facebook.com/v21.0/me?fields=name,id',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        // Short timeout — this is a status endpoint
        signal: AbortSignal.timeout(8_000),
      }
    )
    const meData = await meRes.json() as MetaGraphMeResponse

    const tokenValid = meRes.ok && !meData.error

    // ── 2. Verify phone number ID is reachable ────────────────────────────────
    let phoneVerified = false
    let displayPhone: string | null = null

    if (tokenValid) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(8_000),
        }
      )
      const phoneData = await phoneRes.json() as MetaPhoneNumberResponse
      phoneVerified = phoneRes.ok && !phoneData.error
      displayPhone  = phoneData.display_phone_number ?? null
    }

    return NextResponse.json({
      connected: tokenValid && phoneVerified,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhone,
      business_id: businessId ?? null,
      token_valid: tokenValid,
      sofia_active: sofiaActive,
      meta_app_id: meData.id ?? null,
      meta_app_name: meData.name ?? null,
      checked_at: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[WhatsApp] Status check error:', message)
    return NextResponse.json({
      connected: false,
      phone_number_id: phoneNumberId,
      business_id: businessId ?? null,
      token_valid: false,
      sofia_active: sofiaActive,
      error: message,
    })
  }
}
