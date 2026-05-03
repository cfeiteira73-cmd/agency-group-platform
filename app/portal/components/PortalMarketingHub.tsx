'use client'
// =============================================================================
// PortalMarketingHub — Phase 4: Marketing Automation & Lead Flow
// =============================================================================
// Tabs: nurture | campaigns | drip | webhooks
// API calls: /api/automation/nurture-candidates, /api/campanhas, /api/contacts
// Auth: Bearer email (portal magic-link pattern)
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'

// ── Auth helper ───────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  try {
    const stored = JSON.parse(localStorage.getItem('ag_auth') || '{}')
    if (stored.email) return { Authorization: `Bearer ${stored.email}` }
  } catch { /* ignore */ }
  return {}
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface NurtureCandidate {
  contact_id:   string
  full_name:    string
  email:        string
  trigger_day:  number
  sequence:     string
  last_contact: string | null
  lead_score:   number | null
  source:       string | null
}

interface NurtureResponse {
  candidates: NurtureCandidate[]
  total:      number
  dry_run:    boolean
}

interface Campaign {
  id:           string
  name:         string
  status:       string
  type:         string
  subject:      string | null
  metrics:      Record<string, number> | null
  sent_at:      string | null
  created_at:   string
}

interface LeadStats {
  total:    number
  by_status: Record<string, number>
  by_source: Record<string, number>
}

interface DripSequence {
  id:          string
  name:        string
  trigger:     string
  steps:       DripStep[]
  active:      boolean
  created_at:  string
}

interface DripStep {
  day:      number
  channel:  'email' | 'whatsapp' | 'sms' | 'task'
  subject:  string
  template: string
}

// Predefined drip sequence templates
const DRIP_TEMPLATES: DripSequence[] = [
  {
    id: 'buyer-welcome',
    name: 'Buyer Welcome Sequence',
    trigger: 'new_lead_buyer',
    active: true,
    created_at: '2026-01-01',
    steps: [
      { day: 0,  channel: 'email',    subject: 'Welcome to Agency Group — Your Portuguese Property Journey Begins', template: 'welcome_buyer_pt' },
      { day: 1,  channel: 'email',    subject: 'Properties matching your search — curated for you',                 template: 'matches_day1'    },
      { day: 3,  channel: 'whatsapp', subject: 'Check in on search preferences',                                    template: 'whatsapp_d3'     },
      { day: 7,  channel: 'email',    subject: 'Market insight: Why buyers choose Portugal in 2026',               template: 'market_insight'  },
      { day: 14, channel: 'email',    subject: 'Have you seen these off-market listings?',                          template: 'offmarket_d14'   },
      { day: 30, channel: 'email',    subject: 'One month update — where are you in your journey?',                 template: 'checkin_d30'     },
    ],
  },
  {
    id: 'investor-nurture',
    name: 'Investor Intelligence Sequence',
    trigger: 'investor_signup',
    active: true,
    created_at: '2026-01-01',
    steps: [
      { day: 0,  channel: 'email', subject: 'Portugal Real Estate Investment Report 2026',  template: 'investor_report'  },
      { day: 3,  channel: 'email', subject: 'Off-market deal alert — Grade A properties',  template: 'deal_alert_gradeA'},
      { day: 7,  channel: 'email', subject: 'Yield comparison: Lisbon vs Algarve vs Porto', template: 'yield_comparison' },
      { day: 14, channel: 'email', subject: 'Exclusive: Pre-market listings this week',     template: 'pre_market_d14'  },
      { day: 21, channel: 'task',  subject: 'Personal call — investment strategy review',  template: 'call_d21'        },
      { day: 30, channel: 'email', subject: 'Q2 portfolio update for your watchlist',       template: 'portfolio_update' },
    ],
  },
  {
    id: 'seller-nurture',
    name: 'Seller Engagement Sequence',
    trigger: 'seller_inquiry',
    active: true,
    created_at: '2026-01-01',
    steps: [
      { day: 0, channel: 'email', subject: 'Free valuation report for your property',        template: 'free_avm'         },
      { day: 1, channel: 'email', subject: 'How we sold 47 properties above asking in 2025', template: 'case_studies'     },
      { day: 3, channel: 'email', subject: 'Your neighbourhood market report — Q1 2026',    template: 'zona_report'      },
      { day: 7, channel: 'email', subject: 'Ready to take the next step?',                  template: 'seller_cta_d7'   },
      { day: 14, channel: 'task', subject: 'Follow-up call — ready to list?',               template: 'call_d14'        },
    ],
  },
  {
    id: 'dormant-reengagement',
    name: 'Dormant Lead Re-engagement',
    trigger: 'dormant_30d',
    active: true,
    created_at: '2026-01-01',
    steps: [
      { day: 0,  channel: 'email', subject: 'We miss you — here is what has changed',           template: 'reactivate_intro' },
      { day: 7,  channel: 'email', subject: 'New listings in your budget & location preference', template: 'fresh_matches'    },
      { day: 14, channel: 'email', subject: 'Last chance: 3 properties from your saved search', template: 'final_nudge'      },
    ],
  },
]

type TabKey = 'nurture' | 'sequences' | 'campaigns' | 'webhooks'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

function channelIcon(ch: string): string {
  const icons: Record<string, string> = { email: '📧', whatsapp: '💬', sms: '📱', task: '✅' }
  return icons[ch] ?? '•'
}

function triggerLabel(t: string): string {
  const labels: Record<string, string> = {
    new_lead_buyer:  'New Buyer Lead',
    investor_signup: 'Investor Signup',
    seller_inquiry:  'Seller Inquiry',
    dormant_30d:     'Dormant 30+ days',
  }
  return labels[t] ?? t
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatChip({ label, value, color, dark }: { label: string; value: string | number; color?: string; dark: boolean }) {
  return (
    <div style={{
      background: dark ? '#0c1f15' : '#fff',
      border: `1px solid ${color ? `${color}40` : dark ? '#1c4a35' : '#e5e5e3'}`,
      borderRadius: 8, padding: '10px 14px', minWidth: 100,
    }}>
      <div style={{ fontSize: 10, color: color ?? '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? (dark ? '#f4f0e6' : '#1c4a35'), fontFamily: 'var(--font-cormorant), serif' }}>
        {value}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PortalMarketingHub() {
  const dark = useUIStore(s => s.darkMode)

  const [tab,        setTab]        = useState<TabKey>('nurture')
  const [nurture,    setNurture]    = useState<NurtureResponse | null>(null)
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([])
  const [leadStats,  setLeadStats]  = useState<LeadStats | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)
  const [expandedSeq, setExpandedSeq] = useState<string | null>(null)

  const headers = getAuthHeaders()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nurtureRes, campRes, leadsRes] = await Promise.allSettled([
        fetch('/api/automation/nurture-candidates?dry_run=true', { headers }),
        fetch('/api/campanhas?limit=20&offset=0', { headers }),
        fetch('/api/contacts?limit=200', { headers }),
      ])

      if (nurtureRes.status === 'fulfilled' && nurtureRes.value.ok) {
        setNurture(await nurtureRes.value.json())
      }

      if (campRes.status === 'fulfilled' && campRes.value.ok) {
        const d = await campRes.value.json()
        setCampaigns(Array.isArray(d) ? d : (d.campaigns ?? d.data ?? []))
      }

      if (leadsRes.status === 'fulfilled' && leadsRes.value.ok) {
        const d = await leadsRes.value.json()
        const contacts: Array<{ status?: string; source?: string }> =
          Array.isArray(d) ? d : (d.contacts ?? d.data ?? [])

        const byStatus: Record<string, number> = {}
        const bySource: Record<string, number> = {}
        for (const c of contacts) {
          const s = c.status ?? 'unknown'
          const src = c.source ?? 'direct'
          byStatus[s] = (byStatus[s] ?? 0) + 1
          bySource[src] = (bySource[src] ?? 0) + 1
        }
        setLeadStats({ total: contacts.length, by_status: byStatus, by_source: bySource })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // Trigger nurture run
  const triggerNurture = useCallback(async () => {
    setTriggerMsg('Triggering nurture candidates…')
    try {
      const res = await fetch('/api/automation/nurture-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ dry_run: false }),
      })
      const d = await res.json()
      setTriggerMsg(res.ok
        ? `✅ Nurture triggered — ${d.triggered ?? 0} sequences queued`
        : `❌ Error: ${d.error ?? 'Unknown'}`)
    } catch (e) {
      setTriggerMsg(`❌ ${e instanceof Error ? e.message : 'Error'}`)
    }
    setTimeout(() => setTriggerMsg(null), 6000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = {
    background:   dark ? '#0c1f15' : '#fff',
    border:       `1px solid ${dark ? '#1c4a35' : '#e5e5e3'}`,
    borderRadius: 12,
    padding:      24,
  }

  const tabBtn = (t: TabKey) => ({
    padding:      '7px 14px',
    fontSize:     12,
    fontWeight:   600,
    border:       'none',
    cursor:       'pointer',
    borderRadius: 6,
    background:   tab === t ? '#c9a96e' : 'transparent',
    color:        tab === t ? '#0e0e0d' : dark ? '#888' : '#666',
  })

  const totalCampaigns  = campaigns.length
  const sentCampaigns   = campaigns.filter(c => c.status === 'sent').length
  const nurtureCount    = nurture?.total ?? 0
  const topSource       = leadStats
    ? Object.entries(leadStats.by_source).sort((a, b) => b[1] - a[1])[0]
    : null

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'var(--font-jost), sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: dark ? '#f4f0e6' : '#1c4a35', fontFamily: 'var(--font-cormorant), serif' }}>
            🚀 Marketing Hub
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: dark ? '#888' : '#666' }}>
            Nurture automation · Drip sequences · Campaign management
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none',
            borderRadius: 6, cursor: 'pointer',
            background: '#1c4a35', color: '#c9a96e', opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '⟳' : '↺ Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: 12, color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
          ⚠ {error}
        </div>
      )}

      {/* Trigger message */}
      {triggerMsg && (
        <div style={{ background: triggerMsg.startsWith('✅') ? '#22c55e20' : '#ef444420', border: `1px solid ${triggerMsg.startsWith('✅') ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 20, color: triggerMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
          {triggerMsg}
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatChip label="Leads (loaded)" value={loading ? '…' : (leadStats?.total ?? 0)} dark={dark} />
        <StatChip label="Nurture Queue" value={loading ? '…' : nurtureCount} color="#c9a96e" dark={dark} />
        <StatChip label="Campaigns" value={loading ? '…' : totalCampaigns} dark={dark} />
        <StatChip label="Sent" value={loading ? '…' : sentCampaigns} color="#22c55e" dark={dark} />
        <StatChip label="Top Source" value={loading ? '…' : topSource?.[0] ?? '—'} dark={dark} />
        <StatChip label="Active Sequences" value={DRIP_TEMPLATES.filter(s => s.active).length} color="#3b82f6" dark={dark} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: dark ? '#0c1f1580' : '#f4f0e680', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {(['nurture', 'sequences', 'campaigns', 'webhooks'] as TabKey[]).map(t => (
          <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>
            {t === 'nurture' ? '🌱 Nurture' : t === 'sequences' ? '📬 Sequences' : t === 'campaigns' ? '📧 Campaigns' : '🔗 Webhooks'}
          </button>
        ))}
      </div>

      {/* ── TAB: Nurture ── */}
      {tab === 'nurture' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: dark ? '#c9a96e' : '#1c4a35' }}>
              Nurture Candidates (dry run preview)
            </div>
            <button
              onClick={triggerNurture}
              style={{
                padding: '7px 16px', fontSize: 12, fontWeight: 600,
                background: '#c9a96e', color: '#0e0e0d',
                border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >
              ▶ Trigger Nurture Run
            </button>
          </div>

          {loading ? (
            <div style={{ color: dark ? '#888' : '#aaa', fontSize: 13 }}>Loading nurture candidates…</div>
          ) : !nurture || nurture.candidates.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: dark ? '#888' : '#aaa', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
              No nurture candidates right now. Contacts will appear here when they reach D+1, D+7, or D+30 touchpoints.
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: dark ? '#888' : '#666', marginBottom: 12 }}>
                {nurture.total} contacts ready for nurture · Preview only — click &ldquo;Trigger&rdquo; to send
              </div>

              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px',
                gap: 8, padding: '8px 12px',
                background: dark ? '#0e0e0d40' : '#f9f8f6',
                borderRadius: '6px 6px 0 0',
                fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <div>Contact</div>
                <div>Sequence</div>
                <div style={{ textAlign: 'right' }}>Day</div>
                <div style={{ textAlign: 'right' }}>Score</div>
                <div style={{ textAlign: 'right' }}>Last Contact</div>
              </div>

              {nurture.candidates.slice(0, 50).map(c => (
                <div key={c.contact_id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px',
                  gap: 8, padding: '10px 12px',
                  borderBottom: `1px solid ${dark ? '#1c4a3520' : '#f0f0ee'}`,
                  alignItems: 'center', fontSize: 13,
                }}>
                  <div>
                    <div style={{ fontWeight: 500, color: dark ? '#f4f0e6' : '#1c4a35' }}>{c.full_name || 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: dark ? '#888' : '#aaa' }}>{c.email}</div>
                  </div>
                  <div style={{ fontSize: 11, color: dark ? '#c9a96e' : '#1c4a35', fontWeight: 500 }}>
                    {c.sequence || '—'}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      background: c.trigger_day <= 1 ? '#22c55e20' : c.trigger_day <= 7 ? '#f59e0b20' : '#ef444420',
                      color:      c.trigger_day <= 1 ? '#22c55e'   : c.trigger_day <= 7 ? '#f59e0b'   : '#ef4444',
                      borderRadius: 3, padding: '2px 6px', fontSize: 11, fontWeight: 600,
                    }}>
                      D+{c.trigger_day}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: dark ? '#ccc' : '#555' }}>
                    {c.lead_score ?? '—'}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: dark ? '#888' : '#aaa' }}>
                    {fmtDate(c.last_contact)}
                  </div>
                </div>
              ))}

              {nurture.candidates.length > 50 && (
                <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: dark ? '#888' : '#aaa' }}>
                  + {nurture.candidates.length - 50} more candidates not shown
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Sequences ── */}
      {tab === 'sequences' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: dark ? '#888' : '#666', marginBottom: 4 }}>
            {DRIP_TEMPLATES.length} drip sequences configured · Triggered via n8n automation
          </div>

          {DRIP_TEMPLATES.map(seq => {
            const isOpen = expandedSeq === seq.id
            return (
              <div key={seq.id} style={{
                background: dark ? '#0c1f15' : '#fff',
                border: `1px solid ${isOpen ? '#c9a96e60' : dark ? '#1c4a35' : '#e5e5e3'}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                {/* Header */}
                <button
                  onClick={() => setExpandedSeq(isOpen ? null : seq.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      background: seq.active ? '#22c55e20' : '#88888820',
                      color: seq.active ? '#22c55e' : '#888',
                      borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700,
                    }}>
                      {seq.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: dark ? '#f4f0e6' : '#1c4a35' }}>{seq.name}</div>
                      <div style={{ fontSize: 11, color: dark ? '#888' : '#888', marginTop: 1 }}>
                        Trigger: {triggerLabel(seq.trigger)} · {seq.steps.length} steps
                      </div>
                    </div>
                  </div>
                  <span style={{ color: dark ? '#888' : '#aaa', fontSize: 16 }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* Steps */}
                {isOpen && (
                  <div style={{ padding: '0 18px 18px' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '60px 100px 1fr 120px',
                      gap: 8, padding: '8px 0',
                      borderTop: `1px solid ${dark ? '#1c4a35' : '#f0f0ee'}`,
                      fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      <div>Day</div>
                      <div>Channel</div>
                      <div>Subject</div>
                      <div>Template</div>
                    </div>
                    {seq.steps.map((step, idx) => (
                      <div key={idx} style={{
                        display: 'grid', gridTemplateColumns: '60px 100px 1fr 120px',
                        gap: 8, padding: '10px 0',
                        borderTop: `1px solid ${dark ? '#1c4a3520' : '#f8f8f7'}`,
                        alignItems: 'center', fontSize: 13,
                      }}>
                        <div>
                          <span style={{
                            background: step.day === 0 ? '#22c55e20' : dark ? '#1c4a3530' : '#f0f0ee',
                            color: step.day === 0 ? '#22c55e' : dark ? '#c9a96e' : '#1c4a35',
                            borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700,
                          }}>
                            D+{step.day}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          <span>{channelIcon(step.channel)}</span>
                          <span style={{ color: dark ? '#ccc' : '#555', textTransform: 'capitalize' }}>{step.channel}</span>
                        </div>
                        <div style={{ fontSize: 12, color: dark ? '#f4f0e6' : '#1c4a35', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {step.subject}
                        </div>
                        <div style={{ fontSize: 11, color: dark ? '#888' : '#aaa', fontFamily: 'var(--font-dm-mono), monospace' }}>
                          {step.template}
                        </div>
                      </div>
                    ))}

                    <div style={{
                      marginTop: 12, padding: '10px 12px',
                      background: dark ? '#0e0e0d40' : '#f9f8f6',
                      borderRadius: 6, fontSize: 11, color: dark ? '#888' : '#666',
                    }}>
                      💡 This sequence is managed via n8n workflow <strong>wf-R</strong>. To modify, update the n8n sequence configuration and restart the workflow.
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: Campaigns ── */}
      {tab === 'campaigns' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: dark ? '#c9a96e' : '#1c4a35' }}>
              Recent Campaigns
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: dark ? '#f4f0e6' : '#1c4a35', fontFamily: 'var(--font-cormorant), serif' }}>
                  {loading ? '…' : totalCampaigns}
                </div>
                <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Total</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--font-cormorant), serif' }}>
                  {loading ? '…' : sentCampaigns}
                </div>
                <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Sent</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: dark ? '#888' : '#aaa', fontSize: 13 }}>Loading campaigns…</div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: dark ? '#888' : '#aaa', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📧</div>
              No campaigns yet. Use the <strong>Campanhas</strong> section to create and send campaigns.
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 90px 100px',
                gap: 8, padding: '8px 12px',
                background: dark ? '#0e0e0d40' : '#f9f8f6',
                borderRadius: '6px 6px 0 0',
                fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <div>Name</div>
                <div>Status</div>
                <div>Type</div>
                <div style={{ textAlign: 'right' }}>Opens</div>
                <div style={{ textAlign: 'right' }}>Clicks</div>
                <div style={{ textAlign: 'right' }}>Date</div>
              </div>

              {campaigns.map((c, i) => {
                const statusColor: Record<string, string> = {
                  sent: '#22c55e', draft: '#f59e0b', scheduled: '#3b82f6', cancelled: '#ef4444',
                }
                const sc = statusColor[c.status] ?? '#888'
                const metrics = c.metrics ?? {}
                return (
                  <div key={c.id ?? i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 90px 100px',
                    gap: 8, padding: '10px 12px',
                    borderBottom: `1px solid ${dark ? '#1c4a3520' : '#f0f0ee'}`,
                    alignItems: 'center', fontSize: 13,
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, color: dark ? '#f4f0e6' : '#1c4a35', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </div>
                      {c.subject && (
                        <div style={{ fontSize: 11, color: dark ? '#888' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.subject}
                        </div>
                      )}
                    </div>
                    <div>
                      <span style={{ background: `${sc}20`, color: sc, borderRadius: 3, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>
                        {c.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: dark ? '#888' : '#aaa', textTransform: 'capitalize' }}>{c.type}</div>
                    <div style={{ textAlign: 'right', color: dark ? '#ccc' : '#555' }}>{(metrics as Record<string, number>).opens ?? '—'}</div>
                    <div style={{ textAlign: 'right', color: dark ? '#ccc' : '#555' }}>{(metrics as Record<string, number>).clicks ?? '—'}</div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: dark ? '#888' : '#aaa' }}>{fmtDate(c.sent_at ?? c.created_at)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Webhooks ── */}
      {tab === 'webhooks' && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: dark ? '#c9a96e' : '#1c4a35', marginBottom: 16 }}>
            n8n Automation Webhooks
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { id: 'wf-Q', name: 'Property Alert Pre-Send Validation',  endpoint: '/api/automation/alert-check-sent',  type: 'CORE',   trigger: 'n8n wf-Q before send' },
              { id: 'wf-R', name: 'Nurture Candidates (D+1/D+7/D+30)',   endpoint: '/api/automation/nurture-candidates', type: 'CORE',   trigger: 'n8n wf-R hourly cron' },
              { id: 'wf-R', name: 'Nurture Mark Sent',                   endpoint: '/api/automation/nurture-mark-sent',  type: 'CORE',   trigger: 'n8n wf-R post-send'   },
              { id: 'wf-M', name: 'Revenue Loop Orchestration',          endpoint: '/api/automation/revenue-loop',       type: 'CORE',   trigger: 'n8n wf-M main loop'   },
              { id: 'wf-A', name: 'Lead Inbound Router',                 endpoint: '/api/leads',                         type: 'HIGH',   trigger: 'webhooks, forms'      },
              { id: 'wf-B', name: 'Property DB Trigger',                 endpoint: '/api/properties/db',                 type: 'HIGH',   trigger: 'property changes'     },
              { id: 'wf-C', name: 'Investor Alert Cron',                 endpoint: '/api/cron/investor-alerts',          type: 'HIGH',   trigger: 'daily 09:00 UTC'      },
              { id: 'wf-D', name: 'Saved-Search Alert Hook',             endpoint: '/api/alerts',                        type: 'MEDIUM', trigger: 'alert creation'       },
            ].map(wh => {
              const typeColor: Record<string, string> = {
                CORE: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#888',
              }
              const tc = typeColor[wh.type] ?? '#888'
              return (
                <div key={`${wh.id}-${wh.endpoint}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  background: dark ? '#0e0e0d40' : '#f9f8f6',
                  borderRadius: 8, border: `1px solid ${dark ? '#1c4a3530' : '#eee'}`,
                }}>
                  <span style={{
                    background: `${tc}20`, color: tc, borderRadius: 4,
                    padding: '2px 7px', fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>
                    {wh.type}
                  </span>
                  <span style={{
                    background: dark ? '#1c4a3530' : '#e8f0ec', color: dark ? '#c9a96e' : '#1c4a35',
                    borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, flexShrink: 0,
                    fontFamily: 'var(--font-dm-mono), monospace',
                  }}>
                    {wh.id}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: dark ? '#f4f0e6' : '#1c4a35' }}>{wh.name}</div>
                    <div style={{ fontSize: 11, color: dark ? '#888' : '#aaa', fontFamily: 'var(--font-dm-mono), monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {wh.endpoint}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: dark ? '#888' : '#aaa', textAlign: 'right', flexShrink: 0 }}>
                    {wh.trigger}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 16, padding: '12px 14px', background: dark ? '#1c4a3520' : '#f0f6f3', borderRadius: 8, fontSize: 12, color: dark ? '#888' : '#555' }}>
            🔗 n8n instance: <code style={{ fontFamily: 'var(--font-dm-mono), monospace', color: dark ? '#c9a96e' : '#1c4a35' }}>agencygroup.app.n8n.cloud</code>
            &nbsp;· All webhooks are non-blocking and include retry logic via n8n built-in error handling.
          </div>
        </div>
      )}
    </div>
  )
}
