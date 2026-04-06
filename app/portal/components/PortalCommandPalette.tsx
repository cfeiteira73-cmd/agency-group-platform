'use client'
import { useState, useEffect, useRef } from 'react'
import type { SectionId } from './types'

interface Command {
  id: string
  label: string
  description: string
  category: 'Navegação' | 'Acções' | 'Ferramentas' | 'Configurações'
  section?: SectionId
  icon: string  // SVG path string
  shortcut?: string
  action?: () => void
}

interface PortalCommandPaletteProps {
  onSetSection: (s: SectionId) => void
  darkMode: boolean
  agentName: string
}

const COMMANDS: Command[] = [
  // Navegação
  { id: 'nav-dashboard',    label: 'Dashboard',           description: 'Vista geral · KPIs · Alertas',        category: 'Navegação', section: 'dashboard',    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'nav-crm',          label: 'CRM Clientes',         description: 'Leads · VIPs · Pipeline relacional',   category: 'Navegação', section: 'crm',          icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'nav-pipeline',     label: 'Pipeline',             description: 'Deals activos · Estágios · Comissões', category: 'Navegação', section: 'pipeline',     icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'nav-imoveis',      label: 'Imóveis',              description: 'Portfólio · Captação · Mapa',          category: 'Navegação', section: 'imoveis',      icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { id: 'nav-radar',        label: 'Deal Radar',           description: 'Off-market · Sinais · IA',             category: 'Navegação', section: 'radar',        icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { id: 'nav-avm',          label: 'AVM Avaliação',        description: '6 metodologias RICS · Relatório PDF',  category: 'Navegação', section: 'avm',          icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'nav-outbound',     label: 'Captação Off-Market',  description: 'Prospecção · Sinais · Outreach',       category: 'Navegação', section: 'outbound',     icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'nav-sofia',        label: 'Sofia Avatar IA',      description: 'Apresentações · Video IA',             category: 'Navegação', section: 'sofia',        icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { id: 'nav-juridico',     label: 'Consultor Jurídico',   description: 'IA legal · CPCV · Fiscalidade',        category: 'Navegação', section: 'juridico',     icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
  { id: 'nav-analytics',    label: 'Analytics',            description: 'Performance · Relatórios · KPIs',      category: 'Navegação', section: 'analytics',    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'nav-marketing',    label: 'Marketing IA',         description: 'Copywriting · SEO · Social',           category: 'Navegação', section: 'marketing',    icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
  { id: 'nav-investidores', label: 'Investidores',         description: 'Perfis · ROI · Portfolio',             category: 'Navegação', section: 'investidores', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'nav-pulse',        label: 'Market Pulse',         description: 'Mercado · Dados · Tendências',         category: 'Navegação', section: 'pulse',        icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'nav-agenda',       label: 'Agenda',               description: 'Visitas · Reuniões · Calendário',      category: 'Navegação', section: 'agenda',       icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'nav-documentos',   label: 'Documentos',           description: 'CPCV · Contratos · Uploads',          category: 'Navegação', section: 'documentos',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'nav-visitas',      label: 'Visitas',              description: 'Agendamento · Feedback · Tour',        category: 'Navegação', section: 'visitas',      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  { id: 'nav-comissoes',    label: 'Comissões',            description: 'Cálculo · Partilha · Histórico',       category: 'Navegação', section: 'comissoes',    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  // Ferramentas
  { id: 'tool-mortgage',    label: 'Simulador Crédito',    description: 'TAN · TAEG · Euribor · Amortização',   category: 'Ferramentas', section: 'mortgage',    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'tool-imt',         label: 'Calculadora IMT',      description: 'IMT · IS · Simulação fiscal',          category: 'Ferramentas', section: 'imt',         icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  { id: 'tool-maisvalias',  label: 'Mais-Valias',          description: 'Imposto · Exclusões · Reinvestimento', category: 'Ferramentas', section: 'maisvalias',  icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
  { id: 'tool-nhr',         label: 'NHR / IFICI',          description: 'Regime fiscal · Simulação',            category: 'Ferramentas', section: 'nhr',         icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 004 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'tool-exitsim',     label: 'Exit Simulator',       description: 'IRR · Cenários · Estratégia saída',    category: 'Ferramentas', section: 'exitsim',     icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'tool-homestaging', label: 'HomeStaging IA',       description: 'Visualização IA · Antes/Depois',       category: 'Ferramentas', section: 'homestaging', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'tool-voz',         label: 'Notas de Voz',         description: 'Gravação · Transcrição · IA',          category: 'Ferramentas', section: 'voz',         icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
]

export default function PortalCommandPalette({ onSetSection, darkMode, agentName }: PortalCommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Open/close with keyboard
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
        setQuery('')
        setSelected(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = query.trim()
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filtered[selected]
        if (cmd) execute(cmd)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered, selected])

  // Reset selection when query changes
  useEffect(() => { setSelected(0) }, [query])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  function execute(cmd: Command) {
    if (cmd.section) onSetSection(cmd.section)
    if (cmd.action) cmd.action()
    setOpen(false)
    setQuery('')
  }

  // Group filtered commands by category
  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  const bg = darkMode ? '#0f1e16' : '#ffffff'
  const overlayBg = darkMode ? 'rgba(6,14,9,.85)' : 'rgba(14,14,13,.60)'
  const borderColor = darkMode ? 'rgba(201,169,110,.18)' : 'rgba(14,14,13,.10)'
  const textPrimary = darkMode ? 'rgba(240,237,228,.92)' : '#0e0e0d'
  const textMuted = darkMode ? 'rgba(240,237,228,.42)' : 'rgba(14,14,13,.45)'
  const categoryColor = darkMode ? 'rgba(201,169,110,.55)' : 'rgba(28,74,53,.55)'
  const selectedBg = darkMode ? 'rgba(201,169,110,.14)' : 'rgba(28,74,53,.08)'
  const selectedBorder = '#c9a96e'

  if (!open) return null

  let globalIndex = 0

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: overlayBg,
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: '100%', maxWidth: 620,
          background: bg,
          border: `1px solid ${borderColor}`,
          borderRadius: 16,
          boxShadow: darkMode
            ? '0 24px 80px rgba(0,0,0,.60), 0 8px 24px rgba(0,0,0,.40)'
            : '0 24px 80px rgba(14,14,13,.20), 0 8px 24px rgba(14,14,13,.12)',
          overflow: 'hidden',
          margin: '0 16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px',
          borderBottom: `1px solid ${borderColor}`,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar secções, ferramentas, acções..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '.88rem',
              fontFamily: 'var(--font-jost), sans-serif',
              color: textPrimary,
              letterSpacing: '.01em',
            }}
          />
          <kbd style={{
            fontFamily: 'var(--font-dm-mono), monospace',
            fontSize: '.52rem',
            letterSpacing: '.08em',
            color: textMuted,
            background: darkMode ? 'rgba(240,237,228,.06)' : 'rgba(14,14,13,.06)',
            border: `1px solid ${borderColor}`,
            borderRadius: 4,
            padding: '3px 7px',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: textMuted, fontSize: '.78rem', fontFamily: 'var(--font-jost), sans-serif' }}>
              Nenhum resultado para &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(grouped).map(([category, commands]) => (
              <div key={category}>
                <div style={{
                  padding: '8px 20px 4px',
                  fontFamily: 'var(--font-dm-mono), monospace',
                  fontSize: '.52rem',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: categoryColor,
                }}>
                  {category}
                </div>
                {commands.map(cmd => {
                  const idx = globalIndex++
                  const isSelected = idx === selected
                  return (
                    <div
                      key={cmd.id}
                      data-index={idx}
                      onClick={() => execute(cmd)}
                      onMouseEnter={() => setSelected(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 20px',
                        cursor: 'pointer',
                        background: isSelected ? selectedBg : 'transparent',
                        borderLeft: isSelected ? `2px solid ${selectedBorder}` : '2px solid transparent',
                        transition: 'all .1s',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32,
                        borderRadius: 8,
                        background: isSelected
                          ? (darkMode ? 'rgba(201,169,110,.18)' : 'rgba(28,74,53,.10)')
                          : (darkMode ? 'rgba(240,237,228,.05)' : 'rgba(14,14,13,.04)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background .15s',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke={isSelected ? '#c9a96e' : textMuted}
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d={cmd.icon}/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '.82rem',
                          fontFamily: 'var(--font-jost), sans-serif',
                          color: isSelected ? (darkMode ? '#f0ede4' : '#0e0e0d') : textPrimary,
                          fontWeight: isSelected ? 500 : 400,
                          letterSpacing: '.01em',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {cmd.label}
                        </div>
                        <div style={{
                          fontSize: '.64rem',
                          fontFamily: 'var(--font-jost), sans-serif',
                          color: textMuted,
                          marginTop: 1,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {cmd.description}
                        </div>
                      </div>
                      {isSelected && (
                        <kbd style={{
                          fontFamily: 'var(--font-dm-mono), monospace',
                          fontSize: '.52rem',
                          letterSpacing: '.06em',
                          color: '#c9a96e',
                          background: darkMode ? 'rgba(201,169,110,.10)' : 'rgba(28,74,53,.08)',
                          border: `1px solid ${darkMode ? 'rgba(201,169,110,.25)' : 'rgba(28,74,53,.20)'}`,
                          borderRadius: 4,
                          padding: '3px 8px',
                          flexShrink: 0,
                        }}>↵ ENTER</kbd>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: `1px solid ${borderColor}`,
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <span style={{ fontSize: '.54rem', fontFamily: 'var(--font-dm-mono), monospace', color: textMuted, letterSpacing: '.08em' }}>
            ↑↓ navegar
          </span>
          <span style={{ fontSize: '.54rem', fontFamily: 'var(--font-dm-mono), monospace', color: textMuted, letterSpacing: '.08em' }}>
            ↵ seleccionar
          </span>
          <span style={{ fontSize: '.54rem', fontFamily: 'var(--font-dm-mono), monospace', color: textMuted, letterSpacing: '.08em' }}>
            ESC fechar
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '.52rem', fontFamily: 'var(--font-dm-mono), monospace', color: textMuted, letterSpacing: '.10em', textTransform: 'uppercase' }}>
            {agentName} · Agency Group
          </span>
        </div>
      </div>
    </div>
  )
}
