'use client'
import { useRef } from 'react'
import { useUIStore } from '../stores/uiStore'
import { PORTAL_PROPERTIES } from './constants'

interface PortalSofiaProps {
  sofiaSessionId: string | null
  sofiaConnected: boolean
  sofiaLoading: boolean
  sofiaSpeaking: boolean
  sofiaText: string
  sofiaError: string | null
  sofiaScriptLoading: boolean
  sofiaPropSel: string
  sofiaLang: 'PT' | 'EN' | 'FR' | 'AR'
  sofiaVideoRef: React.RefObject<HTMLVideoElement | null>
  setSofiaText: (s: string) => void
  setSofiaPropSel: (s: string) => void
  setSofiaLang: (l: 'PT' | 'EN' | 'FR' | 'AR') => void
  onConnect: () => Promise<void>
  onDisconnect: () => void
  onSpeak: () => Promise<void>
  onGenerateScript: () => Promise<void>
}

export default function PortalSofia({
  sofiaSessionId,
  sofiaConnected,
  sofiaLoading,
  sofiaSpeaking,
  sofiaText,
  sofiaError,
  sofiaScriptLoading,
  sofiaPropSel,
  sofiaLang,
  sofiaVideoRef,
  setSofiaText,
  setSofiaPropSel,
  setSofiaLang,
  onConnect,
  onDisconnect,
  onSpeak,
  onGenerateScript,
}: PortalSofiaProps) {
  const { darkMode } = useUIStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: darkMode ? '#0c1f15' : '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#1c4a35,#c9a96e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant',serif", fontSize: '1rem', color: '#f4f0e6', fontWeight: 300 }}>S</div>
          <div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 300, color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Sofia <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>Avatar IA</em></div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: sofiaConnected ? '#4a9c7a' : 'rgba(14,14,13,.3)', letterSpacing: '.06em' }}>
              {sofiaConnected ? '● CONECTADO' : sofiaLoading ? '● A conectar...' : '○ Desconectado'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Language selector */}
          {(['PT', 'EN', 'FR', 'AR'] as const).map(l => (
            <button key={l}
              style={{ padding: '4px 10px', background: sofiaLang === l ? '#c9a96e' : 'transparent', border: `1px solid ${sofiaLang === l ? '#c9a96e' : darkMode ? 'rgba(244,240,230,.1)' : 'rgba(14,14,13,.1)'}`, color: sofiaLang === l ? '#0c1f15' : darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.4)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer' }}
              onClick={() => setSofiaLang(l)}>
              {l}
            </button>
          ))}
          {!sofiaConnected ? (
            <button className="p-btn" style={{ padding: '6px 14px' }} onClick={onConnect} disabled={sofiaLoading}>
              {sofiaLoading ? '✦ A conectar...' : '▶ Conectar Sofia'}
            </button>
          ) : (
            <button style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(220,38,38,.3)', color: '#dc2626', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer', letterSpacing: '.08em' }} onClick={onDisconnect}>
              ■ Desconectar
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', gap: '0', overflow: 'hidden' }}>
        {/* Video panel */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c1f15', position: 'relative' }}>
          {sofiaConnected ? (
            <video
              ref={sofiaVideoRef as React.RefObject<HTMLVideoElement>}
              autoPlay
              playsInline
              style={{ width: '100%', maxWidth: '500px', height: 'auto', borderRadius: '4px' }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg,rgba(28,74,53,.5),rgba(201,169,110,.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid rgba(201,169,110,.2)' }}>
                <span style={{ fontFamily: "'Cormorant',serif", fontSize: '2rem', color: '#c9a96e' }}>S</span>
              </div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 300, color: 'rgba(244,240,230,.6)', marginBottom: '8px' }}>Sofia está offline</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(244,240,230,.25)', lineHeight: 1.6 }}>Clique em "Conectar Sofia" para iniciar<br />apresentação de propriedade com avatar IA</div>
            </div>
          )}
          {sofiaSpeaking && (
            <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ width: '4px', background: '#c9a96e', borderRadius: '2px', animation: `soundBar .5s ease-in-out ${i * 0.1}s infinite alternate` }} />
              ))}
            </div>
          )}
        </div>

        {/* Controls panel */}
        <div style={{ width: '300px', flexShrink: 0, borderLeft: `1px solid ${darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.08)'}`, padding: '20px', background: darkMode ? '#0f2117' : '#fff', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <div>
            <label className="p-label">Imóvel para Apresentar</label>
            <select className="p-sel" value={sofiaPropSel} onChange={e => setSofiaPropSel(e.target.value)}>
              <option value="">— Selecionar imóvel</option>
              {(PORTAL_PROPERTIES as Record<string, unknown>[]).map(p => (
                <option key={String(p.id)} value={String(p.id)}>{String(p.nome || p.title)}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="p-label" style={{ marginBottom: 0 }}>Script</label>
              <button
                style={{ background: 'transparent', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#1c4a35', cursor: 'pointer' }}
                onClick={onGenerateScript}
                disabled={sofiaScriptLoading || !sofiaPropSel}>
                {sofiaScriptLoading ? '✦ A gerar...' : '✦ Gerar Script IA'}
              </button>
            </div>
            <textarea
              className="p-inp"
              rows={8}
              placeholder="Escreva o texto para a Sofia apresentar..."
              value={sofiaText}
              onChange={e => setSofiaText(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button className="p-btn" onClick={onSpeak} disabled={!sofiaConnected || sofiaSpeaking || !sofiaText.trim()}>
            {sofiaSpeaking ? '✦ A falar...' : '▶ Falar'}
          </button>

          {sofiaError && (
            <div style={{ padding: '10px 12px', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#dc2626' }}>
              {sofiaError}
            </div>
          )}

          <div style={{ padding: '12px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.08)' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.08em', marginBottom: '8px', textTransform: 'uppercase' }}>Casos de Uso</div>
            {['Apresentação Virtual', 'Tour Remoto HNWI', 'Pitch Investidor', 'WhatsApp Vídeo'].map(u => (
              <div key={u} style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.5)', padding: '4px 0', borderBottom: '1px solid rgba(14,14,13,.04)' }}>
                ✓ {u}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
