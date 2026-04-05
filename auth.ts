import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { createClient } from '@/lib/supabase/server'
import * as OTPAuth from 'otpauth'

declare module 'next-auth' {
  interface User {
    role?: string
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      role: string
    }
  }
}


export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totp: { label: '2FA Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const supabase = await createClient()
          const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', credentials.email)
            .single()

          if (!user) return null

          // Verify password (bcrypt)
          const { compareSync } = await import('bcryptjs')
          const valid = compareSync(credentials.password as string, user.password_hash)
          if (!valid) return null

          // If user is not active, deny access
          if (user.is_active === false) return null

          // Verify TOTP if enabled
          if (user.totp_secret) {
            if (!credentials.totp) {
              // Signal to client that TOTP is required (return null to trigger error)
              return null
            }
            const totp = new OTPAuth.TOTP({
              secret: OTPAuth.Secret.fromBase32(user.totp_secret),
              digits: 6,
              period: 30,
            })
            const delta = totp.validate({ token: credentials.totp as string, window: 1 })
            if (delta === null) return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.avatar_url,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as Record<string, unknown>).role as string
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role as string
        session.user.id = token.id as string
      }
      return session
    },
    async signIn({ user, account }) {
      // For Google OAuth, auto-create/sync user in our DB
      if (account?.provider === 'google' && user.email) {
        try {
          const supabase = await createClient()
          const { data: existing } = await supabase
            .from('users')
            .select('id, is_active')
            .eq('email', user.email)
            .single()

          // Only allow users pre-approved in the DB (is_active = true)
          // No auto-provisioning — prevents any Google account from accessing the CRM
          if (!existing || existing.is_active === false) {
            console.warn('[auth] Google sign-in blocked for:', user.email)
            return false
          }

          // Sync avatar if it changed
          if (user.image) {
            await supabase.from('users').update({ avatar_url: user.image }).eq('email', user.email)
          }
        } catch (error) {
          console.error('[auth] signIn callback error:', error instanceof Error ? error.message : 'unknown')
          return false
        }
      }
      return true
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
})
