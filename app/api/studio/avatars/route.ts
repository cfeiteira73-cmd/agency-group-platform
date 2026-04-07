import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return NextResponse.json({ avatars: [], voices: [], configured: false })
  }

  try {
    const [avRes, voRes] = await Promise.all([
      fetch('https://api.heygen.com/v2/avatars', { headers: { 'x-api-key': apiKey } }),
      fetch('https://api.heygen.com/v2/voices',  { headers: { 'x-api-key': apiKey } }),
    ])

    const [avJson, voJson] = await Promise.all([avRes.json(), voRes.json()])

    const avatars = (avJson.data?.avatars ?? []) as Array<{
      avatar_id: string; avatar_name: string; gender: string
      preview_image_url: string; default_voice_id: string
    }>

    const voices = (voJson.data?.voices ?? []) as Array<{
      voice_id: string; name: string; language: string; gender: string; emotion_support: boolean
    }>

    return NextResponse.json({ avatars, voices, configured: true })
  } catch (err) {
    return NextResponse.json({ avatars: [], voices: [], configured: false, error: String(err) })
  }
}
