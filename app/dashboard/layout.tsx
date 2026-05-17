// AGENCY GROUP — SH-ROS | Dashboard Layout with Sidebar
// Server-side auth guard for all /dashboard/* routes.
// Uses the same ag-auth-token cookie + identical verify logic as lib/portalAuth.ts.
// NO changes to middleware.ts required.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHmac, timingSafeEqual } from 'crypto'
import type { ReactNode } from 'react'
import SidebarNav from './SidebarNav'

async function verifyPortalCookie(token: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return false
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return false
    const payload = token.slice(0, dotIdx)
    const sig     = token.slice(dotIdx + 1)
    // Must match lib/portalAuth.ts exactly — Node.js HMAC, base64url decode
    const expected    = createHmac('sha256', secret).update(payload).digest('hex')
    // Constant-time comparison to prevent timing oracle attacks
    const expectedBuf = Buffer.from(expected, 'hex')
    const sigBuf      = Buffer.from(sig, 'hex')
    if (sigBuf.length !== expectedBuf.length) return false
    if (!timingSafeEqual(expectedBuf, sigBuf)) return false
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return !!data.email && Date.now() < data.exp
  } catch {
    return false
  }
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: '☀️', label: 'Brief Diário',            href: '/dashboard/daily-brief' },
  { icon: '⚡', label: 'Acções Prioritárias',     href: '/dashboard/actions' },
  { icon: '🏠', label: 'Property AI Engine',     href: '/dashboard/properties' },
  { icon: '🎯', label: 'Centro de Conversão',    href: '/dashboard/conversion-command' },
  { icon: '📊', label: 'Executive Revenue',       href: '/dashboard/executive' },
  { icon: '⚙️', label: 'Simulações',              href: '/dashboard/simulations' },
  { icon: '🚀', label: 'Activar Agente',          href: '/dashboard/onboarding' },
] as const

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  // Accept both production (__Secure-) and development cookie names (same as /api/auth/me)
  const token =
    cookieStore.get('__Secure-ag-auth-token')?.value ??
    cookieStore.get('ag-auth-token')?.value

  if (!token || !(await verifyPortalCookie(token))) {
    redirect('/portal/login')
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: '#0c1f15',
      overflowY: 'auto',
      overflowX: 'hidden',
      display: 'flex',
    }}>
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 220,
        background: '#0a180f',
        borderRight: '1px solid rgba(201,169,110,0.15)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {/* Logo / Brand */}
        <div style={{
          padding: '28px 20px 22px',
          borderBottom: '1px solid rgba(201,169,110,0.08)',
        }}>
          <a href="/dashboard" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'rgba(201,169,110,0.12)',
                border: '1px solid rgba(201,169,110,0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                flexShrink: 0,
              }}>
                ✦
              </div>
              <div>
                <p style={{
                  color: '#c9a96e',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  margin: 0,
                  fontFamily: 'var(--font-jost, system-ui)',
                  textTransform: 'uppercase',
                }}>
                  Agency Group
                </p>
                <p style={{
                  color: 'rgba(244,240,230,0.28)',
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  margin: '2px 0 0',
                  fontFamily: 'var(--font-jost, system-ui)',
                }}>
                  Dashboard · AMI 22506
                </p>
              </div>
            </div>
          </a>
        </div>

        {/* Navigation items — client component for active state via usePathname */}
        <nav style={{ flex: 1, padding: '16px 10px' }}>
          <SidebarNav items={NAV_ITEMS} />
        </nav>

        {/* Bottom: back to main site */}
        <div style={{
          padding: '12px 10px 20px',
          borderTop: '1px solid rgba(201,169,110,0.08)',
        }}>
          <a href="/" className="ag-back-link">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Site Principal
          </a>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main style={{
        marginLeft: 220,
        flex: 1,
        minWidth: 0,
        minHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  )
}
