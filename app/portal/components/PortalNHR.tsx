'use client'
import { useState } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useFinancialStore } from '../stores/financialStore'

interface PortalNHRProps {
  onRunNHR: (overrides?: { pais?: string; tipo?: string; rend?: number; fonte?: boolean }) => Promise<void>
}

const NHR_STEPS = [
  {
    step: 1,
    title: 'Obter NIF em Portugal',
    desc: 'Presencialmente nas Finanças ou via procurador/advogado',
    duration: '1–5 dias',
    docs: ['Passaporte', 'Prova de endereço no país de origem'],
    cost: '€0',
    notes: 'Pode ser feito antes de chegar a Portugal via Consulado Português.',
  },
  {
    step: 2,
    title: 'Estabelecer Residência Fiscal em Portugal',
    desc: 'Arrendar/comprar imóvel e comunicar morada às Finanças',
    duration: '1–4 semanas',
    docs: ['Contrato de arrendamento / escritura', 'NIF activo'],
    cost: '€0',
    notes: 'Deve permanecer mais de 183 dias/ano em Portugal para manter o estatuto.',
  },
  {
    step: 3,
    title: 'Submeter Candidatura NHR / IFICI',
    desc: 'Portal AT (e-fatura) ou via advogado fiscal',
    duration: '1–3 dias',
    docs: ['NIF activo', 'Morada registada nas Finanças'],
    cost: '€0',
    notes: 'Prazo: até 31 de Março do ano seguinte à chegada a Portugal.',
  },
  {
    step: 4,
    title: 'Confirmação e Activação do Regime',
    desc: 'AT confirma o estatuto (pode levar 2–4 semanas)',
    duration: '2–4 semanas',
    docs: ['Comprovativo de submissão'],
    cost: '€0',
    notes: 'Válido por 10 anos consecutivos (NHR clássico) ou 5 anos (IFICI 2024+).',
  },
  {
    step: 5,
    title: 'Declaração de IRS Anual',
    desc: 'Declarar rendimentos sob o regime NHR/IFICI anualmente',
    duration: 'Anual (Março–Junho)',
    docs: ['Recibos de rendimento', 'Documentação de fonte estrangeira'],
    cost: '€50–500 (contabilista)',
    notes: 'Manter documentação de fonte estrangeira por mínimo 10 anos.',
  },
]

const COMPARISON_ROWS = [
  { criteria: 'Duração', nhr: '10 anos', ifici: '5 anos' },
  { criteria: 'Taxa flat emprego/TI', nhr: '20%', ifici: '20% (categorias específicas)' },
  { criteria: 'Pensões', nhr: '10%', ifici: '10%' },
  { criteria: 'Rendimentos estrangeiros', nhr: 'Isenção', ifici: 'Isenção (com condições)' },
  { criteria: 'Mais-Valias', nhr: '28%', ifici: '28%' },
  { criteria: 'Dividendos fonte PT', nhr: '28%', ifici: '28%' },
  { criteria: 'Elegibilidade retroactiva', nhr: 'Sim (até 2023)', ifici: 'Sim (chegada ≥ 2024)' },
]

type StepStatus = 'pendente' | 'em_curso' | 'concluido'

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

  const [stepStatuses, setStepStatuses] = useState<Record<number, StepStatus>>({})
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const PAISES = ['UK', 'US', 'FR', 'DE', 'CH', 'NL', 'BE', 'IT', 'IE', 'CA', 'AU', 'BR', 'AE', 'CN', 'SG']
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

  const col = darkMode ? '#f4f0e6' : '#0e0e0d'
  const cardBg = darkMode ? 'rgba(244,240,230,.03)' : '#fff'
  const borderCol = darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.08)'

  const res = nhrResult as Record<string, unknown> | null
  const impostoNHR = Number(res?.imposto_nhr || 0)
  const impostoGeral = Number(res?.imposto_geral || 0)
  const poupanca = Number(res?.poupanca || 0)
  const taxaEfetiva = res?.taxa_efetiva ? String(res.taxa_efetiva) : '—'
  const regime = res?.regime ? String(res.regime) : 'NHR'
  const tipoLabel = TIPOS.find(t => t.val === nhrTipo)?.label || nhrTipo
  const poupancaPct = impostoGeral > 0 ? Math.round((poupanca / impostoGeral) * 100) : 0

  function toggleStep(step: number) {
    setExpandedStep(prev => prev === step ? null : step)
  }
  function cycleStepStatus(step: number) {
    setStepStatuses(prev => {
      const cur = prev[step] || 'pendente'
      const next: StepStatus = cur === 'pendente' ? 'em_curso' : cur === 'em_curso' ? 'concluido' : 'pendente'
      return { ...prev, [step]: next }
    })
  }

  const STATUS_COLOR: Record<StepStatus, string> = {
    pendente: 'rgba(14,14,13,.2)',
    em_curso: '#c9a96e',
    concluido: '#1c4a35',
  }
  const STATUS_LABEL: Record<StepStatus, string> = {
    pendente: 'PENDENTE',
    em_curso: 'EM CURSO',
    concluido: 'CONCLUÍDO',
  }

  function buildResumo(): string {
    if (!res) return ''
    const rend = Number(nhrRend).toLocaleString('pt-PT')
    return `*NHR / IFICI — Simulação Fiscal*\n\n` +
      `Regime: ${regime}\n` +
      `País de origem: ${nhrPais}\n` +
      `Tipo de rendimento: ${tipoLabel}\n` +
      `Rendimento anual: €${rend}\n` +
      `Fonte estrangeira: ${nhrFonte ? 'Sim' : 'Não'}\n\n` +
      `Imposto NHR/IFICI: €${impostoNHR.toLocaleString('pt-PT')}\n` +
      `Imposto Regime Geral: €${impostoGeral.toLocaleString('pt-PT')}\n` +
      `Poupança Anual: €${poupanca.toLocaleString('pt-PT')} (${poupancaPct}%)\n` +
      `Taxa Efectiva: ${taxaEfetiva}%\n\n` +
      `Simulação gerada pela Agency Group — agencygroup.pt`
  }

  function buildDeepLink(): string {
    const params = new URLSearchParams({
      pais: nhrPais,
      tipo: nhrTipo,
      rend: String(nhrRend),
      fonte: nhrFonte ? '1' : '0',
    })
    return `https://agencygroup.pt/nhr?${params.toString()}`
  }

  function buildEmailTemplate(): string {
    if (!res) return ''
    const rend = Number(nhrRend).toLocaleString('pt-PT')
    return `Assunto: Simulação NHR/IFICI — Análise Fiscal Personalizada\n\n` +
      `Caro/a [Nome],\n\n` +
      `Conforme acordado, partilho a simulação fiscal do regime NHR/IFICI para o seu perfil.\n\n` +
      `RESULTADO DA SIMULAÇÃO\n` +
      `─────────────────────\n` +
      `Regime aplicável: ${regime}\n` +
      `Rendimento anual: €${rend}\n` +
      `Tipo: ${tipoLabel}\n\n` +
      `Imposto sob NHR/IFICI: €${impostoNHR.toLocaleString('pt-PT')}/ano\n` +
      `Imposto regime geral PT: €${impostoGeral.toLocaleString('pt-PT')}/ano\n` +
      `POUPANÇA ANUAL: €${poupanca.toLocaleString('pt-PT')} (${poupancaPct}% de redução fiscal)\n\n` +
      `Este regime é válido por ${regime === 'NHR' ? '10' : '5'} anos consecutivos após aprovação.\n\n` +
      `Para avançar, o próximo passo é obter NIF em Portugal. A Agency Group pode recomendar advogados fiscais especializados.\n\n` +
      `Com os melhores cumprimentos,\n[Nome do Consultor]\nAgency Group · AMI 22506`
  }

  async function copyResumo() {
    try {
      await navigator.clipboard.writeText(buildResumo())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard not available */ }
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Regime Fiscal de Residência</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: col }}>NHR / IFICI Analyser</div>
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

        {/* Results panel */}
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
              <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: `1px solid ${borderCol}` }}>
                {(['elegib', 'processo', 'share'] as const).map(t => (
                  <button key={t} className={`deal-tab${nhrSubTab === t ? ' active' : ''}`} onClick={() => setNhrSubTab(t)}>
                    {t === 'elegib' ? 'Elegibilidade' : t === 'processo' ? 'Processo' : 'Partilhar'}
                  </button>
                ))}
              </div>

              {/* ── ELEGIBILIDADE ── */}
              {nhrSubTab === 'elegib' && (
                <div>
                  {/* Regime badge */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {['NHR', 'IFICI', 'Ambos'].map(b => (
                      <div key={b} style={{
                        padding: '4px 14px',
                        background: regime === b || (b === 'NHR' && regime !== 'IFICI') ? 'rgba(28,74,53,.1)' : 'transparent',
                        border: `1px solid ${regime === b || (b === 'NHR' && regime !== 'IFICI') ? 'rgba(28,74,53,.3)' : 'rgba(14,14,13,.1)'}`,
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.4rem',
                        color: regime === b || (b === 'NHR' && regime !== 'IFICI') ? '#1c4a35' : 'rgba(14,14,13,.3)',
                        letterSpacing: '.06em',
                      }}>
                        {b === 'NHR' ? 'NHR (pré-2024)' : b === 'IFICI' ? 'IFICI 2024+' : 'Ambos aplicáveis'}
                      </div>
                    ))}
                  </div>

                  {/* KPI grid 2×2 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    {[
                      { label: 'Imposto NHR/IFICI', val: `€${impostoNHR.toLocaleString('pt-PT')}`, accent: '#1c4a35' },
                      { label: 'Imposto Regime Geral', val: `€${impostoGeral.toLocaleString('pt-PT')}`, accent: '#6b7280' },
                      { label: 'Poupança Anual', val: `€${poupanca.toLocaleString('pt-PT')}`, accent: '#4a9c7a' },
                      { label: 'Taxa Efectiva', val: `${taxaEfetiva}%`, accent: '#c9a96e' },
                    ].map(({ label, val, accent }) => (
                      <div key={label} style={{ padding: '14px', background: cardBg, border: `1px solid ${borderCol}` }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', marginBottom: '6px' }}>{label.toUpperCase()}</div>
                        <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.5rem', fontWeight: 300, color: accent, lineHeight: 1 }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Savings bar */}
                  {poupancaPct > 0 && (
                    <div style={{ marginBottom: '14px', padding: '12px', background: 'rgba(74,156,122,.04)', border: '1px solid rgba(74,156,122,.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)' }}>POUPANÇA VS REGIME GERAL</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#4a9c7a' }}>{poupancaPct}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(14,14,13,.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(poupancaPct, 100)}%`, background: '#4a9c7a', borderRadius: '3px', transition: 'width .4s ease' }} />
                      </div>
                      <div style={{ marginTop: '6px', fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.4)' }}>
                        Poupa €{poupanca.toLocaleString('pt-PT')} por ano · €{Math.round(poupanca * 10).toLocaleString('pt-PT')} em 10 anos
                      </div>
                    </div>
                  )}

                  {/* Breakdown */}
                  <div style={{ padding: '12px', background: cardBg, border: `1px solid ${borderCol}` }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.06em', marginBottom: '10px' }}>BREAKDOWN POR TIPO</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${borderCol}` }}>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: col }}>{tipoLabel}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: '#1c4a35' }}>€{impostoNHR.toLocaleString('pt-PT')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.4)' }}>Sem NHR/IFICI</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', textDecoration: 'line-through' }}>€{impostoGeral.toLocaleString('pt-PT')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PROCESSO ── */}
              {nhrSubTab === 'processo' && (
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.35)', marginBottom: '16px' }}>
                    Clique num passo para ver detalhes · Clique no estado para actualizar progresso
                  </div>
                  {NHR_STEPS.map((s) => {
                    const status = stepStatuses[s.step] || 'pendente'
                    const isExpanded = expandedStep === s.step
                    return (
                      <div key={s.step} style={{ marginBottom: '8px', position: 'relative', paddingLeft: '40px' }}>
                        {/* Vertical line */}
                        {s.step < NHR_STEPS.length && (
                          <div style={{ position: 'absolute', left: '15px', top: '32px', width: '2px', height: 'calc(100% + 8px)', background: status === 'concluido' ? '#1c4a35' : 'rgba(14,14,13,.1)' }} />
                        )}
                        {/* Step circle */}
                        <div
                          onClick={() => cycleStepStatus(s.step)}
                          style={{
                            position: 'absolute', left: '0', top: '12px',
                            width: '30px', height: '30px', borderRadius: '50%',
                            background: STATUS_COLOR[status],
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background .2s',
                          }}
                          title={`Clique para: ${STATUS_LABEL[status]}`}
                        >
                          {status === 'concluido' ? (
                            <span style={{ color: '#f4f0e6', fontSize: '.6rem', fontWeight: 700 }}>✓</span>
                          ) : (
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: status === 'em_curso' ? '#0e0e0d' : '#f4f0e6', fontWeight: 600 }}>{s.step}</span>
                          )}
                        </div>
                        {/* Step card */}
                        <div style={{ background: cardBg, border: `1px solid ${isExpanded ? 'rgba(28,74,53,.2)' : borderCol}` }}>
                          <div
                            onClick={() => toggleStep(s.step)}
                            style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <div>
                              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.88rem', fontWeight: 500, color: col, marginBottom: '2px' }}>{s.title}</div>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)' }}>{s.duration} · {s.cost}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontFamily: "'DM Mono',monospace", fontSize: '.32rem',
                                color: STATUS_COLOR[status],
                                background: `${STATUS_COLOR[status]}14`,
                                padding: '2px 8px',
                              }}>{STATUS_LABEL[status]}</span>
                              <span style={{ color: 'rgba(14,14,13,.3)', fontSize: '.7rem' }}>{isExpanded ? '▲' : '▼'}</span>
                            </div>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${borderCol}` }}>
                              <div style={{ marginTop: '10px', fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(14,14,13,.6)', marginBottom: '10px' }}>{s.desc}</div>
                              <div style={{ marginBottom: '10px' }}>
                                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.06em', marginBottom: '6px' }}>DOCUMENTOS NECESSÁRIOS</div>
                                {s.docs.map((doc, di) => (
                                  <div key={di} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#1c4a35', flexShrink: 0 }} />
                                    <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: col }}>{doc}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ padding: '8px 10px', background: 'rgba(201,169,110,.05)', border: '1px solid rgba(201,169,110,.15)' }}>
                                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: '#c9a96e', letterSpacing: '.06em', marginBottom: '3px' }}>NOTA</div>
                                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.55)' }}>{s.notes}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── PARTILHAR ── */}
              {nhrSubTab === 'share' && (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {/* Summary preview */}
                  <div style={{ padding: '14px', background: cardBg, border: `1px solid ${borderCol}` }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.06em', marginBottom: '10px' }}>RESUMO DA SIMULAÇÃO</div>
                    <pre style={{
                      fontFamily: "'DM Mono',monospace", fontSize: '.42rem',
                      color: 'rgba(14,14,13,.6)', whiteSpace: 'pre-wrap',
                      lineHeight: 1.7, margin: 0,
                    }}>{buildResumo()}</pre>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      className="p-btn"
                      onClick={copyResumo}
                      style={{ minWidth: '160px' }}
                    >
                      {copied ? '✓ Copiado!' : 'Copiar Resumo'}
                    </button>
                    <button
                      style={{ padding: '8px 18px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.2)', color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer' }}
                      onClick={() => {
                        const w = window.open('', '_blank')
                        if (w) {
                          w.document.write(`<pre style="font-family:monospace;padding:24px;font-size:13px;">${buildResumo()}</pre>`)
                          w.print()
                          w.close()
                        }
                      }}
                    >Exportar PDF</button>
                  </div>

                  {/* Deep link */}
                  <div style={{ padding: '12px 14px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.1)' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.06em', marginBottom: '6px' }}>LINK DE SIMULAÇÃO</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <code style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: '#1c4a35', flex: 1, wordBreak: 'break-all' }}>{buildDeepLink()}</code>
                      <button
                        style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(28,74,53,.2)', color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', cursor: 'pointer', flexShrink: 0 }}
                        onClick={() => navigator.clipboard.writeText(buildDeepLink()).catch(() => {})}
                      >Copiar</button>
                    </div>
                  </div>

                  {/* Email template */}
                  <div style={{ padding: '14px', background: cardBg, border: `1px solid ${borderCol}` }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.06em', marginBottom: '10px' }}>TEMPLATE EMAIL</div>
                    <pre style={{
                      fontFamily: "'DM Mono',monospace", fontSize: '.4rem',
                      color: 'rgba(14,14,13,.55)', whiteSpace: 'pre-wrap',
                      lineHeight: 1.65, margin: '0 0 10px',
                      maxHeight: '220px', overflowY: 'auto',
                    }}>{buildEmailTemplate()}</pre>
                    <button
                      style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(14,14,13,.15)', color: 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer' }}
                      onClick={() => navigator.clipboard.writeText(buildEmailTemplate()).catch(() => {})}
                    >Copiar Email</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* NHR vs IFICI Comparison Table */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '14px' }}>
          Comparação NHR vs IFICI 2024
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Jost',sans-serif" }}>
            <thead>
              <tr>
                {['Critério', 'NHR (pré-2024)', 'IFICI 2024+'].map((h, i) => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: i === 0 ? 'left' : 'center',
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.38rem',
                    letterSpacing: '.08em',
                    color: 'rgba(14,14,13,.4)',
                    background: i === 0 ? 'rgba(14,14,13,.02)' : i === 1 ? 'rgba(28,74,53,.04)' : 'rgba(201,169,110,.04)',
                    borderBottom: `2px solid ${i === 0 ? 'rgba(14,14,13,.06)' : i === 1 ? 'rgba(28,74,53,.15)' : 'rgba(201,169,110,.2)'}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: `1px solid ${borderCol}` }}>
                  <td style={{ padding: '9px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.5)', background: 'rgba(14,14,13,.01)' }}>{row.criteria}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: '.84rem', color: col, fontWeight: 500, background: 'rgba(28,74,53,.02)' }}>{row.nhr}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: '.84rem', color: col, fontWeight: 500, background: 'rgba(201,169,110,.02)' }}>{row.ifici}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
