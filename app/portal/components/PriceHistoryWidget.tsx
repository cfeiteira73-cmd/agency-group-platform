'use client'

import { useState, useEffect } from 'react'

interface PriceHistoryPoint {
  preco: number
  data: string
  score: number
}

export default function PriceHistoryWidget({ url }: { url: string }) {
  const [history, setHistory] = useState<PriceHistoryPoint[]>([])
  const [trend, setTrend] = useState<'down' | 'stable' | 'up' | null>(null)

  useEffect(() => {
    if (!url) return
    fetch(`/api/radar/history?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => {
        if (d.history && Array.isArray(d.history) && d.history.length > 1) {
          setHistory(d.history)
          setTrend(d.trend || 'stable')
        }
      })
      .catch(() => {})
  }, [url])

  if (history.length < 2) return null

  const maxP = Math.max(...history.map((h) => h.preco))
  const minP = Math.min(...history.map((h) => h.preco))
  const range = maxP - minP || 1
  const trendIcon = trend === 'down' ? '↓' : trend === 'up' ? '↑' : '→'
  const trendColor = trend === 'down' ? '#16a34a' : trend === 'up' ? '#dc2626' : '#c9a96e'

  return (
    <div style={{ background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.08)', borderRadius: '8px', padding: '16px', marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.6)', fontWeight: 600, letterSpacing: '.06em' }}>HISTÓRICO DE PREÇO</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', fontWeight: 700, color: trendColor }}>{trendIcon} {trend === 'down' ? 'A BAIXAR' : trend === 'up' ? 'A SUBIR' : 'ESTÁVEL'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '48px', marginBottom: '8px' }}>
        {history.map((h, i) => {
          const heightPct = ((h.preco - minP) / range) * 80 + 20
          const isLast = i === history.length - 1
          return (
            <div
              key={i}
              title={`${new Date(h.data).toLocaleDateString('pt-PT')}: €${h.preco.toLocaleString('pt-PT')}`}
              style={{ flex: 1, height: `${heightPct}%`, background: isLast ? '#1c4a35' : 'rgba(28,74,53,.3)', borderRadius: '2px 2px 0 0', transition: 'height 0.3s', minWidth: '8px' }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.35)' }}>{history.length > 0 ? new Date(history[0].data).toLocaleDateString('pt-PT') : ''}</span>
        <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.35)' }}>{history.length > 0 ? new Date(history[history.length - 1].data).toLocaleDateString('pt-PT') : ''}</span>
      </div>
    </div>
  )
}
