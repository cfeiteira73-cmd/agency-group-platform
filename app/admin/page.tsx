// =============================================================================
// AGENCY GROUP — Admin Dashboard
// RSC — protected. Requires session.user.role === 'admin'
// =============================================================================

import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

// ─── Colour tokens ─────────────────────────────────────────────────────────
const C = {
  bg:        '#0c1f15',
  bgCard:    '#122a1c',
  bgCardHov: '#183825',
  border:    '#1e3d28',
  gold:      '#c9a96e',
  goldDim:   '#9e7d4e',
  cream:     '#f4f0e6',
  muted:     '#a0b09a',
  danger:    '#e05b5b',
  ok:        '#5bb870',
} as const

// ─── Supabase URL for the SQL editor deep-link ─────────────────────────────
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ORG   = SUPABASE_URL.match(/https:\/\/(\w+)\.supabase\.co/)?.[1] ?? ''
const SUPABASE_EDITOR = SUPABASE_ORG
  ? `https://supabase.com/dashboard/project/${SUPABASE_ORG}/editor`
  : 'https://supabase.com/dashboard'

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Mask an env-var value: show first 6 + *** + last 4, or "NOT SET" */
function maskEnv(value: string | undefined): { masked: string; ok: boolean } {
  if (!value || value === 'PREENCHER' || value.trim() === '') {
    return { masked: 'NOT SET', ok: false }
  }
  if (value.length <= 10) return { masked: '***', ok: true }
  return {
    masked: value.slice(0, 6) + '···' + value.slice(-4),
    ok: true,
  }
}

// ─── Stat cards data ────────────────────────────────────────────────────────

const STAT_CARDS: Array<{
  label: string
  api: string
  icon: string
  description: string
}> = [
  {
    label: 'Leads',
    api: '/api/contacts?limit=1&count=true',
    icon: '👥',
    description: 'Total CRM leads/contacts',
  },
  {
    label: 'Deals',
    api: '/api/deals?limit=1&count=true',
    icon: '🤝',
    description: 'Pipeline deals activos',
  },
  {
    label: 'Contacts',
    api: '/api/contacts?limit=1',
    icon: '📇',
    description: 'Contactos registados',
  },
  {
    label: 'Investidores',
    api: '/api/investidores',
    icon: '💼',
    description: 'Investidores qualificados',
  },
  {
    label: 'Properties',
    api: '/api/imoveis?limit=1&count=true',
    icon: '🏠',
    description: 'Imóveis no sistema',
  },
  {
    label: 'Off-Market Leads',
    api: '/api/offmarket?limit=1&count=true',
    icon: '🔑',
    description: 'Off-market lead pipeline',
  },
]

// ─── Env var display config ─────────────────────────────────────────────────

const ENV_CHECKS: Array<{ label: string; key: string }> = [
  { label: 'ANTHROPIC_API_KEY',          key: 'ANTHROPIC_API_KEY' },
  { label: 'NEXT_PUBLIC_SUPABASE_URL',   key: 'NEXT_PUBLIC_SUPABASE_URL' },
  { label: 'SUPABASE_SERVICE_ROLE_KEY',  key: 'SUPABASE_SERVICE_ROLE_KEY' },
  { label: 'GOOGLE_CLIENT_ID',           key: 'GOOGLE_CLIENT_ID' },
  { label: 'RESEND_API_KEY',             key: 'RESEND_API_KEY' },
  { label: 'NOTION_TOKEN',               key: 'NOTION_TOKEN' },
  { label: 'WHATSAPP_ACCESS_TOKEN',      key: 'WHATSAPP_ACCESS_TOKEN' },
  { label: 'WHATSAPP_ACTIVE',            key: 'WHATSAPP_ACTIVE' },
  { label: 'WHATSAPP_APP_SECRET',        key: 'WHATSAPP_APP_SECRET' },
  { label: 'APIFY_TOKEN',                key: 'APIFY_TOKEN' },
  { label: 'OPENAI_API_KEY',             key: 'OPENAI_API_KEY' },
  { label: 'HEYGEN_API_KEY',             key: 'HEYGEN_API_KEY' },
  { label: 'AUTH_SECRET',                key: 'AUTH_SECRET' },
  { label: 'CRON_SECRET',                key: 'CRON_SECRET' },
  { label: 'IDEALISTA_API_KEY',          key: 'IDEALISTA_API_KEY' },
  { label: 'IDEALISTA_API_SECRET',       key: 'IDEALISTA_API_SECRET' },
  { label: 'NEXT_PUBLIC_SENTRY_DSN',     key: 'NEXT_PUBLIC_SENTRY_DSN' },
  { label: 'N8N_WEBHOOK_URL',            key: 'N8N_WEBHOOK_URL' },
]

// ─── Quick action links ─────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Ver Portal →',  href: '/portal',         external: false },
  { label: 'SQL Editor →',  href: SUPABASE_EDITOR,   external: true  },
  { label: 'n8n →',         href: process.env.N8N_WEBHOOK_URL ?? 'https://agencygroup.app.n8n.cloud', external: true },
  { label: 'Sentry →',      href: 'https://sentry.io/organizations/agency-group-oc/issues/', external: true },
]

// =============================================================================
// Page component (RSC)
// =============================================================================

export default async function AdminPage() {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    redirect('/')
  }

  // ── Resolve env values on the server (never exposed to client) ──────────────
  const envRows = ENV_CHECKS.map(({ label, key }) => {
    const value = process.env[key]
    const { masked, ok } = maskEnv(value)
    return { label, masked, ok }
  })

  const configuredCount = envRows.filter(r => r.ok).length
  const totalCount      = envRows.length

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.cream,
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '0',
    }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: C.bgCard,
        borderBottom: `1px solid ${C.border}`,
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            background: C.gold,
            color: C.bg,
            fontWeight: 700,
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '4px',
            letterSpacing: '0.08em',
          }}>
            ADMIN
          </span>
          <span style={{ color: C.gold, fontWeight: 600, fontSize: '18px' }}>
            Agency Group
          </span>
          <span style={{ color: C.muted, fontSize: '13px' }}>
            AMI 22506
          </span>
        </div>
        <div style={{ color: C.muted, fontSize: '13px' }}>
          {session.user.email}
          <span style={{
            marginLeft: '10px',
            background: C.border,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            color: C.gold,
          }}>
            {session.user.role}
          </span>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Section: Quick Actions ─────────────────────────────────────────── */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{
            color: C.gold,
            fontSize: '12px',
            letterSpacing: '0.12em',
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}>
            Acesso Rápido
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {QUICK_ACTIONS.map(({ label, href, external }) => (
              <a
                key={label}
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  borderRadius: '8px',
                  color: C.cream,
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'border-color 0.15s',
                  cursor: 'pointer',
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.gold }}
                onMouseOut={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.border }}
              >
                {label}
              </a>
            ))}
          </div>
        </section>

        {/* ── Section: Stat Cards ────────────────────────────────────────────── */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{
            color: C.gold,
            fontSize: '12px',
            letterSpacing: '0.12em',
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}>
            Estatísticas do Sistema
          </h2>
          <p style={{ color: C.muted, fontSize: '12px', marginBottom: '16px', marginTop: '-8px' }}>
            Os valores são carregados via client fetch — os links abaixo apontam para as APIs reais.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
          }}>
            {STAT_CARDS.map(({ label, api, icon, description }) => (
              <a
                key={label}
                href={api}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  padding: '20px',
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  borderRadius: '10px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
                <div
                  data-admin-stat={label}
                  style={{
                    color: C.gold,
                    fontSize: '20px',
                    fontWeight: 700,
                    marginBottom: '4px',
                  }}
                >
                  —
                </div>
                <div style={{ color: C.cream, fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                  {label}
                </div>
                <div style={{ color: C.muted, fontSize: '11px' }}>
                  {description}
                </div>
                <div style={{
                  marginTop: '12px',
                  fontSize: '10px',
                  color: C.goldDim,
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                }}>
                  {api}
                </div>
              </a>
            ))}
          </div>
          <AdminStatLoader cards={STAT_CARDS} />
        </section>

        {/* ── Section: System Status ─────────────────────────────────────────── */}
        <section>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <h2 style={{
              color: C.gold,
              fontSize: '12px',
              letterSpacing: '0.12em',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              Environment / System Status
            </h2>
            <span style={{
              fontSize: '12px',
              color: configuredCount === totalCount ? C.ok : C.danger,
              fontWeight: 600,
            }}>
              {configuredCount}/{totalCount} configurados
            </span>
          </div>

          <div style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: '10px',
            overflow: 'hidden',
          }}>
            {envRows.map(({ label, masked, ok }, i) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 20px',
                  borderBottom: i < envRows.length - 1 ? `1px solid ${C.border}` : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                }}
              >
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: C.muted,
                  minWidth: '260px',
                }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: ok ? C.cream : C.danger,
                  flex: 1,
                  textAlign: 'right',
                  paddingLeft: '16px',
                }}>
                  {masked}
                </div>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: ok ? C.ok : C.danger,
                  marginLeft: '16px',
                  flexShrink: 0,
                }} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div style={{
          marginTop: '48px',
          paddingTop: '24px',
          borderTop: `1px solid ${C.border}`,
          textAlign: 'center',
          color: C.muted,
          fontSize: '12px',
        }}>
          Agency Group — Admin Panel · AMI 22506 · Acesso restrito
        </div>

      </div>
    </div>
  )
}

// =============================================================================
// Client island: loads real counts from APIs
// (Inline script — avoid a separate file for this minimal use-case)
// =============================================================================

function AdminStatLoader({ cards }: { cards: typeof STAT_CARDS }) {
  // This is a pure RSC — we embed a small <script> that fetches counts
  // and injects them into the DOM after hydration (no React state needed).
  const scriptSrc = `
(async function() {
  const cards = ${JSON.stringify(cards.map(c => ({ label: c.label, api: c.api })))};
  for (const card of cards) {
    try {
      const res = await fetch(card.api, { credentials: 'include' });
      if (!res.ok) { setCount(card.label, '—'); continue; }
      const json = await res.json();
      // Try common count patterns
      const count =
        json?.count ??
        json?.total ??
        (Array.isArray(json) ? json.length : null) ??
        (Array.isArray(json?.data) ? json.data.length : null) ??
        '—';
      setCount(card.label, count);
    } catch {
      setCount(card.label, '—');
    }
  }
  function setCount(label, val) {
    const els = document.querySelectorAll('[data-admin-stat]');
    for (const el of els) {
      if (el.dataset.adminStat === label) {
        el.textContent = typeof val === 'number' ? val.toLocaleString('pt-PT') : String(val);
      }
    }
  }
})();
`.trim()

  return (
    // eslint-disable-next-line @next/next/no-sync-scripts
    <script dangerouslySetInnerHTML={{ __html: scriptSrc }} />
  )
}
