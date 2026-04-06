'use client'
import { useState, useEffect, useCallback, type CSSProperties, type MouseEvent } from 'react'

const STORAGE_KEY = 'ag_favorites_v1'

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setFavorites(JSON.parse(stored))
    } catch {}
  }, [])

  const toggle = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites])

  return { favorites, toggle, isFavorite, count: favorites.length }
}

interface FavoriteButtonProps {
  propertyId: string
  size?: 'sm' | 'md' | 'lg'
  style?: CSSProperties
}

export default function FavoriteButton({ propertyId, size = 'md', style }: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites()
  const [mounted, setMounted] = useState(false)
  const [pulse, setPulse] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  const active = mounted && isFavorite(propertyId)

  const sizes = {
    sm: { button: '32px', icon: '14px' },
    md: { button: '40px', icon: '17px' },
    lg: { button: '48px', icon: '20px' },
  }
  const s = sizes[size]

  function handleClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    toggle(propertyId)
    setPulse(true)
    setTimeout(() => setPulse(false), 400)
  }

  return (
    <>
      <button
        onClick={handleClick}
        title={active ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        style={{
          width: s.button, height: s.button,
          borderRadius: '50%',
          background: active ? 'rgba(201,169,110,.18)' : 'rgba(12,31,21,.7)',
          border: `1px solid ${active ? 'rgba(201,169,110,.5)' : 'rgba(244,240,230,.15)'}`,
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all .25s',
          transform: pulse ? 'scale(1.3)' : 'scale(1)',
          ...style,
        }}
      >
        <svg
          width={s.icon} height={s.icon}
          viewBox="0 0 24 24"
          fill={active ? '#c9a96e' : 'none'}
          stroke={active ? '#c9a96e' : 'rgba(244,240,230,.55)'}
          strokeWidth="1.8"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
    </>
  )
}

// ── Favorites Drawer ──────────────────────────────────────────────────────────
import { PROPERTIES, formatPriceFull } from './data'
import Link from 'next/link'

export function FavoritesDrawer() {
  const { favorites, toggle, count } = useFavorites()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const favProps = PROPERTIES.filter(p => favorites.includes(p.id))

  return (
    <>
      {/* Floating trigger */}
      {count > 0 && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', bottom: '32px', right: '32px', zIndex: 850,
            background: '#0c1f15',
            border: '1px solid rgba(201,169,110,.35)',
            color: '#c9a96e',
            width: '56px', height: '56px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#c9a96e" stroke="#c9a96e" strokeWidth="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#c9a96e', color: '#0c1f15',
            width: '20px', height: '20px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'DM Mono', monospace", fontSize: '.5rem', fontWeight: 700,
          }}>{count}</span>
        </button>
      )}

      {/* Drawer overlay */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)',
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1001,
            width: '360px', maxWidth: '90vw',
            background: '#0a1a10',
            borderLeft: '1px solid rgba(201,169,110,.2)',
            display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(0,0,0,.5)',
          }}>
            {/* Header */}
            <div style={{
              padding: '24px 24px 20px',
              borderBottom: '1px solid rgba(201,169,110,.12)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{
                  fontFamily: "'Cormorant', serif", fontWeight: 300,
                  fontSize: '1.25rem', color: '#f4f0e6',
                }}>Favoritos</div>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.46rem',
                  letterSpacing: '.14em', color: 'rgba(201,169,110,.6)',
                  marginTop: '4px',
                }}>{count} imóve{count !== 1 ? 'is' : 'l'} guardado{count !== 1 ? 's' : ''}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(244,240,230,.4)', fontSize: '1.4rem', lineHeight: 1,
              }}>✕</button>
            </div>

            {/* Property list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {favProps.map(p => (
                <div key={p.id} style={{
                  background: '#0e2318',
                  border: '1px solid rgba(201,169,110,.1)',
                  marginBottom: '12px',
                  display: 'flex', gap: '0',
                  overflow: 'hidden',
                }}>
                  {/* Gradient swatch */}
                  <div style={{
                    width: '72px', flexShrink: 0,
                    background: `linear-gradient(${p.grad})`,
                  }} />
                  <div style={{ padding: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'DM Mono', monospace", fontSize: '.42rem',
                      letterSpacing: '.14em', color: 'rgba(201,169,110,.6)',
                      marginBottom: '4px',
                    }}>{p.zona} · {p.ref}</div>
                    <div style={{
                      fontFamily: "'Cormorant', serif", fontWeight: 300,
                      fontSize: '.95rem', color: '#f4f0e6',
                      lineHeight: 1.25, marginBottom: '6px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{p.nome}</div>
                    <div style={{
                      fontFamily: "'Cormorant', serif",
                      fontSize: '1rem', color: '#c9a96e',
                      marginBottom: '10px',
                    }}>{formatPriceFull(p.preco)}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link href={`/imoveis/${p.id}`} style={{
                        background: '#c9a96e', color: '#0c1f15',
                        padding: '6px 12px',
                        fontFamily: "'Jost', sans-serif", fontSize: '.55rem',
                        fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase',
                        textDecoration: 'none', flex: 1, textAlign: 'center',
                      }}>Ver →</Link>
                      <button onClick={() => toggle(p.id)} style={{
                        background: 'rgba(244,240,230,.05)',
                        border: '1px solid rgba(244,240,230,.1)',
                        color: 'rgba(244,240,230,.4)',
                        padding: '6px 10px',
                        fontFamily: "'Jost', sans-serif", fontSize: '.55rem',
                        letterSpacing: '.1em', cursor: 'pointer',
                      }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ padding: '16px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
              <a
                href={`https://wa.me/351919948986?text=${encodeURIComponent('Olá, tenho interesse nos seguintes imóveis: ' + favProps.map(p => p.ref + ' ' + p.nome).join(', '))}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'block', textAlign: 'center',
                  background: '#25D366', color: '#fff',
                  padding: '14px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                  fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >
                Enviar Lista ao Consultor →
              </a>
            </div>
          </div>
        </>
      )}
    </>
  )
}
