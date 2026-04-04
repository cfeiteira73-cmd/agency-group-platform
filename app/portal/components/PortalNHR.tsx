'use client'
import { useUIStore } from '../stores/uiStore'
import { useFinancialStore } from '../stores/financialStore'

interface PortalNHRProps {
  onRunNHR: (overrides?: { pais?: string; tipo?: string; rend?: number; fonte?: boolean }) => Promise<void>
}

export default function PortalNHR({ onRunNHR }: PortalNHRProps) {
  const { darkMode } = useUIStore()
  const {
    nhrResult, nhrLoading,
    nhrPais, setNhrPais,
    nhrTipo, setNhrTipo,
    nhrRend, setNhrRend,
    nhrFonte, setNhrFonte,
    nhrSubTab, setNhrSubTab,
  } = useFinancialStore()

  const PAISES = ['UK','US','FR','DE','CH','NL','BE','IT','IE','CA','AU','BR','AE','CN','SG']
  const TIPOS = [
    { val: 'salario', label: 'Salário / Emprego' },
    { val: 'pensao', label: 'Pensão' },
    { val: 'rendimentos_capitais', label: 'Rendimentos de Capital' },
    { val: 'mais_valias', label: 'Mais-Valias' },
    { val: 'trabalho_independente', label: 'Trabalho Independente' },
    { val: 'royalties', label: 'Royalties / Propriedade Intelectual' },
  ]

  const PERSONAS_NHR = [
    { label: 'Britânico Reformado', pais: 'UK', tipo: 'pensao', rend: 45000, fonte: true },
    { label: 'Executivo Americano', pais: 'US', tipo: 'salario', rend: 200000, fonte: true },
    { label: 'Investidor Francês', pais: 'FR', tipo: 'rendimentos_capitais', rend: 120000, fonte: false },
  ]

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Regime Fiscal de Residência</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>NHR / IFICI Analyser</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>NHR até 2023 · IFICI 2024+ · Comparação regimes · Taxa 20% / 10%</div>
      </div>

      {/* Persona presets */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {PERSONAS_NHR.map(p => (
          <button key={p.label}
            style={{ padding: '6px 14px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.15)', color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer' }}
            onClick={() => onRunNHR(p)}
          >{p.label}</button>
        ))}
      </div>

      <div className="p-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Form */}
        <div className="p-card">
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label className="p-label">País de Origem / Residência Fiscal</label>
              <select className="p-sel" value={nhrPais} onChange={e => setNhrPais(e.target.value)}>
                {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Tipo de Rendimento</label>
              <select className="p-sel" value={nhrTipo} onChange={e => setNhrTipo(e.target.value)}>
                {TIPOS.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Rendimento Anual (€)</label>
              <input className="p-inp" type="number" placeholder="ex: 80000" value={nhrRend} onChange={e => setNhrRend(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" id="nhrFonte" checked={nhrFonte} onChange={e => setNhrFonte(e.target.checked)} />
              <label htmlFor="nhrFonte" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.5)', cursor: 'pointer' }}>Fonte estrangeira (rendimento auferido fora de Portugal)</label>
            </div>
            <button className="p-btn" onClick={() => onRunNHR()} disabled={nhrLoading || !nhrRend}>
              {nhrLoading ? '✦ A calcular...' : '✦ Analisar NHR / IFICI'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div>
          {!nhrResult && !nhrLoading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🌍</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: 'rgba(14,14,13,.4)' }}>Aguarda análise fiscal</div>
            </div>
          )}
          {nhrLoading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#1c4a35', letterSpacing: '.2em' }}>✦ A analisar regime fiscal...</div>
            </div>
          )}
          {nhrResult && (
            <div>
              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid rgba(14,14,13,.1)' }}>
                {(['elegib', 'processo', 'share'] as const).map(t => (
                  <button key={t} className={`deal-tab${nhrSubTab === t ? ' active' : ''}`} onClick={() => setNhrSubTab(t)}>
                    {t === 'elegib' ? 'Elegibilidade' : t === 'processo' ? 'Processo' : 'Partilhar'}
                  </button>
                ))}
              </div>

              {nhrSubTab === 'elegib' && (
                <div className="p-card">
                  <div style={{ marginBottom: '16px' }}>
                    <div className="p-label">Imposto Anual Estimado</div>
                    <div className="p-result-val">€{Number((nhrResult as Record<string, unknown>).imposto_nhr || 0).toLocaleString('pt-PT')}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#4a9c7a', marginTop: '4px' }}>
                      Poupança vs regime geral: €{Number((nhrResult as Record<string, unknown>).poupanca || 0).toLocaleString('pt-PT')}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.08)', marginBottom: '12px' }}>
                    <div className="p-label">Taxa Efectiva</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2rem', color: '#1c4a35', fontWeight: 300 }}>
                      {String((nhrResult as Record<string, unknown>).taxa_efetiva || '—')}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
