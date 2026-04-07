import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  return NextResponse.json({
    url: req.url,
    cookies: allCookies.map(c => ({ name: c.name, hasValue: !!c.value })),
    env: {
      hasAuthSecret: !!process.env.AUTH_SECRET || !!process.env.NEXTAUTH_SECRET,
      hasResend: !!process.env.RESEND_API_KEY,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nodeEnv: process.env.NODE_ENV,
    }
  })
}
