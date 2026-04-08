import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // Fetch all user data in parallel (GDPR Article 20 — Right to Data Portability)
  const [conversations, collections, profile] = await Promise.allSettled([
    db.from('sofia_conversations').select('*').eq('user_id', userId),
    db.from('property_collections').select('*').eq('agent_id', userId),
    db.from('profiles').select('*').eq('id', userId).single(),
  ])

  const exportData = {
    exportDate: new Date().toISOString(),
    gdprBasis: 'GDPR Article 20 — Right to Data Portability',
    user: {
      id: userId,
      email: session.user.email,
      name: session.user.name,
    },
    data: {
      conversations:
        conversations.status === 'fulfilled' ? conversations.value.data : [],
      collections:
        collections.status === 'fulfilled' ? collections.value.data : [],
      profile:
        profile.status === 'fulfilled' ? profile.value.data : null,
    },
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="agency-group-data-export-${Date.now()}.json"`,
    },
  })
}
