'use client'
import { useState } from 'react'
import { useUIStore } from '../stores/uiStore'
import { DOC_LIBRARY } from './constants'

type DocItem = { name: string; desc: string; badge?: string; url?: string }
type DocCat = { category: string; docs: DocItem[] }

// ─── Checklists de documentos por fase de negócio ────────────────────────────

const DEAL_CHECKLISTS: Record<string, { label: string; docs: { name: string; required: boolean; desc: string }[] }> = {
  'Angariação / Captação': {
    label: '🏠 Angariação',
    docs: [
      { name: 'Certidão Predial Permanente', required: true, desc: 'Registo predial actualizado (máx. 6 meses)' },
      { name: 'Caderneta Predial', required: true, desc: 'AT — para VPT e IMI actualizado' },
      { name: 'Planta do Imóvel', required: true, desc: 'Planta aprovada pela câmara municipal' },
      { name: 'Licença de Habitação / Utilização', required: true, desc: 'Obrigatório para fracções autónomas' },
      { name: 'Ficha Técnica de Habitação', required: false, desc: 'Para imóveis pós-2004' },
      { name: 'Documentos de Identidade do Proprietário', required: true, desc: 'CC + NIF do vendedor' },
      { name: 'Procuração (se representado)', required: false, desc: 'Se assinado por terceiro' },
      { name: 'CMI / Condomínio — declaração sem dívidas', required: false, desc: 'Regularidade perante condomínio' },
    ]
  },
  'Due Diligence': {
    label: '🔍 Due Diligence',
    docs: [
      { name: 'Certidão Predial Permanente', required: true, desc: 'Confirmar ónus, hipotecas, penhoras' },
      { name: 'Relatório de Avaliação (AVM)', required: false, desc: 'Avaliação independente para financiamento' },
      { name: 'Licença de Construção (se obra)', required: true, desc: 'Para imóveis em construção ou renovados' },
      { name: 'Planta Aprovada', required: true, desc: 'Verificar conformidade com implantação real' },
      { name: 'Declaração de Não Dívidas AT', required: true, desc: 'IMI e outros impostos' },
      { name: 'Certificado Energético', required: true, desc: 'Obrigatório para compra/venda — A a F' },
      { name: 'Seguro Multirriscos (AL)', required: false, desc: 'Se imóvel em Alojamento Local' },
      { name: 'Título de Propriedade anterior', required: false, desc: 'Histórico de titulares' },
    ]
  },
  'CPCV': {
    label: '📋 CPCV',
    docs: [
      { name: 'Minutas de CPCV', required: true, desc: 'Redigido por advogado ou solicitador' },
      { name: 'Documentos de Identidade — Comprador', required: true, desc: 'CC/Passaporte + NIF do comprador' },
      { name: 'Documentos de Identidade — Vendedor', required: true, desc: 'CC + NIF do vendedor' },
      { name: 'Certidão Predial Permanente Actualizada', required: true, desc: 'Data ≤ 30 dias da assinatura' },
      { name: 'Comprovativo de Pagamento de Sinal', required: true, desc: 'Transferência bancária (nunca numerário)' },
      { name: 'Promessa de Financiamento (se aplicável)', required: false, desc: 'Carta de conforto do banco' },
      { name: 'NIF de Não-Residente (se necessário)', required: false, desc: 'Obtido nas Finanças ou por procurador' },
    ]
  },
  'Escritura': {
    label: '✍️ Escritura',
    docs: [
      { name: 'IMT — Guia de Pagamento', required: true, desc: 'Liquidado antes da escritura (DUC)' },
      { name: 'Imposto de Selo — Guia', required: true, desc: '0.8% do valor escriturado' },
      { name: 'Certidão Predial Permanente', required: true, desc: 'Válida no dia da escritura' },
      { name: 'Caderneta Predial Actualizada', required: true, desc: 'Para cálculo de IMT e IS' },
      { name: 'Licença de Utilização', required: true, desc: 'Original ou certidão' },
      { name: 'Ficha Técnica de Habitação', required: false, desc: 'Para imóveis pós-2004' },
      { name: 'Certificado Energético', required: true, desc: 'Número CE obrigatório no acto notarial' },
      { name: 'Distrate de Hipoteca (se existir)', required: false, desc: 'Cancelamento de hipoteca do vendedor' },
      { name: 'Declaração Notarial (se empresa)', required: false, desc: 'Certidão comercial + acta de deliberação' },
      { name: 'Comprovativo de Residência do Comprador', required: false, desc: 'Para AIMI e IMI futuro' },
    ]
  },
  'Golden Visa / ARI': {
    label: '🌍 Golden Visa',
    docs: [
      { name: 'Passaporte válido', required: true, desc: 'Validade ≥ 12 meses além do prazo pretendido' },
      { name: 'NIF Português', required: true, desc: 'Obtido no Consulado ou Finanças' },
      { name: 'Declaração Financeira — Capital', required: true, desc: 'Prova de transferência de €500K+ para PT' },
      { name: 'Certidão de Registo Criminal', required: true, desc: 'País de origem + PT (apostilada)' },
      { name: 'Certidão de Casamento / Estado Civil', required: false, desc: 'Para extensão ARI a dependentes' },
      { name: 'Proof of Lawful Residence', required: false, desc: 'Para dependentes incluídos no pedido' },
      { name: 'Comprovativo de Actividade Profissional', required: true, desc: 'Ou declaração de rendimentos' },
      { name: 'Formulário ARI (SEF/AIMA)', required: true, desc: 'Preenchido e submetido via plataforma' },
    ]
  },
}

// ─── Templates prontos ────────────────────────────────────────────────────────

const TEMPLATES = [
  { name: 'Minuta CPCV Standard', desc: 'Contrato Promessa Compra e Venda — clausulado completo 2026', badge: 'CPCV', color: '#c9a96e', icon: '📋' },
  { name: 'Carta de Conforto (Banco)', desc: 'Template de carta de pré-aprovação de crédito habitação', badge: 'CRÉDITO', color: '#3b82f6', icon: '🏦' },
  { name: 'Proposta de Compra Formal', desc: 'Proposta de compra com condições suspensivas e prazo de resposta', badge: 'PROPOSTA', color: '#1c4a35', icon: '📝' },
  { name: 'Declaração de Procurador', desc: 'Declaração para representação em escritura notarial', badge: 'LEGAL', color: '#7c3aed', icon: '⚖️' },
  { name: 'Ficha de Identificação do Imóvel', desc: 'Ficha com todos os dados do imóvel para prospecto de venda', badge: 'MKTG', color: '#1c4a35', icon: '🏠' },
  { name: 'Relatório de Due Diligence', desc: 'Checklist e relatório de due diligence para imóvel premium', badge: 'DD', color: '#e05252', icon: '🔍' },
  { name: 'Contrato de Mediação Imobiliária', desc: 'Contrato de angariação em exclusividade — AMI 22506', badge: 'MEDIAÇÃO', color: '#c9a96e', icon: '🤝' },
  { name: 'Declaração de Arrendamento', desc: 'Declaração para fins fiscais de arrendamento urbano', badge: 'AL/ARR.', color: '#4a9c7a', icon: '📄' },
]

export default function PortalDocumentos() {
  const { darkMode } = useUIStore()
  const [docSearch, setDocSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'biblioteca' | 'checklists' | 'templates'>('biblioteca')
  const [activeChecklist, setActiveChecklist] = useState<string>('Angariação / Captação')
  const [checkedDocs, setCheckedDocs] = useState<Record<string, Record<string, boolean>>>({})
  const [expandedCat, setExpandedCat] = useState<Record<string, boolean>>({})

  const filteredDocs = (DOC_LIBRARY as unknown as DocCat[]).map((cat) => ({
    ...cat,
    docs: docSearch.trim()
      ? cat.docs.filter(doc =>
          doc.name.toLowerCase().includes(docSearch.toLowerCase()) ||
          doc.desc.toLowerCase().includes(docSearch.toLowerCase())
        )
      : cat.docs,
  })).filter(cat => cat.docs.length > 0)

  const toggleDoc = (phase: string, docName: string) => {
    setCheckedDocs(prev => ({
      ...prev,
      [phase]: { ...(prev[phase] || {}), [docName]: !(prev[phase]?.[docName]) }
    }))
  }

  const phaseProgress = (phase: string) => {
    const docs = DEAL_CHECKLISTS[phase]?.docs || []
    const required = docs.filter(d => d.required)
    const checked = required.filter(d => checkedDocs[phase]?.[d.name]).length
    return { total: required.length, done: checked, pct: required.length > 0 ? Math.round(checked / required.length * 100) : 0 }
  }

  return (
    <div style={{ maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Gestão Documental</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Documentação & <em style={{ color: '#1c4a35' }}>Templates</em></div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>Biblioteca legal · Checklists por fase · Templates PT 2026</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '24px' }}>
        {([
          { id: 'biblioteca', label: '📚 Biblioteca Legal' },
          { id: 'checklists', label: '✅ Checklists por Fase' },
          { id: 'templates', label: '📄 Templates Prontos' },
        ] as const).map(t => (
          <button key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? '#1c4a35' : 'transparent'}`, color: activeTab === t.id ? '#1c4a35' : 'rgba(14,14,13,.45)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.08em', cursor: 'pointer', transition: 'all .15s', marginBottom: '-1px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Biblioteca ── */}
      {activeTab === 'biblioteca' && (
        <div>
          <input
            className="p-inp"
            style={{ marginBottom: '20px' }}
            placeholder="Pesquisar documentos, contratos, checklists, artigos de lei..."
            value={docSearch}
            onChange={e => setDocSearch(e.target.value)}
          />

          {/* Stats row */}
          {!docSearch && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {(DOC_LIBRARY as unknown as DocCat[]).map(cat => (
                <div key={cat.category} style={{ padding: '6px 14px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.1)' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#1c4a35', letterSpacing: '.06em' }}>
                    {cat.category.split(' ')[0]} <strong>{cat.docs.length}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}

          {filteredDocs.map((cat) => {
            const isExpanded = expandedCat[cat.category] !== false  // default expanded
            return (
              <div key={cat.category} style={{ marginBottom: '20px', border: '1px solid rgba(14,14,13,.08)' }}>
                {/* Category header */}
                <div
                  onClick={() => setExpandedCat(prev => ({ ...prev, [cat.category]: !isExpanded }))}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(14,14,13,.02)', cursor: 'pointer', borderBottom: isExpanded ? '1px solid rgba(14,14,13,.08)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#1c4a35' }}>
                      {cat.category}
                    </div>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', background: 'rgba(14,14,13,.06)', padding: '2px 8px', borderRadius: '10px' }}>
                      {cat.docs.length} docs
                    </span>
                  </div>
                  <span style={{ color: 'rgba(14,14,13,.3)', fontSize: '.75rem' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div>
                    {cat.docs.map((doc) => (
                      <div key={doc.name} className="doc-item" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(14,14,13,.05)', gap: '12px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1c4a35', flexShrink: 0, opacity: 0.5 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', fontWeight: 500, color: '#0e0e0d', marginBottom: '2px' }}>{doc.name}</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)' }}>{doc.desc}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                          {doc.badge && (
                            <span style={{ padding: '2px 8px', background: 'rgba(28,74,53,.08)', color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.34rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                              {doc.badge}
                            </span>
                          )}
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              style={{ padding: '5px 14px', background: '#1c4a35', color: '#f4f0e6', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.1em', textDecoration: 'none', textTransform: 'uppercase' }}>
                              Ver →
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {filteredDocs.length === 0 && docSearch && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(14,14,13,.4)', fontFamily: "'Cormorant',serif", fontSize: '1.1rem' }}>
              Nenhum documento encontrado para &ldquo;{docSearch}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Checklists ── */}
      {activeTab === 'checklists' && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Phase selector */}
          <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '8px' }}>Fase do Negócio</div>
            {Object.entries(DEAL_CHECKLISTS).map(([phase]) => {
              const prog = phaseProgress(phase)
              const isActive = activeChecklist === phase
              return (
                <div key={phase}
                  onClick={() => setActiveChecklist(phase)}
                  style={{ padding: '10px 12px', background: isActive ? '#1c4a35' : 'rgba(14,14,13,.02)', border: `1px solid ${isActive ? '#1c4a35' : 'rgba(14,14,13,.08)'}`, cursor: 'pointer', transition: 'all .15s' }}>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', fontWeight: 500, color: isActive ? '#f4f0e6' : '#0e0e0d', marginBottom: '4px' }}>
                    {DEAL_CHECKLISTS[phase].label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '3px', background: isActive ? 'rgba(255,255,255,.2)' : 'rgba(14,14,13,.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${prog.pct}%`, background: isActive ? '#c9a96e' : '#1c4a35', transition: 'width .3s' }} />
                    </div>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: isActive ? 'rgba(244,240,230,.6)' : 'rgba(14,14,13,.35)', whiteSpace: 'nowrap' }}>{prog.done}/{prog.total}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Checklist detail */}
          <div style={{ flex: 1, minWidth: '280px' }}>
            {activeChecklist && DEAL_CHECKLISTS[activeChecklist] && (() => {
              const prog = phaseProgress(activeChecklist)
              const docs = DEAL_CHECKLISTS[activeChecklist].docs
              return (
                <div className="p-card">
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', color: '#0e0e0d', fontWeight: 300 }}>
                        {DEAL_CHECKLISTS[activeChecklist].label}
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: prog.pct === 100 ? '#22c55e' : '#1c4a35' }}>
                        {prog.pct}% completo
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: '4px', background: 'rgba(14,14,13,.08)', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
                      <div style={{ height: '100%', width: `${prog.pct}%`, background: prog.pct === 100 ? '#22c55e' : '#1c4a35', transition: 'width .4s' }} />
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)' }}>
                      {prog.done} de {prog.total} documentos obrigatórios · {docs.filter(d => !d.required).length} opcionais
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {docs.map(doc => {
                      const checked = checkedDocs[activeChecklist]?.[doc.name] || false
                      return (
                        <div key={doc.name}
                          onClick={() => toggleDoc(activeChecklist, doc.name)}
                          style={{ display: 'flex', gap: '12px', padding: '10px 12px', background: checked ? 'rgba(28,74,53,.04)' : 'transparent', border: `1px solid ${checked ? 'rgba(28,74,53,.15)' : 'rgba(14,14,13,.06)'}`, cursor: 'pointer', transition: 'all .15s', marginBottom: '4px' }}>
                          <div style={{ width: '18px', height: '18px', border: `2px solid ${checked ? '#1c4a35' : 'rgba(14,14,13,.2)'}`, background: checked ? '#1c4a35' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                            {checked && <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" width="9" height="9"><path d="M2 6l3 3 5-5" /></svg>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', fontWeight: checked ? 400 : 500, color: checked ? 'rgba(14,14,13,.4)' : '#0e0e0d', textDecoration: checked ? 'line-through' : 'none' }}>
                                {doc.name}
                              </span>
                              {doc.required && !checked && (
                                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.3rem', color: '#e05252', background: 'rgba(224,82,82,.08)', padding: '1px 5px', letterSpacing: '.06em' }}>OBRIGATÓRIO</span>
                              )}
                              {!doc.required && (
                                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.3rem', color: 'rgba(14,14,13,.3)', background: 'rgba(14,14,13,.04)', padding: '1px 5px', letterSpacing: '.06em' }}>OPCIONAL</span>
                              )}
                            </div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)' }}>{doc.desc}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {prog.pct === 100 && (
                    <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>✅</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: '#22c55e', letterSpacing: '.08em' }}>FASE DOCUMENTALMENTE COMPLETA</span>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Tab: Templates ── */}
      {activeTab === 'templates' && (
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.35)', marginBottom: '20px', padding: '10px 14px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.15)', letterSpacing: '.04em' }}>
            ⚠️ Templates de referência para uso interno. Recomendamos sempre revisão por advogado ou solicitador para qualquer documento com eficácia legal.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {TEMPLATES.map(t => (
              <div key={t.name} className="p-card" style={{ padding: '16px', cursor: 'pointer', transition: 'all .2s', borderLeft: `3px solid ${t.color}` }}
                onClick={() => {
                  // In a real app, this would download or open the template
                  alert(`Template "${t.name}" — em breve disponível para download`)
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>{t.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', fontWeight: 600, color: '#0e0e0d' }}>{t.name}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: t.color, background: `${t.color}14`, padding: '2px 7px', letterSpacing: '.06em', textTransform: 'uppercase' }}>{t.badge}</span>
                    </div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.75rem', color: 'rgba(14,14,13,.5)', lineHeight: 1.5 }}>{t.desc}</div>
                    <div style={{ marginTop: '10px', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: t.color, letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      DESCARREGAR TEMPLATE
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick reference */}
          <div style={{ marginTop: '28px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '14px' }}>Referência Rápida — Prazos e Custos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {[
                { label: 'IMT', val: '0% — 7.5%', sub: 'Escala progressiva por valor' },
                { label: 'Imposto de Selo', val: '0.8%', sub: 'Sobre valor escriturado' },
                { label: 'Registo Predial', val: '€250 — €700', sub: 'Aquisição + hipoteca' },
                { label: 'Notário', val: '€500 — €1.500', sub: 'Depende do valor' },
                { label: 'CPCV Sinal', val: '10% — 30%', sub: 'Do preço acordado' },
                { label: 'Prazo Médio CPCV→Escritura', val: '60 — 90 dias', sub: 'Com financiamento' },
                { label: 'Golden Visa Mín.', val: '€500.000', sub: 'Imóvel comercial/reabilitação' },
                { label: 'NHR / IFICI', val: '10% — 20%', sub: 'Taxa flat sobre rendimentos elegíveis' },
              ].map(r => (
                <div key={r.label} style={{ padding: '10px 14px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.07)' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>{r.label}</div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: '#1c4a35', fontWeight: 600 }}>{r.val}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.35)', marginTop: '2px' }}>{r.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
