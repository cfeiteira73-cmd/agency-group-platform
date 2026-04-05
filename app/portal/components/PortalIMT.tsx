'use client'
import { useState } from 'react'
import { exportToPDF } from '../utils/export'
import { useUIStore } from '../stores/uiStore'

// ─── Types ───────────────────────────────────────────────────────────────────

interface IMTResult {
  imt: number
  is: number
  registro: number
  notario: number
  advogado: number
  total: number
  totalSemAdvogado: number
  taxaEfetiva: string
  isento: boolean
  savings: number
  breakdown: { label: string; value: number; pct: string }[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PortalIMT() {
  const [imtValor, setImtValor] = useState('')
  const [imtTipo, setImtTipo] = useState<'hpp' | 'second' | 'invest'>('hpp')
  const [imtComprador, setImtComprador] = useState<'singular' | 'empresa'>('singular')
  const [imtResult, setImtResult] = useState<Record<string, unknown> | null>(null)
  const [imtLoading, setImtLoading] = useState(false)
  const setSection = useUIStore(s => s.setSection)

  const calcIMT = async () => {
    if (!imtValor || Number(imtValor) <= 0) return
    setImtLoading(true)
    try {
      const res = await fetch('/api/imt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: Number(imtValor), tipo: imtTipo, comprador: imtComprador }),
      })
      const d = await res.json()
      if (d.success) setImtResult(d)
    } catch (e) { console.error(e) }
    finally { setImtLoading(false) }
  }

  const fmt = (n: number) => `€${Math.round(n).toLocaleString('pt-PT')}`

  const presets = [
    { label: '€250K', v: '250000' },
    { label: '€500K', v: '500000' },
    { label: '€750K', v: '750000' },
    { label: '€1M', v: '1000000' },
    { label: '€2M', v: '2000000' },
    { label: '€5M', v: '5000000' },
  ]

  const r = imtResult as IMTResult | null
  const valor = Number(imtValor)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: '#0e0e0d', letterSpacing: '-.01em', marginBottom: '4px' }}>Calculadora IMT + IS + Custos Totais</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Tabelas actualizadas 2026 · Portugal · IMI exempt · HPP / Segunda Habitação / Investimento</div>
      </div>

      {/* Input card */}
      <div style={{ background: '#fff', border: '1px solid rgba(14,14,13,.08)', padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: '6px' }}>Valor do Imóvel (€)</label>
            <input className="p-inp" type="number" value={imtValor} onChange={e => setImtValor(e.target.value)} placeholder="Ex: 500000" style={{ fontSize: '1rem', padding: '10px 14px', fontFamily: "'Cormorant',serif" }} onKeyDown={e => e.key === 'Enter' && calcIMT()} />
          </div>
          <div>
            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: '6px' }}>Tipo de Aquisição</label>
            <select className="p-inp" value={imtTipo} onChange={e => setImtTipo(e.target.value as 'hpp' | 'second' | 'invest')}>
              <option value="hpp">🏠 Habitação Própria Permanente</option>
              <option value="second">🏖 Segunda Habitação</option>
              <option value="invest">🏢 Investimento / Empresa</option>
            </select>
          </div>
          <div>
            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: '6px' }}>Comprador</label>
            <select className="p-inp" value={imtComprador} onChange={e => setImtComprador(e.target.value as 'singular' | 'empresa')}>
              <option value="singular">Pessoa Singular</option>
              <option value="empresa">Empresa / Jurídico</option>
            </select>
          </div>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {presets.map(p => (
            <button key={p.label} onClick={() => { setImtValor(p.v); setImtResult(null) }}
              style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', padding: '6px 14px', background: imtValor === p.v ? '#1c4a35' : 'rgba(14,14,13,.04)', color: imtValor === p.v ? '#f4f0e6' : 'rgba(14,14,13,.5)', border: `1px solid ${imtValor === p.v ? '#1c4a35' : 'rgba(14,14,13,.1)'}`, cursor: 'pointer', letterSpacing: '.06em', transition: 'all .2s' }}>
              {p.label}
            </button>
          ))}
        </div>

        <button className="p-btn p-btn-gold" style={{ padding: '12px 32px', fontSize: '.5rem', letterSpacing: '.12em' }} onClick={calcIMT} disabled={imtLoading || !imtValor}>
          {imtLoading ? 'A calcular...' : '⟶ Calcular Custos Totais'}
        </button>
      </div>

      {/* Results */}
      {r && (
        <div>
          {/* Isento banner */}
          {r.isento && (
            <div style={{ padding: '14px 20px', background: 'rgba(28,74,53,.08)', border: '1px solid rgba(28,74,53,.2)', borderLeft: '3px solid #1c4a35', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.4rem' }}>✅</span>
              <div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 600, color: '#1c4a35' }}>Isenção de IMT Aplicável</div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(14,14,13,.6)' }}>Habitação Própria Permanente abaixo do limiar de isenção. IMT = €0.</div>
              </div>
            </div>
          )}

          {/* Main metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '20px 24px', background: '#0c1f15', color: '#f4f0e6' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(244,240,230,.45)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Total Custos Aquisição</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2rem', fontWeight: 600, color: '#c9a96e', lineHeight: 1 }}>{fmt(r.total)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(244,240,230,.35)', marginTop: '4px' }}>incl. advogado estimado</div>
            </div>
            <div style={{ padding: '20px 24px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.15)' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>IMT + IS</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.8rem', fontWeight: 600, color: '#1c4a35', lineHeight: 1 }}>{fmt(r.imt + r.is)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>Taxa efectiva: {r.taxaEfetiva}</div>
            </div>
            <div style={{ padding: '20px 24px', border: '1px solid rgba(14,14,13,.08)', background: '#fff' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Valor Total c/ Imóvel</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.8rem', fontWeight: 600, color: '#0e0e0d', lineHeight: 1 }}>{fmt(valor + r.total)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>{((r.total / valor) * 100).toFixed(1)}% do valor do imóvel</div>
            </div>
          </div>

          {/* Breakdown table */}
          <div style={{ background: '#fff', border: '1px solid rgba(14,14,13,.08)', marginBottom: '20px' }}>
            <div style={{ padding: '14px 20px', background: 'rgba(14,14,13,.03)', borderBottom: '1px solid rgba(14,14,13,.08)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)' }}>Desdobramento de Custos</div>
            {[
              { label: '🏛 IMT (Imposto Municipal Transacções)', value: r.imt, note: r.isento ? 'Isento HPP' : 'Tabela 2026' },
              { label: '📜 IS (Imposto de Selo 0,8%)', value: r.is, note: 'Sobre o valor do imóvel' },
              { label: '📋 Registo Predial', value: r.registro, note: 'Conservatória do Registo Predial' },
              { label: '⚖ Escritura / Notário', value: r.notario, note: 'Estimativa — varia conforme notário' },
              { label: '👨‍⚖️ Advogado / Solicitador', value: r.advogado, note: '~1% do valor (estimativa)' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(14,14,13,.05)', background: i % 2 === 0 ? '#fff' : 'rgba(14,14,13,.01)' }}>
                <div>
                  <div style={{ fontSize: '.88rem', color: '#0e0e0d', marginBottom: '1px' }}>{row.label}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)' }}>{row.note}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 600, color: row.value === 0 ? '#4a9c7a' : '#0e0e0d' }}>{row.value === 0 ? 'ISENTO' : fmt(row.value)}</div>
                  {row.value > 0 && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.3)' }}>{((row.value / valor) * 100).toFixed(2)}%</div>}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'rgba(28,74,53,.04)', borderTop: '2px solid rgba(28,74,53,.15)' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: '#1c4a35', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>TOTAL CUSTOS</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 700, color: '#1c4a35' }}>{fmt(r.total)}</div>
            </div>
          </div>

          {/* HPP savings */}
          {r.savings > 0 && (
            <div style={{ padding: '14px 20px', background: 'rgba(74,156,122,.06)', border: '1px solid rgba(74,156,122,.2)', borderLeft: '3px solid #4a9c7a', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '.95rem', fontWeight: 600, color: '#1c4a35' }}>Poupança HPP vs Segunda Habitação</div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.55)', marginTop: '2px' }}>Benefício fiscal da habitação própria permanente</div>
              </div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', fontWeight: 700, color: '#1c4a35' }}>{fmt(r.savings)}</div>
            </div>
          )}

          {/* NHR note */}
          <div style={{ padding: '14px 20px', background: 'rgba(201,169,110,.05)', border: '1px solid rgba(201,169,110,.15)', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>💡</span>
            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(14,14,13,.65)', lineHeight: 1.7 }}>
              <strong>Compradores Internacionais:</strong> O regime NHR/IFICI pode isentar rendimentos durante 10 anos. Consulte a secção NHR para simulação. O IMT é sempre aplicável independentemente do estatuto fiscal.
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="p-btn p-btn-gold" style={{ fontSize: '.46rem', padding: '10px 22px' }} onClick={() => {
              const html = `
                <div class="label">Simulação IMT + Custos de Aquisição</div>
                <div class="row">
                  <div class="card"><div class="label">Valor do Imóvel</div><div class="metric">${fmt(valor)}</div></div>
                  <div class="card"><div class="label">Tipo</div><div class="metric" style="font-size:1rem">${imtTipo === 'hpp' ? 'HPP' : imtTipo === 'second' ? '2ª Hab' : 'Invest.'}</div></div>
                  <div class="card"><div class="label">Total Custos</div><div class="metric gold">${fmt(r.total)}</div></div>
                  <div class="card"><div class="label">Taxa Efectiva</div><div class="metric">${r.taxaEfetiva}</div></div>
                </div>
                <hr class="divider">
                <table>
                  <thead><tr><th>Custo</th><th>Valor</th><th>% do Preço</th></tr></thead>
                  <tbody>
                    ${[{ l: 'IMT', v: r.imt }, { l: 'IS (0,8%)', v: r.is }, { l: 'Registo Predial', v: r.registro }, { l: 'Notário', v: r.notario }, { l: 'Advogado (~1%)', v: r.advogado }]
                  .map(row => `<tr><td>${row.l}</td><td><strong>${row.v === 0 ? 'ISENTO' : fmt(row.v)}</strong></td><td>${row.v === 0 ? '—' : ((row.v / valor) * 100).toFixed(2) + '%'}</td></tr>`).join('')}
                    <tr style="background:rgba(28,74,53,.08)"><td><strong>TOTAL</strong></td><td><strong>${fmt(r.total)}</strong></td><td><strong>${((r.total / valor) * 100).toFixed(1)}%</strong></td></tr>
                  </tbody>
                </table>
                ${r.savings > 0 ? `<div style="margin-top:16px;padding:12px 16px;background:rgba(74,156,122,.06);border-left:3px solid #4a9c7a"><strong>Poupança HPP:</strong> ${fmt(r.savings)} em relação a segunda habitação</div>` : ''}
                <div style="margin-top:16px;font-size:.8rem;color:rgba(14,14,13,.45)">Nota: Valores estimados com base nas tabelas IMT 2026. Confirmar com advogado/solicitador antes de assinar CPCV.</div>
              `
              exportToPDF(`Simulação IMT — ${fmt(valor)}`, html)
            }}>⬇ Exportar PDF</button>
            <button className="p-btn" style={{ fontSize: '.46rem', padding: '10px 22px' }} onClick={() => setSection('nhr')}>→ Simular NHR/IFICI</button>
            <button className="p-btn" style={{ fontSize: '.46rem', padding: '10px 22px' }} onClick={() => setSection('credito')}>→ Simular Crédito</button>
          </div>
        </div>
      )}

      {/* Info boxes (shown when no result) */}
      {!r && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginTop: '8px' }}>
          {[
            { icon: '🏠', title: 'Habitação Própria', body: 'Isenção até ~€97K. Taxas reduzidas até €603K. Diferencial significativo vs segunda habitação.' },
            { icon: '🌍', title: 'Compradores Internacionais', body: 'Mesmo IMT independente da residência fiscal. NHR não afecta IMT. IRS sobre mais-valias pode ser diferente.' },
            { icon: '⚠', title: 'Atenção', body: 'Valores estimados. IMT é calculado sobre o VPT (valor patrimonial) se superior ao preço de venda.' },
          ].map(b => (
            <div key={b.icon} style={{ padding: '16px 18px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.07)' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{b.icon}</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '.95rem', fontWeight: 600, color: '#0e0e0d', marginBottom: '6px' }}>{b.title}</div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.55)', lineHeight: 1.6 }}>{b.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
