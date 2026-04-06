'use client'
import { useUIStore } from '../stores/uiStore'
import { useFinancialStore } from '../stores/financialStore'

// ─── API response types ───────────────────────────────────────────────────────

interface MortgageResultado {
  prestacao_mensal: number
  tan_pct: number
  taeg_pct: number
  total_capital: number
  total_juros: number
  total_pago: number
  custo_total_aquisicao: number
  imt_estimado: number
  is_estimado: number
  imi_anual: number
  deducao_irs_ano1: number
  euribor_6m_pct: number
}

interface MortgageCenario {
  label: string
  tan_pct: number
  pmt: number
}

interface MortgageTabelaRow {
  ano: number
  prestacao_anual: number
  juros: number
  amortizacao: number
  saldo: number
  capital_pago_acum: number
}

interface MortgageAcessibilidade {
  dsti_pct: number
  dsti_ok: boolean
  nota: string
  rendimento_anual: number
  irs_estimado_sem_ded: number | null
  irs_estimado_com_ded: number | null
  poupanca_irs_anual: number
}

interface MortgageInputs {
  montante: number
  entrada: number
  capital: number
  ltv_pct: number
  prazo_anos: number
  spread_pct: number
  tan_pct: number
  uso: string
}

interface MortgageResult {
  success: boolean
  inputs: MortgageInputs
  resultado: MortgageResultado
  cenarios: MortgageCenario[]
  tabela_amortizacao: MortgageTabelaRow[]
  acessibilidade: MortgageAcessibilidade | null
  info: { nota_legal: string; intermediario: string; euribor_fonte: string }
}

interface PortalMortgageProps {
  onRunMort: (overrides?: { montante?: number; entrada?: number; prazo?: number; spread?: number; uso?: string; rendimento?: number }) => Promise<void>
}

const fmt = (n: number) => `€${Math.round(n).toLocaleString('pt-PT')}`

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalMortgage({ onRunMort }: PortalMortgageProps) {
  const { darkMode } = useUIStore()
  const {
    mortResult, mortLoading,
    mortSpreadVal, setMortSpreadVal,
    mortMontante, setMortMontante,
    mortEntrada, setMortEntrada,
    mortPrazo, setMortPrazo,
    mortUso, setMortUso,
    mortRendimento, setMortRendimento,
    mortSubTab, setMortSubTab,
  } = useFinancialStore()

  const r = mortResult as MortgageResult | null

  const PERSONAS = [
    { label: 'Comprador HPP', montante: 400000, entrada: 20, prazo: 35, spread: 0.9, uso: 'habitacao_propria' },
    { label: 'Investidor Premium', montante: 1200000, entrada: 30, prazo: 25, spread: 1.2, uso: 'investimento', rendimento: 60000 },
    { label: 'Estrangeiro NHR', montante: 800000, entrada: 40, prazo: 20, spread: 1.5, uso: 'habitacao_propria' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Simulação de Financiamento</div>
        <div style={{ fontFamily: 'var(--font-cormorant),serif', fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Simulador Crédito Habitação</div>
        <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginTop: '4px' }}>
          Euribor 6M live · TAEG Newton-Raphson · 4 cenários stress-test · Tabela amortização 30 anos · DSTI Banco de Portugal
        </div>
      </div>

      {/* Persona presets */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {PERSONAS.map(p => (
          <button type="button" key={p.label}
            style={{ padding: '6px 14px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.15)', color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer', transition: 'all .2s', borderRadius: '6px' }}
            onClick={() => onRunMort(p)}
          >{p.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '24px' }}>

        {/* ── Form ── */}
        <div className="p-card">
          <div style={{ display: 'grid', gap: '16px' }}>

            <div>
              <label className="p-label">Valor do Imóvel (€)</label>
              <input className="p-inp" type="number" placeholder="ex: 500000" value={mortMontante} onChange={e => setMortMontante(e.target.value)} />
            </div>

            <div>
              <label className="p-label">Entrada — {mortEntrada}%
                {mortMontante && Number(mortMontante) > 0 && (
                  <span style={{ color: '#c9a96e', marginLeft: '8px' }}>{fmt(Number(mortMontante) * mortEntrada / 100)}</span>
                )}
              </label>
              <input type="range" min={10} max={80} value={mortEntrada} onChange={e => setMortEntrada(Number(e.target.value))} style={{ width: '100%', accentColor: '#1c4a35' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>
                <span>10% HPP min</span><span>80%</span>
              </div>
            </div>

            <div>
              <label className="p-label">Prazo — {mortPrazo} anos</label>
              <input type="range" min={5} max={40} value={mortPrazo} onChange={e => setMortPrazo(Number(e.target.value))} style={{ width: '100%', accentColor: '#1c4a35' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>
                <span>5 anos</span><span>40 anos</span>
              </div>
            </div>

            <div>
              <label className="p-label">Spread — {mortSpreadVal.toFixed(2)}%</label>
              <input type="range" min={0.5} max={3} step={0.05} value={mortSpreadVal} onChange={e => setMortSpreadVal(Number(e.target.value))} style={{ width: '100%', accentColor: '#1c4a35' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>
                <span>0.50% excelente</span><span>3.00% alto</span>
              </div>
            </div>

            <div>
              <label className="p-label">Finalidade</label>
              <select className="p-sel" value={mortUso} onChange={e => setMortUso(e.target.value as 'habitacao_propria' | 'investimento')}>
                <option value="habitacao_propria">Habitação Própria Permanente</option>
                <option value="investimento">Investimento / Segunda Habitação</option>
              </select>
            </div>

            <div>
              <label className="p-label">Rendimento Anual Bruto (€) — DSTI</label>
              <input className="p-inp" type="number" placeholder="ex: 80000 — opcional" value={mortRendimento} onChange={e => setMortRendimento(e.target.value)} />
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>Necessário para calcular DSTI e dedução IRS</div>
            </div>

            <button type="button" className="p-btn p-btn-gold" style={{ padding: '13px 24px', fontSize: '.5rem', letterSpacing: '.1em' }} onClick={() => onRunMort()} disabled={mortLoading || !mortMontante}>
              {mortLoading ? '✦ A simular...' : '✦ Simular Crédito'}
            </button>

          </div>
        </div>

        {/* ── Results ── */}
        <div>
          {!r && !mortLoading && (
            <div style={{ background: '#0c1f15', padding: '36px 32px', position: 'relative', overflow: 'hidden', minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'radial-gradient(circle,rgba(201,169,110,.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: '-30px', left: '-20px', width: '160px', height: '160px', background: 'radial-gradient(circle,rgba(28,74,53,.3) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '14px' }}>O QUE VAI DESCOBRIR</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: '#f4f0e6', lineHeight: 1.15, marginBottom: '8px' }}>
                  A simulação mais<br /><em style={{ fontStyle: 'italic', color: '#c9a96e' }}>completa de Portugal</em>
                </div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(244,240,230,.35)', lineHeight: 1.7, marginBottom: '24px' }}>
                  Euribor 6M live · TAEG Newton-Raphson · 3 personas · Cenários stress-test · Amortização 30 anos
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
                {[
                  { icon: '📊', label: 'Prestação Mensal', sub: 'TAN + TAEG exacto' },
                  { icon: '🏛', label: 'IMT + IS + IMI', sub: 'Custo total aquisição' },
                  { icon: '📈', label: '4 Cenários Euribor', sub: 'Bear · Base · Bull · Min' },
                  { icon: '📋', label: 'Amortização', sub: 'Tabela anual 30 anos' },
                ].map(f => (
                  <div key={f.label} style={{ padding: '12px 14px', background: 'rgba(244,240,230,.04)', border: '1px solid rgba(244,240,230,.08)' }}>
                    <div style={{ fontSize: '.9rem', marginBottom: '4px' }}>{f.icon}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.65)', letterSpacing: '.04em', marginBottom: '2px' }}>{f.label}</div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.7rem', color: 'rgba(244,240,230,.28)' }}>{f.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 13px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.12)' }}>
                <span style={{ fontSize: '.95rem', flexShrink: 0 }}>✦</span>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.74rem', color: 'rgba(244,240,230,.38)', lineHeight: 1.5 }}>
                  Com rendimento anual: <strong style={{ color: 'rgba(201,169,110,.65)' }}>DSTI</strong> Banco de Portugal + dedução IRS habitação própria
                </div>
              </div>
            </div>
          )}

          {mortLoading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#1c4a35', letterSpacing: '.2em' }}>✦ A simular...</div>
            </div>
          )}

          {r && r.resultado && (
            <div>
              {/* ── Main metric ── */}
              <div style={{ padding: '24px 28px', background: '#0c1f15', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>Prestação Mensal</div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2rem', fontWeight: 600, color: '#c9a96e', lineHeight: 1 }}>{fmt(r.resultado.prestacao_mensal)}</div>
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>TAN</div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.8rem', fontWeight: 600, color: '#f4f0e6', lineHeight: 1 }}>{r.resultado.tan_pct}%</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.3)', marginTop: '3px' }}>Euribor 6M {r.resultado.euribor_6m_pct}%</div>
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>TAEG</div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.8rem', fontWeight: 600, color: '#f4f0e6', lineHeight: 1 }}>{r.resultado.taeg_pct}%</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.3)', marginTop: '3px' }}>Newton-Raphson</div>
                </div>
              </div>

              {/* ── Quick metrics row ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '16px' }}>
                {[
                  { l: 'Capital', v: r.inputs.capital },
                  { l: 'Total Juros', v: r.resultado.total_juros },
                  { l: 'Total Pago', v: r.resultado.total_pago },
                  { l: 'IMT + IS', v: r.resultado.imt_estimado + r.resultado.is_estimado },
                  { l: 'IMI / Ano', v: r.resultado.imi_anual },
                  { l: 'Custo Total', v: r.resultado.custo_total_aquisicao, gold: true },
                ].map(m => (
                  <div key={m.l} className="p-card" style={{ padding: '12px 14px', textAlign: 'center', borderRadius: '10px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{m.l}</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 600, color: m.gold ? '#c9a96e' : '#0e0e0d' }}>{fmt(m.v)}</div>
                  </div>
                ))}
              </div>

              {/* ── DSTI ── */}
              {r.acessibilidade && (
                <div style={{ padding: '12px 16px', background: r.acessibilidade.dsti_ok ? 'rgba(28,74,53,.06)' : 'rgba(220,38,38,.05)', border: `1px solid ${r.acessibilidade.dsti_ok ? 'rgba(28,74,53,.2)' : 'rgba(220,38,38,.2)'}`, borderLeft: `3px solid ${r.acessibilidade.dsti_ok ? '#1c4a35' : '#dc2626'}`, marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: r.acessibilidade.dsti_ok ? '#1c4a35' : '#dc2626', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                      DSTI {r.acessibilidade.dsti_pct}% {r.acessibilidade.dsti_ok ? '✓' : '⚠'}
                    </div>
                    {r.acessibilidade.poupanca_irs_anual > 0 && (
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35' }}>
                        Dedução IRS: {fmt(r.acessibilidade.poupanca_irs_anual)}/ano
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.55)', marginTop: '4px', lineHeight: 1.5 }}>{r.acessibilidade.nota}</div>
                </div>
              )}

              {/* ── Sub-tabs ── */}
              <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid rgba(14,14,13,.1)' }}>
                {(['cenarios', 'amortizacao', 'share'] as const).map(t => (
                  <button type="button" key={t} className={`deal-tab${mortSubTab === t ? ' active' : ''}`} onClick={() => setMortSubTab(t)}>
                    {t === 'cenarios' ? 'Cenários Euribor' : t === 'amortizacao' ? 'Amortização' : 'Partilhar'}
                  </button>
                ))}
              </div>

              {/* ── TAB: Cenários ── */}
              {mortSubTab === 'cenarios' && (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {(r.cenarios || []).map((c, i) => (
                    <div key={i} className="p-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)', transition: 'all .2s' }}>
                      <div>
                        <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.84rem', color: '#0e0e0d', marginBottom: '2px' }}>{c.label}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)' }}>TAN {c.tan_pct}%</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 600, color: i === 0 ? '#c9a96e' : i === 1 ? '#dc2626' : '#1c4a35' }}>{fmt(c.pmt)}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)' }}>/mês</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── TAB: Amortização ── */}
              {mortSubTab === 'amortizacao' && r.tabela_amortizacao && (
                <div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Jost',sans-serif", fontSize: '.78rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(28,74,53,.06)' }}>
                          {['Ano', 'Prestação', 'Juros', 'Amortização', 'Saldo'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 400, borderBottom: '1px solid rgba(14,14,13,.08)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.tabela_amortizacao.map((row, i) => (
                          <tr key={row.ano} style={{ background: i % 2 === 0 ? '#fff' : 'rgba(14,14,13,.01)', borderBottom: '1px solid rgba(14,14,13,.04)' }}>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)' }}>{row.ano}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', color: '#0e0e0d' }}>{fmt(row.prestacao_anual)}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', color: '#dc2626' }}>{fmt(row.juros)}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', color: '#1c4a35' }}>{fmt(row.amortizacao)}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', color: '#0e0e0d', fontWeight: 600 }}>{fmt(row.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── TAB: Partilhar ── */}
              {mortSubTab === 'share' && (
                <div className="p-card" style={{ padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 600, color: '#0e0e0d', marginBottom: '12px' }}>Resumo para Partilhar</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', lineHeight: 1.8, background: 'rgba(14,14,13,.02)', padding: '16px', border: '1px solid rgba(14,14,13,.08)', whiteSpace: 'pre-wrap', userSelect: 'all' }}>
                    {`Simulação Crédito Habitação — Agency Group\n` +
                     `─────────────────────────────────\n` +
                     `Imóvel:            ${fmt(r.inputs.montante)}\n` +
                     `Capital:           ${fmt(r.inputs.capital)} (${r.inputs.ltv_pct}% LTV)\n` +
                     `Prazo:             ${r.inputs.prazo_anos} anos\n` +
                     `TAN / TAEG:        ${r.resultado.tan_pct}% / ${r.resultado.taeg_pct}%\n` +
                     `Prestação Mensal:  ${fmt(r.resultado.prestacao_mensal)}\n` +
                     `─────────────────────────────────\n` +
                     `IMT + IS:          ${fmt(r.resultado.imt_estimado + r.resultado.is_estimado)}\n` +
                     `Custo Total:       ${fmt(r.resultado.custo_total_aquisicao)}\n` +
                     `─────────────────────────────────\n` +
                     `${r.info?.intermediario || 'Agency Group · AMI 22506'}\n` +
                     `${r.info?.nota_legal || ''}`}
                  </div>
                  <button type="button" className="p-btn p-btn-gold" style={{ marginTop: '12px', fontSize: '.52rem', padding: '8px 18px', borderRadius: '6px', transition: 'all .2s' }}
                    onClick={() => {
                      const text = `Simulação Crédito — ${fmt(r.inputs.montante)} | Prestação: ${fmt(r.resultado.prestacao_mensal)}/mês | TAN ${r.resultado.tan_pct}% | Custo Total: ${fmt(r.resultado.custo_total_aquisicao)} | Agency Group AMI 22506`
                      navigator.clipboard.writeText(text).catch(() => {})
                    }}>
                    ⎘ Copiar resumo
                  </button>
                </div>
              )}

              {/* Nota legal */}
              <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.06)', fontFamily: "'Jost',sans-serif", fontSize: '.72rem', color: 'rgba(14,14,13,.35)', lineHeight: 1.6 }}>
                {r.info?.nota_legal}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
