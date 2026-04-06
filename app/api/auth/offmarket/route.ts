import { NextRequest, NextResponse } from 'next/server'

const VALID_CODES = (process.env.OFFMARKET_CODES || 'offmarket2026,ag2026').split(',')

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    const isValid = VALID_CODES.some(c => c.trim() === code?.trim())
    return NextResponse.json({ valid: isValid })
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 })
  }
}
