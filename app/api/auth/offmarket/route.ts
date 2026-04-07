import { NextRequest, NextResponse } from 'next/server'

// Set OFFMARKET_CODES=code1,code2 in Vercel env vars
const VALID_CODES = process.env.OFFMARKET_CODES?.split(',') ?? []

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    const isValid = VALID_CODES.some(c => c.trim() === code?.trim())
    return NextResponse.json({ valid: isValid })
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 })
  }
}
