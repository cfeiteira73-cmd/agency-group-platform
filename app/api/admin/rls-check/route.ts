import { createClient } from '@/lib/supabase/server'
import { auth } from '@/auth'

export async function GET() {
  // Admin only
  const session = await auth()
  if (!session || session.user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  // Try the RPC first; if it doesn't exist the error is surfaced in the response
  const { data: rpcData, error: rpcError } = await supabase.rpc('check_rls_status')

  // Fallback: query pg_tables directly via a raw query
  // Note: the Supabase JS client cannot query pg_tables via .from(); use rpc or service-role raw SQL.
  // We surface what we can and instruct the admin to apply the SQL migration.
  return Response.json({
    rpc_result: rpcData ?? null,
    rpc_error: rpcError?.message ?? null,
    recommendation:
      'Ensure all tables have RLS enabled with appropriate policies. Apply supabase/rls-policies.sql via the Supabase SQL editor or CLI.',
    tables_to_check: [
      'users',
      'properties',
      'deals',
      'contacts',
      'visitas',
      'activities',
    ],
    how_to_verify:
      'Run: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = \'public\'; in the Supabase SQL editor.',
  })
}
