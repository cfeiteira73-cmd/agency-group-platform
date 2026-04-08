import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let confirmedEmail: string | undefined
  try {
    const body = await req.json()
    confirmedEmail = body?.confirmedEmail
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!confirmedEmail || confirmedEmail !== session.user.email) {
    return NextResponse.json({ error: 'Email confirmation mismatch' }, { status: 400 })
  }

  const userId = session.user.id

  // Cascade delete user data (GDPR Article 17 — Right to Erasure)
  await Promise.allSettled([
    db.from('sofia_conversations').delete().eq('user_id', userId),
    db.from('property_collections').delete().eq('agent_id', userId),
    db.from('push_subscriptions').delete().eq('user_id', userId),
    db.from('used_magic_tokens').delete().eq('user_id', userId),
    db.from('profiles').delete().eq('id', userId),
  ])

  return NextResponse.json({
    ok: true,
    message: 'Conta e todos os dados pessoais eliminados (GDPR Art. 17)',
  })
}
