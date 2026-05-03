'use client'
// =============================================================================
// Agency Group — Portal Platform Config
// app/portal/components/PortalPlatformConfig.tsx
//
// Admin UI for editing DB-backed platform configuration thresholds.
// Replaces hardcoded magic numbers with tunable, audited values.
//
// ACCESS: ops_manager+ (enforced at API level)
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'

function getAuthHeaders(): HeadersInit {
  try {
    const stored = JSON.parse(localStorage.getItem('ag_auth') || '{}')
    if (stored.email) return { Authorization: `Bearer ${stored.email}` }
  } catch { /* ignore */ }
  return {}
}

function getAgentEmail(): string {
  try {
    const stored = JSON.parse(localStorage.getItem('ag_auth') || '{}')
    return stored.email ?? ''
  } catch { return '' }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConfigType = 'numeric' | 'text' | 'json' | 'boolean'

interface ConfigRow {
  config_key:    string
  value_numeric: number | null
  value_text:    string | null
  value_boolean: boolean | null
  value_json:    Record<string, unknown> | null
  config_type:   ConfigType
  description:   string | null
  category:      string
  updated_by:    string | null
  updated_at:    string
}

interface EditState {
  key:   string
  value: string  // always string in the input; cast on save
}

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  scoring:      { label: 'Scoring Thresholds',    icon: '🎯', color: '#c9a96e' },
  alerts:       { label: 'Alert Controls',         icon: '🔔', color: '#e74c3c' },
  distribution: { label: 'Distribution Settings',  icon: '🔀', color: '#3498db' },
  revenue:      { label: 'Revenue Parameters',     icon: '💰', color: '#2ecc71' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function displayValue(row: ConfigRow): string {
  if (row.config_type === 'numeric' && row.value_numeric !== null) return String(row.value_numeric)
  if (row.config_type === 'boolean' && row.value_boolean !== null) return String(row.value_boolean)
  if (row.config_type === 'text'    && row.value_text    !== null) return row.value_text
  return '—'
}

function shortKey(key: string): string {
  return key.split('.').pop()?.replace(/_/g, ' ') ?? key
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1)  return 'há menos de 1h'
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PortalPlatformConfig() {
  const darkMode = useUIStore(s => s.darkMode)

  const bg   = darkMode ? '#0d1f17' : '#f4f0e6'
  const card = darkMode ? '#14281e' : '#fff'
  const text = darkMode ? '#f4f0e6' : '#1c4a35'
  const muted = darkMode ? '#8fa89a' : '#6b7c74'
  const border = darkMode ? '#1e3d2b' : '#d4c5a9'

  const [rows,    setRows]    = useState<ConfigRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState<string | null>(null)
  const [filter,  setFilter]  = useState<string>('all')

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/config', {
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const { rows: data } = await res.json() as { rows: ConfigRow[] }
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const row = rows.find(r => r.config_key === editing.key)
      if (!row) throw new Error('Chave não encontrada')

      let parsedValue: number | string | boolean = editing.value
      if (row.config_type === 'numeric') {
        parsedValue = parseFloat(editing.value)
        if (isNaN(parsedValue)) throw new Error('Valor numérico inválido')
      } else if (row.config_type === 'boolean') {
        parsedValue = editing.value === 'true'
      }

      const res = await fetch('/api/platform/config', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: editing.key, value: parsedValue }),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      // Update local state optimistically
      setRows(prev => prev.map(r =>
        r.config_key === editing.key
          ? {
              ...r,
              value_numeric: row.config_type === 'numeric' ? (parsedValue as number) : r.value_numeric,
              value_boolean: row.config_type === 'boolean' ? (parsedValue as boolean) : r.value_boolean,
              value_text:    row.config_type === 'text'    ? (parsedValue as string)  : r.value_text,
              updated_by: getAgentEmail(),
              updated_at: new Date().toISOString(),
            }
          : r
      ))
      setEditing(null)
      showToast(`✅ ${shortKey(editing.key)} actualizado`)
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Erro ao guardar'}`)
    } finally {
      setSaving(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  // ── Grouped rows ─────────────────────────────────────────────────────────

  const categories = [...new Set(rows.map(r => r.category))].sort()
  const filtered   = filter === 'all' ? rows : rows.filter(r => r.category === filter)
  const grouped    = categories.reduce<Record<string, ConfigRow[]>>((acc, cat) => {
    acc[cat] = filtered.filter(r => r.category === cat)
    return acc
  }, {})

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', background: bg, minHeight: '100vh', fontFamily: 'Jost, sans-serif', color: text }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#c9a96e', marginBottom: 4, fontFamily: 'Cormorant, serif' }}>
            ⚙️ Platform Config
          </h1>
          <p style={{ fontSize: 13, color: muted }}>
            Thresholds de negócio configuráveis — alterações reflectem-se em tempo real em toda a plataforma
          </p>
        </div>
        <button
          onClick={fetchConfig}
          disabled={loading}
          style={{ padding: '8px 16px', background: '#1c4a35', color: '#c9a96e', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
        >
          {loading ? '↺ A carregar…' : '↺ Actualizar'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#3a1515', border: '1px solid #e74c3c', borderRadius: 8, color: '#e74c3c', marginBottom: 16, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Category filter */}
      {!loading && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['all', ...categories].map(cat => {
            const meta = CATEGORY_META[cat]
            const active = filter === cat
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  padding: '5px 12px',
                  background: active ? '#1c4a35' : card,
                  color: active ? '#c9a96e' : muted,
                  border: `1px solid ${active ? '#1c4a35' : border}`,
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {cat === 'all' ? '📋 Todos' : `${meta?.icon ?? '•'} ${meta?.label ?? cat}`}
              </button>
            )
          })}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'grid', gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 80, background: card, borderRadius: 8, opacity: 0.4, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      )}

      {/* Config groups */}
      {!loading && categories.map(cat => {
        const catRows = grouped[cat]
        if (!catRows?.length) return null
        const meta = CATEGORY_META[cat] ?? { label: cat, icon: '•', color: '#c9a96e' }

        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            {/* Category header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 10, paddingBottom: 8,
              borderBottom: `1px solid ${border}`,
            }}>
              <span style={{ fontSize: 18 }}>{meta.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>{meta.label}</span>
              <span style={{ fontSize: 12, color: muted, marginLeft: 4 }}>({catRows.length} parâmetros)</span>
            </div>

            {/* Config rows */}
            <div style={{ display: 'grid', gap: 8 }}>
              {catRows.map(row => {
                const isEditing = editing?.key === row.config_key
                const val = displayValue(row)

                return (
                  <div
                    key={row.config_key}
                    style={{
                      background: card,
                      border: `1px solid ${isEditing ? '#c9a96e' : border}`,
                      borderRadius: 8,
                      padding: '14px 16px',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      {/* Key info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: text }}>
                            {shortKey(row.config_key)}
                          </span>
                          <span style={{ fontSize: 10, color: muted, fontFamily: 'DM Mono, monospace', background: darkMode ? '#0d1f17' : '#f0ece0', padding: '1px 6px', borderRadius: 4 }}>
                            {row.config_key}
                          </span>
                          <span style={{ fontSize: 10, color: muted, textTransform: 'uppercase' }}>
                            {row.config_type}
                          </span>
                        </div>
                        {row.description && (
                          <p style={{ fontSize: 11, color: muted, margin: 0 }}>{row.description}</p>
                        )}
                        {row.updated_by && (
                          <p style={{ fontSize: 10, color: muted, margin: '2px 0 0', opacity: 0.7 }}>
                            Actualizado por {row.updated_by} · {relativeTime(row.updated_at)}
                          </p>
                        )}
                      </div>

                      {/* Value + edit */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {isEditing ? (
                          <>
                            {row.config_type === 'boolean' ? (
                              <select
                                value={editing.value}
                                onChange={e => setEditing({ key: row.config_key, value: e.target.value })}
                                style={{ padding: '6px 10px', background: darkMode ? '#0d1f17' : '#fff', color: text, border: `1px solid #c9a96e`, borderRadius: 6, fontSize: 13 }}
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : (
                              <input
                                type={row.config_type === 'numeric' ? 'number' : 'text'}
                                value={editing.value}
                                onChange={e => setEditing({ key: row.config_key, value: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(null) }}
                                step={row.config_type === 'numeric' ? 'any' : undefined}
                                style={{ width: 100, padding: '6px 10px', background: darkMode ? '#0d1f17' : '#fff', color: text, border: `1px solid #c9a96e`, borderRadius: 6, fontSize: 13 }}
                                autoFocus
                              />
                            )}
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              style={{ padding: '6px 12px', background: '#1c4a35', color: '#c9a96e', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                            >
                              {saving ? '…' : '✓'}
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              style={{ padding: '6px 10px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{
                              fontSize: 18, fontWeight: 700,
                              color: meta.color,
                              fontFamily: 'DM Mono, monospace',
                              minWidth: 60, textAlign: 'right',
                            }}>
                              {val}
                            </span>
                            <button
                              onClick={() => setEditing({ key: row.config_key, value: val === '—' ? '' : val })}
                              style={{ padding: '5px 10px', background: 'transparent', color: '#c9a96e', border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                            >
                              ✎ Editar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Empty */}
      {!loading && rows.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
          <p style={{ fontSize: 14 }}>Nenhuma configuração encontrada.</p>
          <p style={{ fontSize: 12 }}>Execute a migração SQL para criar a tabela platform_config.</p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: darkMode ? '#14281e' : '#1c4a35',
          color: '#c9a96e',
          padding: '12px 20px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 9999,
          border: '1px solid #c9a96e33',
        }}>
          {toast}
        </div>
      )}

      {/* Info footer */}
      <div style={{ marginTop: 32, padding: '16px', background: darkMode ? '#0d1f17' : '#f0ece0', borderRadius: 8, border: `1px solid ${border}` }}>
        <p style={{ fontSize: 11, color: muted, margin: 0 }}>
          <strong style={{ color: text }}>ℹ️ Como funciona:</strong> Alterações são persistidas na base de dados e reflectem-se em toda a plataforma em ≤5 minutos (TTL da cache).
          As alterações são auditadas — o teu email é registado em cada mudança.
          Os valores padrão são usados automaticamente se a DB estiver indisponível.
        </p>
      </div>
    </div>
  )
}
