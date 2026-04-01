'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Property, formatPriceFull } from './data'

interface CompareBarProps {
  selected: string[]
  properties: Property[]
  onRemove: (id: string) => void
  onClear: () => void
}

const ENERGY_COLOR: Record<string, string> = {
  'A+': '#00aa44', 'A': '#33cc55', 'B': '#99cc00',
  'C': '#ffaa00', 'D': '#ff7700', 'E': '#ff3300',
}

export default function CompareBar({ selected, properties, onRemove, onClear }: CompareBarProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const selProps = properties.filter(p => selected.includes(p.id))

  if (selected.length === 0) return null

  const rows: { label: string; key: keyof Property; format?: (v: unknown) => string }[] = [
    { label: 'Zona',       key: 'zona' },
    { label: 'Bairro',     key: 'bairro' },
    { label: 'Tipo',       key: 'tipo' },
    { label: 'Área',       key: 'area',    format: v => `${v} m²` },
    { label: 'Quartos',    key: 'quartos', format: v => `T${v}` },
    { label: 'WC',         key: 'casasBanho' },
    { label: 'Preço',      key: 'preco',   format: v => formatPriceFull(v as number) },
    { label: '€/m²',       key: 'preco',   format: (v) => `€${Math.round((v as number)).toLocaleString('pt-PT')}` },
    { label: 'EPC',        key: 'energia' },
    { label: 'Piscina',    key: 'piscina', format: v => v ? '✓' : '—' },
    { label: 'Garagem',    key: 'garagem', format: v => v ? '✓' : '—' },
    { label: 'Jardim',     key: 'jardim',  format: v => v ? '✓' : '—' },
    { label: 'Terraço',    key: 'terraco', format: v => v ? '✓' : '—' },
    { label: 'Vista',      key: 'vista' },
    { label: 'Mandato',    key: 'badge',   format: v => (v as string) || 'Standard' },
    { label: 'Tour 3D',    key: 'tourUrl', format: v => v ? '✓' : '—' },
  ]

  return (
    <>
      {/* Sticky bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 850,
        background: 'rgba(10,22,14,.97)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(201,169,110,.25)',
        padding: '14px 40px',
        display: 'flex', alignItems: 'center', gap: '20px',
      }}>
        {/* Label */}
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: '.46rem',
          letterSpacing: '.18em', color: 'rgba(201,169,110,.7)',
          textTransform: 'uppercase', flexShrink: 0,
        }}>
          Comparar ({selected.length}/3)
        </div>

        {/* Selected chips */}
        <div style={{ display: 'flex', gap: '10px', flex: 1, overflow: 'hidden' }}>
          {selProps.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(201,169,110,.1)',
              border: '1px solid rgba(201,169,110,.25)',
              padding: '6px 12px',
              maxWidth: '220px',
            }}>
              <span style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                color: '#f4f0e6', overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{p.nome}</span>
              <button onClick={() => onRemove(p.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(244,240,230,.35)', fontSize: '.75rem', lineHeight: 1,
                padding: 0, flexShrink: 0,
              }}>✕</button>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: 3 - selected.length }).map((_, i) => (
            <div key={i} style={{
              width: '120px',
              border: '1px dashed rgba(244,240,230,.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'DM Mono', monospace", fontSize: '.42rem',
              letterSpacing: '.1em', color: 'rgba(244,240,230,.2)',
              height: '32px',
            }}>+ imóvel</div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button onClick={onClear} style={{
            background: 'none',
            border: '1px solid rgba(244,240,230,.15)',
            color: 'rgba(244,240,230,.4)',
            padding: '8px 16px',
            fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
            letterSpacing: '.12em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}>Limpar</button>

          <button
            onClick={() => setModalOpen(true)}
            disabled={selected.length < 2}
            style={{
              background: selected.length >= 2 ? '#c9a96e' : 'rgba(201,169,110,.2)',
              color: selected.length >= 2 ? '#0c1f15' : 'rgba(201,169,110,.4)',
              border: 'none',
              padding: '8px 24px',
              fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
              fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
              cursor: selected.length >= 2 ? 'pointer' : 'not-allowed',
              transition: 'all .2s',
            }}
          >
            Comparar →
          </button>
        </div>
      </div>

      {/* Comparison Modal */}
      {modalOpen && (
        <>
          <div
            onClick={() => setModalOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1050,
              background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)',
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1051,
            background: '#0a1a10',
            border: '1px solid rgba(201,169,110,.25)',
            width: '90vw', maxWidth: '1100px',
            maxHeight: '85vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 32px 80px rgba(0,0,0,.6)',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '24px 32px',
              borderBottom: '1px solid rgba(201,169,110,.12)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <div>
                <div style={{
                  fontFamily: "'Cormorant', serif", fontWeight: 300,
                  fontSize: '1.5rem', color: '#f4f0e6',
                }}>Comparação de Imóveis</div>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.46rem',
                  letterSpacing: '.14em', color: 'rgba(201,169,110,.6)',
                  marginTop: '4px',
                }}>{selProps.length} imóveis selecionados</div>
              </div>
              <button onClick={() => setModalOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(244,240,230,.4)', fontSize: '1.4rem',
              }}>✕</button>
            </div>

            {/* Comparison table */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '140px' }} />
                  {selProps.map(p => <col key={p.id} />)}
                </colgroup>

                {/* Property headers */}
                <thead>
                  <tr>
                    <th style={{
                      background: '#061510', padding: '20px 24px',
                      borderRight: '1px solid rgba(201,169,110,.1)',
                      borderBottom: '1px solid rgba(201,169,110,.15)',
                      textAlign: 'left',
                    }} />
                    {selProps.map(p => (
                      <th key={p.id} style={{
                        background: '#061510', padding: '20px 24px',
                        borderRight: '1px solid rgba(201,169,110,.08)',
                        borderBottom: '1px solid rgba(201,169,110,.15)',
                        textAlign: 'left', verticalAlign: 'top',
                      }}>
                        <div style={{
                          height: '80px', marginBottom: '12px',
                          background: `linear-gradient(${p.grad})`,
                          position: 'relative', overflow: 'hidden',
                        }}>
                          {p.badge && (
                            <div style={{
                              position: 'absolute', top: '8px', right: '8px',
                              background: '#c9a96e', color: '#0c1f15',
                              fontFamily: "'DM Mono', monospace", fontSize: '.4rem',
                              letterSpacing: '.14em', padding: '3px 8px',
                            }}>{p.badge}</div>
                          )}
                        </div>
                        <div style={{
                          fontFamily: "'DM Mono', monospace", fontSize: '.44rem',
                          letterSpacing: '.12em', color: 'rgba(201,169,110,.6)',
                          marginBottom: '4px',
                        }}>{p.ref}</div>
                        <div style={{
                          fontFamily: "'Cormorant', serif", fontWeight: 300,
                          fontSize: '1rem', color: '#f4f0e6',
                          lineHeight: 1.3, marginBottom: '8px',
                        }}>{p.nome}</div>
                        <div style={{
                          fontFamily: "'Cormorant', serif",
                          fontSize: '1.1rem', color: '#c9a96e',
                          marginBottom: '12px',
                        }}>{formatPriceFull(p.preco)}</div>
                        <Link href={`/imoveis/${p.id}`} style={{
                          display: 'inline-block',
                          background: '#c9a96e', color: '#0c1f15',
                          padding: '7px 16px',
                          fontFamily: "'Jost', sans-serif", fontSize: '.55rem',
                          fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase',
                          textDecoration: 'none',
                        }}>Ver →</Link>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Data rows */}
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={row.label} style={{
                      background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)',
                    }}>
                      <td style={{
                        padding: '12px 24px',
                        borderRight: '1px solid rgba(201,169,110,.1)',
                        fontFamily: "'DM Mono', monospace", fontSize: '.44rem',
                        letterSpacing: '.1em', color: 'rgba(244,240,230,.4)',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid rgba(255,255,255,.04)',
                      }}>{row.label}</td>

                      {selProps.map(p => {
                        const rawVal = p[row.key]
                        const displayVal = row.format
                          ? row.key === 'preco' && row.label === '€/m²'
                            ? `€${Math.round(p.preco / p.area).toLocaleString('pt-PT')}`
                            : row.format(rawVal)
                          : String(rawVal ?? '—')

                        const isGood = (row.key === 'piscina' || row.key === 'garagem' || row.key === 'jardim' || row.key === 'terraco' || row.key === 'tourUrl') && rawVal === true

                        return (
                          <td key={p.id} style={{
                            padding: '12px 24px',
                            borderRight: '1px solid rgba(201,169,110,.06)',
                            fontFamily: row.key === 'energia' ? "'DM Mono', monospace" : "'Jost', sans-serif",
                            fontSize: '.75rem',
                            color: isGood
                              ? '#c9a96e'
                              : row.key === 'energia'
                              ? (ENERGY_COLOR[String(rawVal)] || '#f4f0e6')
                              : row.key === 'preco' && row.label === 'Preço'
                              ? '#c9a96e'
                              : 'rgba(244,240,230,.75)',
                            borderBottom: '1px solid rgba(255,255,255,.04)',
                          }}>
                            {displayVal}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer CTA */}
            <div style={{
              padding: '20px 32px',
              borderTop: '1px solid rgba(201,169,110,.12)',
              display: 'flex', gap: '12px', justifyContent: 'flex-end',
              flexShrink: 0,
            }}>
              <a
                href={`https://wa.me/351919948986?text=${encodeURIComponent('Olá, estou a comparar os imóveis: ' + selProps.map(p => p.ref).join(', ') + '. Podem ajudar-me a decidir?')}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  background: '#25D366', color: '#fff',
                  padding: '12px 28px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                  fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >Pedir Ajuda ao Consultor →</a>
            </div>
          </div>
        </>
      )}
    </>
  )
}
