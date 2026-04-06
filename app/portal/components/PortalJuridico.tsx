'use client'
import { useEffect, useRef } from 'react'
import { useUIStore } from '../stores/uiStore'
import type { JurMsg } from './types'
import { renderJurMarkdown } from './utils'
import { JUR_SUGGESTIONS } from './constants'

interface PortalJuridicoProps {
  jurMsgs: JurMsg[]
  jurInput: string
  jurLoading: boolean
  jurWebSearch: boolean
  jurMode: 'rapido' | 'memo'
  setJurInput: (s: string) => void
  setJurMode: (m: 'rapido' | 'memo') => void
  onEnviar: (texto?: string) => Promise<void>
  onExportar: () => void
}

export default function PortalJuridico({
  jurMsgs,
  jurInput,
  jurLoading,
  jurWebSearch,
  jurMode,
  setJurInput,
  setJurMode,
  onEnviar,
  onExportar,
}: PortalJuridicoProps) {
  const { darkMode } = useUIStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [jurMsgs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: darkMode ? '#0f2117' : '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: '#1c4a35', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#f4f0e6" strokeWidth="1.5" width="18" height="18"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.88rem', fontWeight: 500, color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Consultor Jurídico IA</div>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em' }}>
              {jurWebSearch ? '🌐 Web Search Activo' : '⚡ Resposta Rápida'} · {jurMsgs.length - 1} mensagens
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', border: `1px solid ${darkMode ? 'rgba(244,240,230,.1)' : 'rgba(14,14,13,.1)'}`, borderRadius: '6px', overflow: 'hidden' }}>
            {(['rapido', 'memo'] as const).map(m => (
              <button key={m}
                style={{ padding: '5px 12px', background: jurMode === m ? '#1c4a35' : 'transparent', color: jurMode === m ? '#f4f0e6' : darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.4)', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', border: 'none', cursor: 'pointer', letterSpacing: '.06em', transition: 'all .2s' }}
                onClick={() => setJurMode(m)}>
                {m === 'rapido' ? 'Rápido' : 'MEMO'}
              </button>
            ))}
          </div>
          <button onClick={onExportar} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${darkMode ? 'rgba(244,240,230,.1)' : 'rgba(14,14,13,.1)'}`, color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.4)', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', cursor: 'pointer', borderRadius: '6px', transition: 'all .2s' }}>
            ⬇ Exportar
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', background: darkMode ? '#0c1a10' : '#f9f7f3' }}>
        {jurMsgs.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: msg.role === 'user' ? '#c9a96e' : '#1c4a35', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#fff' }}>
              {msg.role === 'user' ? 'AG' : 'JR'}
            </div>
            <div style={{ maxWidth: '78%', padding: '12px 16px', background: msg.role === 'user' ? (darkMode ? 'rgba(201,169,110,.12)' : 'rgba(201,169,110,.08)') : (darkMode ? '#122a1a' : '#fff'), border: `1px solid ${msg.role === 'user' ? 'rgba(201,169,110,.2)' : darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.08)'}`, borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
              {msg.mode === 'memo' && (
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#c9a96e', letterSpacing: '.1em', marginBottom: '6px', textTransform: 'uppercase' }}>📋 MEMO JURÍDICO</div>
              )}
              {msg.webSearch && (
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#3b82f6', letterSpacing: '.06em', marginBottom: '6px' }}>🌐 Web Search utilizado</div>
              )}
              <div
                style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: darkMode ? 'rgba(244,240,230,.85)' : '#0e0e0d', lineHeight: 1.75 }}
                dangerouslySetInnerHTML={{ __html: renderJurMarkdown(msg.content) }}
              />
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: darkMode ? 'rgba(244,240,230,.2)' : 'rgba(14,14,13,.25)', marginTop: '6px' }}>{msg.ts}</div>
            </div>
          </div>
        ))}
        {jurLoading && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1c4a35', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#fff' }}>JR</div>
            <div style={{ padding: '12px 16px', background: darkMode ? '#122a1a' : '#fff', border: `1px solid ${darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.08)'}`, borderRadius: '12px' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#1c4a35', animation: `jdot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div style={{ padding: '8px 24px', borderTop: `1px solid ${darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.06)'}`, overflowX: 'auto', display: 'flex', gap: '6px', flexShrink: 0, background: darkMode ? '#0f2117' : '#fff' }}>
        {JUR_SUGGESTIONS.slice(0, 6).map((s: Record<string, string>, i: number) => (
          <button key={i}
            style={{ whiteSpace: 'nowrap', padding: '4px 10px', background: 'transparent', border: `1px solid ${darkMode ? 'rgba(244,240,230,.1)' : 'rgba(14,14,13,.1)'}`, color: darkMode ? 'rgba(244,240,230,.45)' : 'rgba(14,14,13,.45)', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', cursor: 'pointer', flexShrink: 0, borderRadius: '6px', transition: 'all .2s' }}
            onClick={() => onEnviar(s.q)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 24px', borderTop: `1px solid ${darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.08)'}`, display: 'flex', gap: '10px', flexShrink: 0, background: darkMode ? '#0f2117' : '#fff' }}>
        <input
          className="p-inp"
          style={{ flex: 1 }}
          placeholder={jurMode === 'memo' ? 'MEMO: escreva o tema para relatório jurídico completo...' : 'Questão jurídica, CPCV, NHR, Golden Visa, IMT...'}
          value={jurInput}
          onChange={e => setJurInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnviar() } }}
          disabled={jurLoading}
        />
        <button className="p-btn" onClick={() => onEnviar()} disabled={jurLoading || !jurInput.trim()}>
          {jurLoading ? '...' : '→'}
        </button>
      </div>
    </div>
  )
}
