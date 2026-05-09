'use client'
// =============================================================================
// Agency Group — SOP Playbook Viewer
// app/portal/ops/playbooks/page.tsx
// =============================================================================

import { useState } from 'react'

// ─── Static playbook registry ─────────────────────────────────────────────────
// These map to docs/playbooks/*.md — served via /api/portal/playbooks or embedded

interface Playbook {
  id:         string
  number:     number
  title:      string
  emoji:      string
  owner:      string
  sla:        string
  category:   'commercial' | 'operations' | 'management'
  tags:       string[]
  description: string
  path:       string
}

const PLAYBOOKS: Playbook[] = [
  {
    id: 'lead-intake',
    number: 1,
    title: 'Lead Intake & Triagem',
    emoji: '📥',
    owner: 'Todo o agente',
    sla: '< 5 min',
    category: 'commercial',
    tags: ['leads', 'CRM', 'triagem'],
    description: 'Processo de captação, validação e entrada de novos leads no CRM. Critérios de qualidade, duplicados e resposta imediata.',
    path: '/docs/playbooks/01-lead-intake.md',
  },
  {
    id: 'qualification',
    number: 2,
    title: 'Qualificação BANT-RE',
    emoji: '🎯',
    owner: 'Agente responsável',
    sla: '< 24h',
    category: 'commercial',
    tags: ['qualificação', 'BANT', 'scoring'],
    description: 'Framework BANT-RE: Budget, Authority, Need, Timeline, Real Estate specifics. Classificação A/B/C e critérios de desqualificação.',
    path: '/docs/playbooks/02-qualification.md',
  },
  {
    id: 'routing',
    number: 3,
    title: 'Routing & Distribuição',
    emoji: '🔀',
    owner: 'Sistema automático',
    sla: '< 15 min',
    category: 'operations',
    tags: ['routing', 'distribuição', 'automação'],
    description: 'Lógica de routing por zona, língua e workload. Regras de atribuição, re-atribuição e escalamento automático.',
    path: '/docs/playbooks/03-routing.md',
  },
  {
    id: 'follow-up',
    number: 4,
    title: 'Follow-up Cadences',
    emoji: '📞',
    owner: 'Agente responsável',
    sla: 'Ver tabela',
    category: 'commercial',
    tags: ['follow-up', 'CRM', 'WhatsApp', 'GDPR'],
    description: 'Cadências de follow-up por status: lead (D1/D3/D7/D14), qualified (D2/D5/D10), active, pós-proposta. Templates WhatsApp e email.',
    path: '/docs/playbooks/04-follow-up.md',
  },
  {
    id: 'listing-acquisition',
    number: 5,
    title: 'Captação de Imóveis',
    emoji: '🏡',
    owner: 'Agente listagem',
    sla: '5 fases',
    category: 'commercial',
    tags: ['captação', 'AVM', 'mandato', 'seller'],
    description: '5 fases: qualificação do vendedor → AVM/CMA → negociação do mandato → preparação da listagem → estratégia de preço.',
    path: '/docs/playbooks/05-listing-acquisition.md',
  },
  {
    id: 'buyer-journey',
    number: 6,
    title: 'Jornada do Comprador',
    emoji: '🛒',
    owner: 'Agente comprador',
    sla: '8 etapas',
    category: 'commercial',
    tags: ['buyer', 'jornada', 'internacional', 'KYC'],
    description: 'As 8 etapas da jornada do comprador. Especificidades por nacionalidade (EUA, FR, UK, CN, BR). Pipeline multi-imóvel e KPIs.',
    path: '/docs/playbooks/06-buyer-journey.md',
  },
  {
    id: 'seller-journey',
    number: 7,
    title: 'Jornada do Vendedor',
    emoji: '🏠',
    owner: 'Agente listagem',
    sla: '8 etapas',
    category: 'commercial',
    tags: ['seller', 'vendor-report', 'DOM', 'open house'],
    description: '8 etapas desde onboarding até pós-venda. Template de vendor report semanal. Thresholds DOM e protocolo de redução de preço.',
    path: '/docs/playbooks/07-seller-journey.md',
  },
  {
    id: 'negotiation',
    number: 8,
    title: 'Negociação',
    emoji: '🤝',
    owner: 'Agente sénior',
    sla: 'Por spread',
    category: 'commercial',
    tags: ['negociação', 'contra-proposta', 'comissão', 'multi-offer'],
    description: 'Framework de contra-proposta por % de spread. Sequência de resolução de impasse. Scripts de defesa de comissão. Multi-offer.',
    path: '/docs/playbooks/08-negotiation.md',
  },
  {
    id: 'contract-legal',
    number: 9,
    title: 'Contracto & Legal',
    emoji: '⚖️',
    owner: 'Agente + Jurídico',
    sla: 'Ver etapas',
    category: 'operations',
    tags: ['CPCV', 'escritura', 'IMT', 'KYC', 'AML'],
    description: 'Checklists de documentação (comprador + vendedor). Passos CPCV/Escritura. Referência fiscal IMT/IS/mais-valias. Problemas legais comuns.',
    path: '/docs/playbooks/09-contract-legal.md',
  },
  {
    id: 'pipeline',
    number: 10,
    title: 'Pipeline & Forecast',
    emoji: '📊',
    owner: 'Todo o agente',
    sla: 'Semanal',
    category: 'commercial',
    tags: ['pipeline', 'stages', 'forecast', 'hygiene'],
    description: '11 stages com probabilidades. Fórmula EV. Protocolo de higiene semanal. Categorias Commit/Best Case/Pipeline. Taxonomia de razões de perda.',
    path: '/docs/playbooks/10-pipeline.md',
  },
  {
    id: 'escalation',
    number: 11,
    title: 'Escalamento',
    emoji: '🚨',
    owner: 'Agente + Broker',
    sla: 'L1–L4',
    category: 'operations',
    tags: ['escalamento', 'stall', 'CPCV', 'emergência'],
    description: 'Tiers L1–L4. Tabela de diagnóstico de stall. Protocolo de emergência CPCV. Critérios de activação por tier.',
    path: '/docs/playbooks/11-escalation.md',
  },
  {
    id: 'incidents',
    number: 12,
    title: 'Gestão de Incidentes',
    emoji: '🔴',
    owner: 'Broker / Admin',
    sla: 'P0–P3',
    category: 'operations',
    tags: ['incidentes', 'P0', 'APEMIP', 'RGPD', 'breach'],
    description: 'Matriz P0–P3. 5 playbooks específicos: incumprimento CPCV, plataforma em baixo, queixa APEMIP, breach de dados, erro de agente.',
    path: '/docs/playbooks/12-incidents.md',
  },
  {
    id: 'management-cadence',
    number: 13,
    title: 'Management Cadence',
    emoji: '📅',
    owner: 'Broker / Gestor',
    sla: 'Ver cadências',
    category: 'management',
    tags: ['cadência', 'reuniões', 'KPIs', 'QBR'],
    description: 'Cadência Seg/Qua/Sex. Revisão mensal 90min. QBR trimestral. Planeamento anual. 9 KPIs alvo com targets.',
    path: '/docs/playbooks/management-cadence.md',
  },
  {
    id: 'escalation-matrix',
    number: 14,
    title: 'Matriz de Escalamento',
    emoji: '📋',
    owner: 'Toda a equipa',
    sla: 'Sempre activo',
    category: 'management',
    tags: ['contactos', 'escalamento', 'APEMIP', 'reguladores'],
    description: 'Directório de contactos completo. Regras de auto-escalamento. Paths de escalamento por categoria. Contactos de reguladores externos.',
    path: '/docs/playbooks/escalation-matrix.md',
  },
]

const CATEGORIES = {
  commercial: { label: 'Comercial', color: '#c9a96e', emoji: '💰' },
  operations: { label: 'Operacional', color: '#52b788', emoji: '⚙️' },
  management: { label: 'Gestão', color: '#7c8cf8', emoji: '📋' },
} as const

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlaybooksPage() {
  const [filter, setFilter] = useState<'all' | 'commercial' | 'operations' | 'management'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Playbook | null>(null)

  const filtered = PLAYBOOKS.filter(p => {
    if (filter !== 'all' && p.category !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return p.title.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)) || p.description.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#e8e0d0', fontFamily: 'system-ui, sans-serif', padding: '24px 20px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#c9a96e', margin: 0 }}>SOPs & Playbooks</h1>
        <p style={{ color: '#888', margin: '4px 0 16px', fontSize: 14 }}>
          {PLAYBOOKS.length} procedimentos operacionais · Versão 1.0 · Actualizado Maio 2026
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {Object.entries(CATEGORIES).map(([key, cat]) => {
            const count = PLAYBOOKS.filter(p => p.category === key).length
            return (
              <div key={key} style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13,
                backgroundColor: cat.color + '15', border: `1px solid ${cat.color}33`, color: cat.color,
              }}>
                {cat.emoji} {cat.label} <strong>({count})</strong>
              </div>
            )
          })}
        </div>

        {/* Filter + search */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['all', '🗂️ Todos'], ['commercial', '💰 Comercial'], ['operations', '⚙️ Operacional'], ['management', '📋 Gestão']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: filter === id ? 700 : 400,
                backgroundColor: filter === id ? '#c9a96e22' : 'transparent',
                border: `1px solid ${filter === id ? '#c9a96e' : '#333'}`,
                color: filter === id ? '#c9a96e' : '#666',
              }}>{label}</button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Pesquisar playbook..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, outline: 'none',
              backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#e8e0d0',
              width: 220,
            }}
          />
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {filtered.map(pb => {
          const cat = CATEGORIES[pb.category]
          const isOpen = selected?.id === pb.id
          return (
            <div key={pb.id}
              onClick={() => setSelected(isOpen ? null : pb)}
              style={{
                backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20,
                border: `1px solid ${isOpen ? cat.color : '#2a2a2a'}`,
                cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: isOpen ? `0 0 0 1px ${cat.color}44` : 'none',
              }}>

              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 24 }}>{pb.emoji}</span>
                  <div>
                    <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>SOP #{pb.number.toString().padStart(2, '0')}</div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', margin: 0, lineHeight: 1.3 }}>{pb.title}</h3>
                  </div>
                </div>
                <span style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 700,
                  backgroundColor: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}44`,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>{cat.emoji} {cat.label}</span>
              </div>

              {/* Description */}
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5 }}>{pb.description}</p>

              {/* Meta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#555' }}>👤 {pb.owner}</span>
                  <span style={{ fontSize: 11, color: '#555' }}>·</span>
                  <span style={{ fontSize: 11, color: cat.color }}>⏱ {pb.sla}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {pb.tags.slice(0, 2).map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: '#2a2a2a', color: '#555' }}>#{t}</span>
                  ))}
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${cat.color}33` }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {pb.tags.map(t => (
                      <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, backgroundColor: cat.color + '15', color: cat.color }}>#{t}</span>
                    ))}
                  </div>
                  <a
                    href={pb.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      backgroundColor: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}44`,
                      textDecoration: 'none',
                    }}
                  >
                    📖 Abrir Playbook completo
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div>Nenhum playbook encontrado para &ldquo;{search}&rdquo;</div>
        </div>
      )}

      {/* Footer note */}
      <div style={{ marginTop: 40, padding: '16px 20px', backgroundColor: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', fontSize: 12, color: '#666' }}>
        💡 Os SOPs estão em <code style={{ color: '#c9a96e' }}>docs/playbooks/</code> no repositório.
        Para sugerir melhorias, submete um pull request ou contacta o Broker.
      </div>
    </div>
  )
}
