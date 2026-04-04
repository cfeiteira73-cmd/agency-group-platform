'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CurrencyCode = 'EUR' | 'GBP' | 'USD' | 'CHF' | 'AED' | 'BRL' | 'CNY'

interface CurrencyInfo {
  code: CurrencyCode
  name: string
  flag: string
  symbol: string
}

interface CurrencyContextValue {
  currency: CurrencyCode
  setCurrency: (c: CurrencyCode) => void
  rates: Record<CurrencyCode, number>
  convert: (eurAmount: number) => number
  formatConverted: (eurAmount: number) => string
  loading: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', name: 'Euro',          flag: '🇪🇺', symbol: '€'  },
  { code: 'GBP', name: 'Pound',         flag: '🇬🇧', symbol: '£'  },
  { code: 'USD', name: 'Dollar',        flag: '🇺🇸', symbol: '$'  },
  { code: 'CHF', name: 'Franc',         flag: '🇨🇭', symbol: 'Fr' },
  { code: 'AED', name: 'Dirham',        flag: '🇦🇪', symbol: 'د.إ' },
  { code: 'BRL', name: 'Real',          flag: '🇧🇷', symbol: 'R$' },
  { code: 'CNY', name: '人民币',         flag: '🇨🇳', symbol: '¥'  },
]

const DEFAULT_RATES: Record<CurrencyCode, number> = {
  EUR: 1,
  GBP: 0.86,
  USD: 1.09,
  CHF: 0.97,
  AED: 4.00,
  BRL: 5.60,
  CNY: 7.85,
}

function inferCurrencyFromPath(): CurrencyCode | null {
  if (typeof window === 'undefined') return null
  const path = window.location.pathname
  if (path.startsWith('/ar')) return 'AED'
  if (path.startsWith('/zh')) return 'CNY'
  if (path.startsWith('/en')) return 'USD'
  if (path.startsWith('/de') || path.startsWith('/fr')) return 'EUR'
  if (path.startsWith('/br')) return 'BRL'
  return null
}

const CACHE_KEY = 'ag_fx_rates'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// ─── Context ──────────────────────────────────────────────────────────────────

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'EUR',
  setCurrency: () => {},
  rates: DEFAULT_RATES,
  convert: (n) => n,
  formatConverted: (n) => `€ ${n.toLocaleString('pt-PT')}`,
  loading: false,
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('EUR')
  const [rates, setRates] = useState<Record<CurrencyCode, number>>(DEFAULT_RATES)
  const [loading, setLoading] = useState(false)

  // Load persisted currency preference, fall back to path-inferred
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ag_currency') as CurrencyCode | null
      if (saved && CURRENCIES.find(c => c.code === saved)) {
        setCurrencyState(saved)
      } else {
        const inferred = inferCurrencyFromPath()
        if (inferred) setCurrencyState(inferred)
      }
    } catch {}
  }, [])

  // Fetch rates with localStorage cache
  useEffect(() => {
    async function fetchRates() {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { ts, data } = JSON.parse(cached)
          if (Date.now() - ts < CACHE_TTL) {
            setRates(data)
            return
          }
        }
      } catch {}

      setLoading(true)
      try {
        // Use our own /api/rates — sources: Frankfurter (ECB) + fallback ExchangeRate-API
        const res = await fetch('/api/rates')
        if (!res.ok) throw new Error('fetch failed')
        const json = await res.json()
        const r = json.fx ?? {}
        const fetched: Record<CurrencyCode, number> = {
          EUR: 1,
          GBP: r.GBP ?? DEFAULT_RATES.GBP,
          USD: r.USD ?? DEFAULT_RATES.USD,
          CHF: r.CHF ?? DEFAULT_RATES.CHF,
          AED: r.AED ?? DEFAULT_RATES.AED,
          BRL: r.BRL ?? DEFAULT_RATES.BRL,
          CNY: r.CNY ?? DEFAULT_RATES.CNY,
        }
        setRates(fetched)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: fetched }))
        } catch {}
      } catch {
        // silently fall back to DEFAULT_RATES already in state
      } finally {
        setLoading(false)
      }
    }

    fetchRates()
  }, [])

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c)
    try { localStorage.setItem('ag_currency', c) } catch {}
  }, [])

  const convert = useCallback((eurAmount: number) => {
    return eurAmount * (rates[currency] ?? 1)
  }, [currency, rates])

  const formatConverted = useCallback((eurAmount: number) => {
    const info = CURRENCIES.find(c => c.code === currency)!
    const amount = eurAmount * (rates[currency] ?? 1)

    if (currency === 'EUR') {
      if (amount >= 1_000_000) {
        const m = amount / 1_000_000
        return `€ ${(m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)).replace('.', ',')}M`
      }
      return `€ ${Math.round(amount).toLocaleString('pt-PT')}`
    }

    if (amount >= 1_000_000) {
      const m = amount / 1_000_000
      return `${info.symbol} ${(m % 1 === 0 ? m.toFixed(1) : m.toFixed(1))}M`
    }
    return `${info.symbol} ${Math.round(amount).toLocaleString('en-US')}`
  }, [currency, rates])

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, convert, formatConverted, loading }}>
      {children}
    </CurrencyContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCurrency() {
  return useContext(CurrencyContext)
}

// ─── CurrencySelector Component ───────────────────────────────────────────────

export function CurrencySelector() {
  const { currency, setCurrency, rates, loading } = useCurrency()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = CURRENCIES.find(c => c.code === currency)!

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function formatRate(code: CurrencyCode) {
    if (code === 'EUR') return '1.00'
    const r = rates[code]
    return r >= 10 ? r.toFixed(2) : r.toFixed(4)
  }

  return (
    <div ref={ref} style={{ position: 'relative', fontFamily: 'var(--font-dm-mono, "DM Mono", monospace)' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          background: open ? 'rgba(201,169,110,0.15)' : 'rgba(10,20,12,0.85)',
          border: '1px solid',
          borderColor: open ? '#c9a96e' : 'rgba(201,169,110,0.3)',
          borderRadius: 0,
          color: '#e8dfc8',
          fontSize: '12px',
          fontFamily: 'inherit',
          letterSpacing: '0.08em',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ fontSize: '14px' }}>{current.flag}</span>
        <span style={{ color: '#c9a96e', fontWeight: 600 }}>{current.code}</span>
        {loading && (
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#c9a96e', opacity: 0.6,
            animation: 'ag-pulse 1s infinite',
          }} />
        )}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', opacity: 0.7 }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="#c9a96e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '220px',
            background: 'rgba(7,15,10,0.97)',
            border: '1px solid rgba(201,169,110,0.25)',
            borderRadius: 0,
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(16px)',
            zIndex: 9999,
          }}
        >
          {/* Header */}
          <div style={{
            padding: '8px 12px 6px',
            borderBottom: '1px solid rgba(201,169,110,0.12)',
            color: 'rgba(201,169,110,0.5)',
            fontSize: '10px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            Moeda de referência
          </div>

          {/* Options */}
          {CURRENCIES.map(c => {
            const isActive = c.code === currency
            return (
              <button
                key={c.code}
                role="option"
                aria-selected={isActive}
                onClick={() => { setCurrency(c.code); setOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  gap: '10px',
                  padding: '9px 14px',
                  background: isActive ? 'rgba(201,169,110,0.1)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '2px solid #c9a96e' : '2px solid transparent',
                  color: isActive ? '#e8dfc8' : 'rgba(200,210,200,0.75)',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,169,110,0.06)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = '#e8dfc8'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(200,210,200,0.75)'
                  }
                }}
              >
                <span style={{ fontSize: '16px', lineHeight: 1 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ color: isActive ? '#c9a96e' : 'inherit', fontWeight: isActive ? 600 : 400 }}>
                    {c.code}
                  </span>
                  <span style={{ marginLeft: '6px', opacity: 0.55, fontSize: '11px' }}>{c.name}</span>
                </span>
                <span style={{ opacity: 0.45, fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                  {formatRate(c.code)}
                </span>
              </button>
            )
          })}

          {/* Footer note */}
          <div style={{
            padding: '6px 14px 8px',
            borderTop: '1px solid rgba(201,169,110,0.1)',
            color: 'rgba(201,169,110,0.35)',
            fontSize: '9px',
            letterSpacing: '0.1em',
          }}>
            Fonte BCE via Frankfurter · Cache 1h
          </div>
        </div>
      )}

      <style>{`
        @keyframes ag-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
