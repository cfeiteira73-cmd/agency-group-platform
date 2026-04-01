// SETUP REQUIRED: Run `npm install @supabase/supabase-js` and add to .env.local:
// NEXT_PUBLIC_SUPABASE_URL=your_project_url
// NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

let supabaseClient: SupabaseClient = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && key) {
    supabaseClient = createClient(url, key)
  }
} catch {
  // @supabase/supabase-js not installed yet — run `npm install @supabase/supabase-js`
}

export const supabase: SupabaseClient = supabaseClient

export type Database = {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string
          agent_email: string
          name: string
          email: string
          phone: string
          nationality: string
          budget_min: number
          budget_max: number
          tipos: string[]
          zonas: string[]
          status: 'vip' | 'cliente' | 'prospect' | 'lead'
          notes: string
          last_contact: string
          next_follow_up: string
          deal_ref: string
          origin: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['contacts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }
      deals: {
        Row: {
          id: string
          agent_email: string
          ref: string
          imovel: string
          valor: number
          fase: string
          checklist: Record<string, boolean[]>
          notes: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['deals']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['deals']['Insert']>
      }
      properties: {
        Row: {
          id: string
          ref: string
          nome: string
          zona: string
          bairro: string
          tipo: string
          preco: number
          area: number
          quartos: number
          casas_banho: number
          andar: string
          energia: string
          vista: string
          piscina: boolean
          garagem: boolean
          jardim: boolean
          terraco: boolean
          condominio: boolean
          badge: string | null
          status: string
          desc: string
          features: string[]
          tour_url: string | null
          agent_email: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['properties']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['properties']['Insert']>
      }
    }
  }
}
