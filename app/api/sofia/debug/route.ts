// TEMPORARY DEBUG ROUTE — remove after diagnosing LiveAvatar migration
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 500 })

  const results: Record<string, unknown> = { api_key_prefix: apiKey.slice(0, 12) + '...' }

  // Try LiveAvatar list avatars
  try {
    const r1 = await fetch('https://api.liveavatar.com/v1/avatars', {
      headers: { 'X-API-KEY': apiKey },
    })
    const t1 = await r1.text()
    results.liveavatar_avatars = { status: r1.status, body: JSON.parse(t1) }
  } catch (e) { results.liveavatar_avatars_err = String(e) }

  // Try LiveAvatar list voices
  try {
    const r2 = await fetch('https://api.liveavatar.com/v1/voices', {
      headers: { 'X-API-KEY': apiKey },
    })
    const t2 = await r2.text()
    results.liveavatar_voices = { status: r2.status, body: JSON.parse(t2) }
  } catch (e) { results.liveavatar_voices_err = String(e) }

  return NextResponse.json(results)
}
