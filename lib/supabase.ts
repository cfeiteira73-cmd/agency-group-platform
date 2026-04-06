// =============================================================================
// AGENCY GROUP — Production Supabase Client v2.0
// AMI: 22506 | Portugal + Espanha + Madeira + Açores
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
}
if (!supabaseAnonKey) {
  throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// ---------------------------------------------------------------------------
// Browser client — anon key, safe for client components
// Uses RLS policies to restrict data access per authenticated user
// ---------------------------------------------------------------------------
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// ---------------------------------------------------------------------------
// Admin client — service role key, bypasses RLS
// SERVER ONLY — import only in API routes or server actions
// Never expose to the browser
// ---------------------------------------------------------------------------
if (!supabaseServiceRoleKey && process.env.NODE_ENV === 'production') {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production. Set it in environment variables.')
}

export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey ?? supabaseAnonKey, // fallback only in development
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
