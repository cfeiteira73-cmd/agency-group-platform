import { auth } from '@/auth'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json()
  const name: string = body?.name ?? ''
  const phone: string = body?.phone ?? ''

  const supabase = await createClient()

  const { error } = await supabase
    .from('users')
    .update({
      full_name: name,
      phone,
      onboarding_completed: true,
    })
    .eq('id', session.user.id)

  if (error) {
    console.error('complete-onboarding error:', error)
    return Response.json({ error: 'Falha ao guardar perfil' }, { status: 500 })
  }

  return Response.json({ success: true })
}
