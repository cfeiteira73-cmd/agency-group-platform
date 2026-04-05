'use client'
import { useUIStore } from '../stores/uiStore'
import { useDealStore } from '../stores/dealStore'
import { useCRMStore } from '../stores/crmStore'
import type { SectionId } from './types'

interface PortalDashboardProps {
  agentName: string
  imoveisList: Record<string, unknown>[]
  weeklyReport: Record<string, unknown> | null
  weeklyReportLoading: boolean
  onWeeklyReport: () => void
  onCloseWeeklyReport: () => void
  exportToPDF: (title: string, html: string) => void
  onSetSection: (s: SectionId) => void
}

export default function PortalDashboard({
  agentName,
  imoveisList,
  weeklyReport,
  weeklyReportLoading,
  onWeeklyReport,
  onCloseWeeklyReport,
  exportToPDF,
  onSetSection,
}: PortalDashboardProps) {
  const { darkMode } = useUIStore()
  const now = new Date()
  const { deals } = useDealStore()
  const { crmContacts } = useCRMStore()

  const pipelineTotal = deals.reduce((s, d) => s + parseFloat(d.valor.replace(/[^0-9.]/g, '')), 0)
  const today = new Date().toISOString().split('T')[0]
  const followUpsHoje = crmContacts.filter(c => c.nextFollowUp && c.nextFollowUp <= today).length
  const leadsAtivos = crmContacts.filter(c => c.status === 'lead' || c.status === 'prospect').length
  const closedDeals = deals.filter(d => d.fase === 'Escritura Concluída')
  const totalComissaoRecebida = closedDeals.reduce((s, d) => {
    const v = parseFloat(d.valor.replace(/[^0-9.]/g, '')) || 0
    return s + v * 0.05
  }, 0)
  void totalComissaoRecebida

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: darkMode ? 'rgba(244,240,230,.3)' : 'rgba(14,14,13,.3)', marginBottom: '8px' }}>
            {now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '2.2rem', color: darkMode ? '#f4f0e6' : '#0e0e0d', lineHeight: 1.05 }}>
            {now.getHours() < 12 ? 'Bom dia' : now.getHours() < 19 ? 'Boa tarde' : 'Boa noite'}, <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>{agentName}</em>.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            style={{ padding: '6px 14px', background: weeklyReport ? 'rgba(201,169,110,.12)' : 'rgba(28,74,53,.06)', border: `1px solid ${weeklyReport ? 'rgba(201,169,110,.3)' : 'rgba(28,74,53,.2)'}`, color: weeklyReport ? '#c9a96e' : '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.08em', cursor: 'pointer', transition: 'all .15s' }}
            disabled={weeklyReportLoading}
            onClick={weeklyReport ? onCloseWeeklyReport : onWeeklyReport}
          >
            {weeklyReportLoading ? '✦ A gerar...' : weeklyReport ? '× Fechar Relatório' : '📋 Relatório Semanal IA'}
          </button>
          <div style={{ background: '#1c4a35', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6fcf97' }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', color: '#f4f0e6', textTransform: 'uppercase' }}>Portal Activo</span>
          </div>
          <div style={{ background: 'rgba(201,169,110,.1)', border: '1px solid rgba(201,169,110,.25)', padding: '6px 14px' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', color: '#c9a96e', textTransform: 'uppercase' }}>AMI 22506</span>
          </div>
        </div>
      </div>

      {/* Weekly Report Panel */}
      {weeklyReport && (
        <div style={{ background: 'linear-gradient(135deg,#0c1f15,#1a3d2a)', padding: '20px 24px', marginBottom: '24px', border: '1px solid rgba(201,169,110,.15)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(201,169,110,.5)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '4px' }}>📋 Relatório Semanal IA — Claude Opus</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: '#f4f0e6', fontWeight: 300 }}>{String(weeklyReport.title)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(244,240,230,.35)', marginTop: '2px' }}>{String(weeklyReport.period)}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={{ padding: '5px 12px', background: 'rgba(244,240,230,.06)', border: '1px solid rgba(244,240,230,.1)', color: 'rgba(244,240,230,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer', letterSpacing: '.06em' }}
                onClick={() => {
                  const html = `
                    <div class="label">${weeklyReport.period}</div>
                    <div style="font-family:var(--font-cormorant),serif;font-size:1.6rem;font-weight:300;margin-bottom:12px">${weeklyReport.title}</div>
                    <div style="padding:14px 18px;background:rgba(28,74,53,.05);border-left:3px solid #1c4a35;margin-bottom:20px;font-family:var(--font-jost),sans-serif;font-size:.85rem;line-height:1.7;color:rgba(14,14,13,.7)">${weeklyReport.executiveSummary}</div>
                  `
                  exportToPDF(String(weeklyReport.title), html)
                }}
              >⬇ PDF</button>
              <button style={{ padding: '5px 12px', background: 'rgba(244,240,230,.06)', border: '1px solid rgba(244,240,230,.1)', color: 'rgba(244,240,230,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer' }} onClick={onCloseWeeklyReport}>× Fechar</button>
            </div>
          </div>
          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.7)', lineHeight: 1.7, marginBottom: '16px', padding: '12px 14px', background: 'rgba(255,255,255,.04)', borderLeft: '3px solid rgba(201,169,110,.4)' }}>{String(weeklyReport.executiveSummary)}</div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Pipeline Total', val: `€${(pipelineTotal / 1e6).toFixed(1)}M`, sub: 'Valor total em negociação', color: '#1c4a35', icon: '📊' },
          { label: 'Deals Ativos', val: String(deals.length), sub: 'Em progresso · ' + deals.filter(d => d.fase === 'CPCV Assinado').length + ' CPCV assinados', color: '#c9a96e', icon: '🏠' },
          { label: 'Comissão Prevista', val: `€${Math.round(pipelineTotal * 0.05 / 1000)}K`, sub: '5% · AMI 22506', color: '#4a9c7a', icon: '💰' },
          { label: 'Leads & Prospects', val: String(leadsAtivos), sub: `${crmContacts.length} contactos no CRM`, color: '#c9a96e', icon: '👥' },
          { label: 'Follow-Up Hoje', val: String(followUpsHoje), sub: followUpsHoje > 0 ? '⚠️ Acção necessária' : '✓ Em dia', color: followUpsHoje > 0 ? '#dc2626' : '#4a9c7a', icon: '📅' },
          { label: 'Mercado 2026', val: '+17,6%', sub: 'INE Q3 2025 · Lisboa Top 5 Mundial', color: '#c9a96e', icon: '📈' },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '1.3rem', lineHeight: 1, flexShrink: 0, marginTop: '2px' }}>{k.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kpi-val" style={{ color: k.color, fontSize: '1.6rem' }}>{k.val}</div>
              <div className="kpi-label" style={{ marginTop: '2px' }}>{k.label}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.3)', marginTop: '3px', letterSpacing: '.06em', lineHeight: 1.4 }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '14px' }}>Acções Rápidas</div>
        <div className="actions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
          {[
            { label: 'CRM Clientes', sub: `${crmContacts.length} contactos · Gestão relacional`, sec: 'crm' as SectionId, color: '#c9a96e', svg: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
            { label: 'Avaliar Imóvel', sub: 'AVM · 6 metodologias RICS', sec: 'avm' as SectionId, color: '#1c4a35', svg: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z' },
            { label: 'Deal Radar', sub: 'Oportunidades com IA em tempo real', sec: 'radar' as SectionId, color: '#c9a96e', svg: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Pipeline CPCV', sub: `${deals.length} deals activos`, sec: 'pipeline' as SectionId, color: '#1c4a35', svg: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
            { label: 'Marketing AI', sub: 'Conteúdo multi-formato e multi-idioma', sec: 'marketing' as SectionId, color: '#c9a96e', svg: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
            { label: 'Consultor Jurídico', sub: 'CPCV, IMT, NHR, Golden Visa', sec: 'juridico' as SectionId, color: '#1c4a35', svg: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
          ].map(a => (
            <div key={a.label} className="action-card" onClick={() => onSetSection(a.sec)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', background: `${a.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="1.5" width="18" height="18"><path d={a.svg} /></svg>
                </div>
                <div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', fontWeight: 500, color: darkMode ? 'rgba(244,240,230,.85)' : '#0e0e0d' }}>{a.label}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.38)', marginTop: '2px', letterSpacing: '.04em' }}>{a.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
