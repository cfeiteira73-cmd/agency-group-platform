'use client'
import { useUIStore } from '../stores/uiStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { PORTAL_PROPERTIES } from './constants'

interface PortalInvestorPitchProps {
  onRunInvestorPitch: () => Promise<void>
  exportToPDF: (title: string, html: string) => void
}

export default function PortalInvestorPitch({ onRunInvestorPitch, exportToPDF }: PortalInvestorPitchProps) {
  const { darkMode } = useUIStore()
  const {
    ipProperty, setIpProperty,
    ipInvestorType, setIpInvestorType,
    ipHorizon, setIpHorizon,
    ipIrr, setIpIrr,
    ipLang, setIpLang,
    ipLoading,
    ipResult,
    ipError,
  } = usePortfolioStore()

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Captação de Capital</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Investor Pitch IA</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>Family Office · HNWI · Institucional · Multi-idioma</div>
      </div>

      <div className="p-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Config */}
        <div className="p-card">
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label className="p-label">Imóvel</label>
              <select className="p-sel" value={ipProperty} onChange={e => setIpProperty(e.target.value)}>
                <option value="">— Selecionar imóvel</option>
                {(PORTAL_PROPERTIES as Record<string, unknown>[]).map(p => (
                  <option key={String(p.id)} value={String(p.id)}>{String(p.nome || p.title)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="p-label">Tipo de Investidor</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {(['private', 'family_office', 'institutional', 'hnwi'] as const).map(t => (
                  <button key={t}
                    style={{ padding: '8px', background: ipInvestorType === t ? '#1c4a35' : 'transparent', border: `1px solid ${ipInvestorType === t ? '#1c4a35' : 'rgba(14,14,13,.15)'}`, color: ipInvestorType === t ? '#f4f0e6' : 'rgba(14,14,13,.55)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer', letterSpacing: '.06em', textTransform: 'uppercase' }}
                    onClick={() => setIpInvestorType(t)}>
                    {t === 'family_office' ? 'Family Office' : t === 'hnwi' ? 'HNWI' : t === 'institutional' ? 'Institucional' : 'Privado'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="p-label">Horizonte de Investimento</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {([3, 5, 10] as const).map(h => (
                  <button key={h}
                    style={{ flex: 1, padding: '8px', background: ipHorizon === h ? '#c9a96e' : 'transparent', border: `1px solid ${ipHorizon === h ? '#c9a96e' : 'rgba(14,14,13,.15)'}`, color: ipHorizon === h ? '#0c1f15' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer' }}
                    onClick={() => setIpHorizon(h)}>
                    {h} anos
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="p-label">IRR Target</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {([8, 12, 15, 20] as const).map(irr => (
                  <button key={irr}
                    style={{ flex: 1, padding: '8px', background: ipIrr === irr ? '#1c4a35' : 'transparent', border: `1px solid ${ipIrr === irr ? '#1c4a35' : 'rgba(14,14,13,.15)'}`, color: ipIrr === irr ? '#f4f0e6' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer' }}
                    onClick={() => setIpIrr(irr)}>
                    {irr}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="p-label">Idioma</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['PT', 'EN', 'FR', 'AR'] as const).map(l => (
                  <button key={l}
                    style={{ flex: 1, padding: '8px', background: ipLang === l ? '#c9a96e' : 'transparent', border: `1px solid ${ipLang === l ? '#c9a96e' : 'rgba(14,14,13,.15)'}`, color: ipLang === l ? '#0c1f15' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer' }}
                    onClick={() => setIpLang(l)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <button className="p-btn" onClick={onRunInvestorPitch} disabled={ipLoading || !ipProperty}>
              {ipLoading ? '✦ A gerar pitch...' : '✦ Gerar Investor Pitch'}
            </button>
          </div>
        </div>

        {/* Result */}
        <div>
          {!ipResult && !ipLoading && !ipError && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📊</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: 'rgba(14,14,13,.4)' }}>Aguarda geração de pitch</div>
            </div>
          )}
          {ipLoading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#1c4a35', letterSpacing: '.2em' }}>✦ A gerar investor pitch...</div>
            </div>
          )}
          {ipError && (
            <div className="p-card" style={{ borderLeft: '3px solid #dc2626' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: '#dc2626' }}>{ipError}</div>
            </div>
          )}
          {ipResult && (
            <div className="p-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: darkMode ? '#f4f0e6' : '#0e0e0d', fontWeight: 300 }}>
                  {String((ipResult as Record<string, unknown>).title || 'Investor Pitch')}
                </div>
                <button className="p-btn" style={{ padding: '6px 14px' }}
                  onClick={() => {
                    const html = `<div>${String((ipResult as Record<string, unknown>).executive_summary || '')}</div>`
                    exportToPDF('Investor Pitch', html)
                  }}>
                  ⬇ PDF
                </button>
              </div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', lineHeight: 1.75, color: darkMode ? 'rgba(244,240,230,.8)' : 'rgba(14,14,13,.75)' }}>
                {String((ipResult as Record<string, unknown>)?.executive_summary ?? '')}
              </div>
              {!!(ipResult as Record<string, unknown>).key_metrics && (
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {Object.entries((ipResult as Record<string, unknown>).key_metrics as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} style={{ padding: '10px 12px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.08)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '3px' }}>{k}</div>
                      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: '#1c4a35', fontWeight: 300 }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
