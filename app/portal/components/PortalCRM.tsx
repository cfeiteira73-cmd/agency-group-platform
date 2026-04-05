'use client'
import { useState, useEffect, useRef } from 'react'
import { computeLeadScore, calcLeadScore, getAINextAction, exportCrmCSV } from './utils'
import { useCRMStore } from '../stores/crmStore'
import { useDealStore } from '../stores/dealStore'
import { useUIStore } from '../stores/uiStore'
import type { CRMContact, Activity, Task } from './types'
import { PORTAL_PROPERTIES } from './constants'

const WA_TEMPLATES: Record<string, Record<string, { label: string; msg: string }>> = {
  PT: {
    inicial:   { label: 'Contacto Inicial', msg: 'Olá {name}! Sou {agent} da Agency Group (AMI 22506). Vi o seu interesse em imóveis em Portugal. Posso partilhar opções dentro do seu orçamento? 🏡' },
    followup:  { label: 'Follow-up', msg: 'Olá {name}! Queria saber se já teve oportunidade de pensar nas opções que partilhei. Tenho novos imóveis exclusivos que podem ser exactamente o que procura.' },
    proposta:  { label: 'Proposta Formal', msg: 'Olá {name}! Conforme combinado, segue a proposta formal para {property}. Por favor reveja e qualquer questão estou disponível. Agency Group.' },
    visita:    { label: 'Confirmação Visita', msg: 'Olá {name}! Confirmamos a visita a {property} para {date}. Aguardamos a sua presença! Agency Group · AMI 22506' },
    cpcv:      { label: 'CPCV Pronto', msg: 'Olá {name}! A documentação do CPCV está pronta para revisão. Quando podemos agendar a assinatura? 📋' },
    pos_venda: { label: 'Pós-Venda', msg: 'Olá {name}! Espero que esteja a adorar o novo imóvel! Se precisar de qualquer apoio — remodelação, decoração ou gestão — conte connosco. Agency Group.' },
  },
  EN: {
    inicial:   { label: 'Initial Contact', msg: "Hello {name}! I'm {agent} from Agency Group (AMI 22506). I see you're interested in Portuguese real estate. May I share curated options within your budget? 🏡" },
    followup:  { label: 'Follow-up', msg: "Hello {name}! Just following up on the properties I shared earlier. I have exciting new exclusive listings that might be perfect for you." },
    proposta:  { label: 'Formal Proposal', msg: "Hello {name}! As discussed, please find attached the formal proposal for {property}. I'm available for any questions. Agency Group." },
    visita:    { label: 'Visit Confirmation', msg: 'Hello {name}! Confirming your property visit at {property} on {date}. Looking forward to meeting you! Agency Group · AMI 22506' },
    cpcv:      { label: 'CPCV Ready', msg: 'Hello {name}! The CPCV documentation is ready for review. When can we schedule the signing? 📋' },
    pos_venda: { label: 'Post-Sale', msg: "Hello {name}! Hope you're loving your new property! If you need any support — renovation, interior design or management — we're here. Agency Group." },
  },
  FR: {
    inicial:   { label: 'Premier Contact', msg: "Bonjour {name}! Je suis {agent} d'Agency Group (AMI 22506). Je vois votre intérêt pour l'immobilier portugais. Puis-je partager des options dans votre budget? 🏡" },
    followup:  { label: 'Relance', msg: "Bonjour {name}! Je vous relance concernant les propriétés partagées. J'ai de nouvelles opportunités exclusives qui pourraient vous intéresser." },
    proposta:  { label: 'Proposition Formelle', msg: 'Bonjour {name}! Comme convenu, veuillez trouver ci-joint la proposition formelle pour {property}. Je reste disponible. Agency Group.' },
    visita:    { label: 'Confirmation Visite', msg: 'Bonjour {name}! Confirmation de votre visite à {property} le {date}. Agency Group vous attend! AMI 22506' },
    cpcv:      { label: 'CPCV Prêt', msg: 'Bonjour {name}! La documentation CPCV est prête pour révision. Quand pouvons-nous planifier la signature? 📋' },
    pos_venda: { label: 'Après-Vente', msg: 'Bonjour {name}! Espero que esteja a adorar o novo imóvel! Pour tout besoin — rénovation, décoration ou gestion — nous sommes là. Agency Group.' },
  },
  DE: {
    inicial:   { label: 'Erstkontakt', msg: 'Hallo {name}! Ich bin {agent} von Agency Group (AMI 22506). Ich sehe Ihr Interesse an Immobilien in Portugal. Darf ich passende Optionen teilen? 🏡' },
    followup:  { label: 'Nachfassung', msg: 'Hallo {name}! Ich möchte bezüglich der geteilten Immobilien nachfassen. Ich habe neue exklusive Angebote, die perfekt für Sie sein könnten.' },
    proposta:  { label: 'Formelles Angebot', msg: 'Hallo {name}! Wie besprochen, finden Sie anbei das formelle Angebot für {property}. Bei Fragen stehe ich gerne zur Verfügung. Agency Group.' },
    visita:    { label: 'Besichtigungstermin', msg: 'Hallo {name}! Bestätigung Ihres Besichtigungstermins bei {property} am {date}. Wir freuen uns auf Sie! Agency Group · AMI 22506' },
    cpcv:      { label: 'CPCV Bereit', msg: 'Hallo {name}! Die CPCV-Dokumentation ist zur Überprüfung bereit. Wann können wir die Unterzeichnung planen? 📋' },
    pos_venda: { label: 'Nach dem Kauf', msg: 'Hallo {name}! Ich hoffe, Sie genießen Ihre neue Immobilie! Für Renovierung, Einrichtung oder Verwaltung — wir sind für Sie da. Agency Group.' },
  },
  AR: {
    inicial:   { label: 'التواصل الأولي', msg: 'مرحباً {name}! أنا {agent} من Agency Group (AMI 22506). أرى اهتمامك بالعقارات البرتغالية. هل يمكنني مشاركة خيارات ضمن ميزانيتك؟ 🏡' },
    followup:  { label: 'المتابعة', msg: 'مرحباً {name}! أتابع معك بخصوص العقارات التي شاركتها. لدي عقارات حصرية جديدة قد تكون مثالية لك.' },
    proposta:  { label: 'العرض الرسمي', msg: 'مرحباً {name}! كما اتفقنا، يرجى مراجعة العرض الرسمي للعقار {property}. أنا هنا لأي استفسار. Agency Group.' },
    visita:    { label: 'تأكيد الزيارة', msg: 'مرحباً {name}! تأكيد زيارتك لعقار {property} في {date}. نتطلع لرؤيتك! Agency Group · AMI 22506' },
    cpcv:      { label: 'CPCV جاهز', msg: 'مرحباً {name}! وثائق CPCV جاهزة للمراجعة. متى يمكننا جدولة التوقيع؟ 📋' },
    pos_venda: { label: 'ما بعد البيع', msg: 'مرحباً {name}! أتمنى أنك تستمتع بعقارك الجديد! لأي دعم — تجديد، ديكور أو إدارة — نحن هنا. Agency Group.' },
  },
}

const STATUS_CONFIG = {
  lead:     { label: 'Lead',     bg: 'rgba(136,136,136,.12)', color: '#888',     avatar: 'rgba(136,136,136,.15)' },
  prospect: { label: 'Prospect', bg: 'rgba(58,123,213,.1)',   color: '#3a7bd5',  avatar: 'rgba(58,123,213,.12)' },
  cliente:  { label: 'Cliente',  bg: 'rgba(74,156,122,.1)',   color: '#4a9c7a',  avatar: 'rgba(74,156,122,.12)' },
  vip:      { label: 'VIP',      bg: 'rgba(201,169,110,.12)', color: '#c9a96e',  avatar: 'rgba(201,169,110,.15)' },
}

function ScoreCircle({ score, budgetLabel, engagementLabel, breakdown }: {
  score: number
  budgetLabel?: string
  engagementLabel?: string
  breakdown?: Array<{ factor: string; pts: number; max?: number }>
}) {
  const color = score > 70 ? '#22c55e' : score > 40 ? '#c9a96e' : '#e05252'
  const r = 12
  const circumference = 2 * Math.PI * r
  const [animDash, setAnimDash] = useState(0)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const target = (score / 100) * circumference
    const timer = setTimeout(() => setAnimDash(target), 50)
    return () => clearTimeout(timer)
  }, [score, circumference])

  const tooltip = [
    `Score: ${score}`,
    budgetLabel ? `Budget: ${budgetLabel}` : '',
    engagementLabel ? `Engagement: ${engagementLabel}` : '',
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <svg width="32" height="32" viewBox="0 0 32 32" aria-label={tooltip} style={{ cursor: 'default' }}>
        <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(14,14,13,.08)" strokeWidth="2.5" />
        <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={`${animDash} ${circumference - animDash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 800ms cubic-bezier(.4,0,.2,1)' }} />
        <text x="16" y="20" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill={color}>{score}</text>
      </svg>
      {hovered && breakdown && breakdown.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '36px', right: 0,
          background: '#0e0e0d', border: '1px solid rgba(255,255,255,.1)',
          padding: '10px 12px', zIndex: 300, minWidth: '200px',
          boxShadow: '0 8px 24px rgba(0,0,0,.3)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: color, marginBottom: '8px', letterSpacing: '.1em' }}>
            SCORE {score}/100
          </div>
          {breakdown.map((b, i) => {
            const max = b.max || 30
            const filled = Math.round((b.pts / max) * 8)
            const bar = '█'.repeat(filled) + '░'.repeat(8 - filled)
            return (
              <div key={i} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(244,240,230,.6)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ color: 'rgba(244,240,230,.4)', minWidth: '80px' }}>{b.factor}</span>
                <span style={{ color: b.pts >= max * 0.7 ? '#4a9c7a' : b.pts >= max * 0.4 ? '#c9a96e' : 'rgba(244,240,230,.3)' }}>{bar}</span>
                <span style={{ color: 'rgba(244,240,230,.5)' }}>{b.pts}/{max}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TemperatureBadge({ score, lastContactDays }: { score: number; lastContactDays: number | null }) {
  const days = lastContactDays ?? 999
  const heat = score > 75 && days < 7 ? 'hot' : score > 45 && days < 21 ? 'warm' : 'cold'
  const config = {
    hot:  { icon: '🔥', label: 'Hot',  color: '#e05252', bg: 'rgba(224,82,82,.08)' },
    warm: { icon: '🌡️', label: 'Warm', color: '#c9a96e', bg: 'rgba(201,169,110,.08)' },
    cold: { icon: '❄️', label: 'Cold', color: '#6b9fb8', bg: 'rgba(107,159,184,.08)' },
  }[heat]
  return (
    <span title={`Temperatura: ${config.label} · Score ${score} · ${days === 999 ? 'sem contacto' : `${days}d desde contacto`}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '1px 5px', background: config.bg, fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: config.color, cursor: 'default' }}>
      {config.icon}
    </span>
  )
}

// ─── Enhanced WA Modal ────────────────────────────────────────────────────────

type WaLangKey = 'PT' | 'EN' | 'FR' | 'DE' | 'AR'

function WAModal({
  wc,
  waLang,
  setWaLang,
  templates,
  agentName,
  onClose,
}: {
  wc: CRMContact | null
  waLang: WaLangKey
  setWaLang: (l: WaLangKey) => void
  templates: Record<string, { label: string; msg: string }>
  agentName: string
  onClose: () => void
}) {
  const WA_CHAR_LIMIT = 1024
  const quickTemplateKeys = ['seguimento', 'nova_prop', 'convite_visita', 'followup', 'proposta', 'visita']
  // Pick 3 most relevant templates for the selected language
  const templateEntries = Object.entries(templates).slice(0, 6)
  const [selectedKey, setSelectedKey] = useState(templateEntries[0]?.[0] || '')
  const [customMsg, setCustomMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const selectedTmpl = templates[selectedKey]
  const baseMsg = selectedTmpl
    ? selectedTmpl.msg
        .replace('{name}', wc ? wc.name.split(' ')[0] : '{name}')
        .replace('{agent}', agentName)
        .replace('{property}', wc?.dealRef || '[imóvel]')
        .replace('{date}', '[data]')
    : ''
  const finalMsg = customMsg || baseMsg
  const charCount = finalMsg.length
  const charColor = charCount > WA_CHAR_LIMIT ? '#e05252' : charCount > 800 ? '#c9a96e' : 'rgba(14,14,13,.35)'

  // Quick 3 templates
  const quickTemplates = [
    { key: 'followup', label: 'Seguimento', tmpl: templates['followup'] },
    { key: 'proposta', label: 'Nova Propriedade', tmpl: templates['proposta'] },
    { key: 'visita', label: 'Convite Visita', tmpl: templates['visita'] },
  ].filter(t => !!t.tmpl)

  void quickTemplateKeys

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#f4f0e6', maxWidth: '600px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(14,14,13,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.3rem', color: '#0e0e0d' }}>
            📱 WhatsApp{wc ? <em style={{ color: '#1c4a35' }}> — {wc.name}</em> : ''}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'rgba(14,14,13,.4)' }}>×</button>
        </div>

        <div style={{ padding: '18px 24px' }}>
          {/* Language selector */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {(['PT', 'EN', 'FR', 'DE', 'AR'] as const).map(l => (
              <button key={l} onClick={() => setWaLang(l)}
                style={{ padding: '5px 12px', background: waLang === l ? '#1c4a35' : 'transparent', color: waLang === l ? '#f4f0e6' : 'rgba(14,14,13,.5)', border: '1px solid rgba(14,14,13,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', cursor: 'pointer' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Quick template selector — 3 templates */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '8px' }}>
              Template Rápido
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(quickTemplates.length > 0 ? quickTemplates : templateEntries.slice(0, 3).map(([k, t]) => ({ key: k, label: t.label, tmpl: t }))).map(item => (
                <button key={item.key}
                  onClick={() => { setSelectedKey(item.key); setCustomMsg('') }}
                  style={{ padding: '6px 14px', background: selectedKey === item.key ? '#1c4a35' : 'rgba(14,14,13,.04)', color: selectedKey === item.key ? '#c9a96e' : 'rgba(14,14,13,.6)', border: `1px solid ${selectedKey === item.key ? '#1c4a35' : 'rgba(14,14,13,.12)'}`, fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer', letterSpacing: '.06em' }}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* All templates list */}
          <div style={{ borderTop: '1px solid rgba(14,14,13,.06)', paddingTop: '14px', marginBottom: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '8px' }}>Todos os Templates</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {templateEntries.map(([k, t]) => (
                <button key={k}
                  onClick={() => { setSelectedKey(k); setCustomMsg('') }}
                  style={{ padding: '3px 8px', background: selectedKey === k ? 'rgba(201,169,110,.15)' : 'transparent', color: selectedKey === k ? '#c9a96e' : 'rgba(14,14,13,.4)', border: `1px solid ${selectedKey === k ? 'rgba(201,169,110,.3)' : 'rgba(14,14,13,.08)'}`, fontFamily: "'DM Mono',monospace", fontSize: '.36rem', cursor: 'pointer' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview + edit */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Preview &amp; Editar</span>
              <span style={{ color: charColor, fontSize: '.36rem' }}>{charCount}/{WA_CHAR_LIMIT}</span>
            </div>
            <textarea
              rows={5}
              value={customMsg || baseMsg}
              onChange={e => setCustomMsg(e.target.value)}
              style={{ width: '100%', border: `1px solid ${charCount > WA_CHAR_LIMIT ? '#e05252' : 'rgba(14,14,13,.12)'}`, background: '#fff', fontFamily: "'Jost',sans-serif", fontSize: '.84rem', padding: '10px 12px', resize: 'vertical', outline: 'none', color: '#0e0e0d', lineHeight: 1.6, boxSizing: 'border-box' }}
            />
            {charCount > WA_CHAR_LIMIT && (
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: '#e05252', marginTop: '4px' }}>Mensagem excede o limite de {WA_CHAR_LIMIT} caracteres</div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => { navigator.clipboard.writeText(finalMsg); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              style={{ padding: '8px 16px', background: 'rgba(14,14,13,.06)', border: '1px solid rgba(14,14,13,.12)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', cursor: 'pointer', color: copied ? '#4a9c7a' : 'rgba(14,14,13,.6)' }}>
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
            {!!wc && !!wc.phone && (
              <button
                disabled={charCount > WA_CHAR_LIMIT}
                onClick={() => window.open(`https://wa.me/${wc.phone.replace(/\D/g, '')}?text=${encodeURIComponent(finalMsg)}`, '_blank')}
                style={{ padding: '8px 18px', background: '#25D366', color: '#fff', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', cursor: charCount > WA_CHAR_LIMIT ? 'not-allowed' : 'pointer', opacity: charCount > WA_CHAR_LIMIT ? 0.5 : 1 }}>
                Enviar via WA Web ↗
              </button>
            )}
            <button onClick={onClose}
              style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(14,14,13,.12)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', cursor: 'pointer', color: 'rgba(14,14,13,.4)', marginLeft: 'auto' }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PortalCRM() {
  const {
    crmContacts, setCrmContacts,
    crmSearch, setCrmSearch,
    activeCrmId, setActiveCrmId,
    crmProfileTab, setCrmProfileTab,
    crmBulkMode, setCrmBulkMode,
    crmSelectedIds, setCrmSelectedIds,
    crmView, setCrmView,
    crmShowFilters, setCrmShowFilters,
    crmNatFilter, setCrmNatFilter,
    crmZonaFilter, setCrmZonaFilter,
    crmStatusFilter, setCrmStatusFilter,
    showNewContact, setShowNewContact,
    showWaModal, setShowWaModal,
    waModalContact, setWaModalContact,
    waLang, setWaLang,
    showAddActivity, setShowAddActivity,
    newActivity, setNewActivity,
    showAddTask, setShowAddTask,
    newTask, setNewTask,
    voiceActive, setVoiceActive,
    voiceText, setVoiceText,
    smartImportText, setSmartImportText,
    smartImportLoading, setSmartImportLoading,
    showSmartImport, setShowSmartImport,
    newContact, setNewContact,
    crmNextStep, setCrmNextStep,
    crmNextStepLoading, setCrmNextStepLoading,
    meetingPrepLoading, setMeetingPrepLoading,
    meetingPrep, setMeetingPrep,
    emailDraftLoading, setEmailDraftLoading,
    emailDraft, setEmailDraft,
    emailDraftPurpose, setEmailDraftPurpose,
  } = useCRMStore()

  const deals = useDealStore(s => s.deals)
  const setSection = useUIStore(s => s.setSection)

  const [agentName, setAgentName] = useState('Agente')
  const [agentEmail, setAgentEmail] = useState('')
  const [quickFilter, setQuickFilter] = useState<string>('todos')
  const [sortBy, setSortBy] = useState<'score' | 'actividade' | 'nome' | 'budget'>('score')
  const [showStatsPanel, setShowStatsPanel] = useState(false)
  const [quickNoteId, setQuickNoteId] = useState<number | null>(null)
  const [quickNoteText, setQuickNoteText] = useState('')
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false)
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false)
  // Import CSV
  const [showImportCSV, setShowImportCSV] = useState(false)
  const [csvImportResult, setCsvImportResult] = useState<string>('')
  // Budget range filter (in €M)
  const [budgetFilterMin, setBudgetFilterMin] = useState(0)
  const [budgetFilterMax, setBudgetFilterMax] = useState(10)
  // Quick action modals
  const [quickCallId, setQuickCallId] = useState<number | null>(null)
  const [quickEmailId, setQuickEmailId] = useState<number | null>(null)
  // Live data
  const [isLoading, setIsLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'live' | 'demo'>('demo')
  // Bulk email campaign modal
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [campaignTemplate, setCampaignTemplate] = useState('followup')
  const [campaignSent, setCampaignSent] = useState(false)
  // Enriquecer
  const [enrichLoading, setEnrichLoading] = useState<number | null>(null)
  const [enrichToast, setEnrichToast] = useState<string | null>(null)
  const enrichToastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadContacts() {
      try {
        const res = await fetch('/api/crm?limit=50')
        if (res.ok) {
          const { data } = await res.json()
          if (!cancelled && data && data.length > 0) {
            setCrmContacts(data)
            setDataSource('live')
          }
        }
      } catch { /* use mock data */ }
      finally { if (!cancelled) setIsLoading(false) }
    }
    loadContacts()
    return () => { cancelled = true }
  }, [setCrmContacts])

  useEffect(() => {
    try {
      const auth = JSON.parse(localStorage.getItem('ag_auth') || '{}')
      if (auth.email) {
        setAgentEmail(auth.email)
        setAgentName(auth.email.split('@')[0].replace(/\./g,' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))
        // Load persisted contacts only if not already loaded from API
        if (dataSource === 'demo') {
          const stored = localStorage.getItem(`ag_crm_${auth.email}`)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed) && parsed.length > 0) setCrmContacts(parsed)
          }
        }
      }
    } catch { /* ignore */ }
  }, [setCrmContacts, dataSource])

  function saveCrmContacts(updated: CRMContact[]) {
    setCrmContacts(updated)
    if (agentEmail) localStorage.setItem(`ag_crm_${agentEmail}`, JSON.stringify(updated))
  }

  const filtered = crmContacts.filter(c => {
    const q = crmSearch.toLowerCase()
    const searchMatch = !crmSearch || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.nationality.toLowerCase().includes(q) || c.status === q
    const natMatch = !crmNatFilter || c.nationality.toLowerCase().includes(crmNatFilter.toLowerCase())
    const zonaMatch = !crmZonaFilter || c.zonas.some(z => z.toLowerCase().includes(crmZonaFilter.toLowerCase()))
    const statusMatch = !crmStatusFilter || c.status === crmStatusFilter
    // Budget slider filter (0 = off, only apply if user moved sliders from defaults)
    const budgetMatch = (budgetFilterMin === 0 && budgetFilterMax === 10)
      ? true
      : (Number(c.budgetMax) / 1e6) >= budgetFilterMin && (Number(c.budgetMin) / 1e6) <= budgetFilterMax
    // Quick filter logic
    const todayStr = new Date().toISOString().split('T')[0]
    const dSinceContact = c.lastContact ? Math.floor((Date.now() - new Date(c.lastContact).getTime()) / 86400000) : null
    const qfMatch = quickFilter === 'todos' ? true
      : quickFilter === 'lead' ? c.status === 'lead'
      : quickFilter === 'prospect' ? c.status === 'prospect'
      : quickFilter === 'cliente' ? c.status === 'cliente'
      : quickFilter === 'vip' ? c.status === 'vip'
      : quickFilter === 'followup' ? (!!c.nextFollowUp && c.nextFollowUp <= todayStr)
      : quickFilter === 'sem_contacto' ? (dSinceContact !== null && dSinceContact >= 14)
      : true
    return searchMatch && natMatch && zonaMatch && statusMatch && qfMatch && budgetMatch
  }).sort((a, b) => {
    if (sortBy === 'score') return computeLeadScore(b).score - computeLeadScore(a).score
    if (sortBy === 'actividade') {
      const da = a.lastContact ? new Date(a.lastContact).getTime() : 0
      const db = b.lastContact ? new Date(b.lastContact).getTime() : 0
      return db - da
    }
    if (sortBy === 'nome') return a.name.localeCompare(b.name)
    if (sortBy === 'budget') return (Number(b.budgetMax) || 0) - (Number(a.budgetMax) || 0)
    return 0
  })

  const activeContact = activeCrmId ? crmContacts.find(c => c.id === activeCrmId) : null
  const vipCount = crmContacts.filter(c => c.status === 'vip').length
  const clienteCount = crmContacts.filter(c => c.status === 'cliente').length
  const totalBudget = crmContacts.reduce((s, c) => s + (Number(c.budgetMax) || 0), 0)
  const today = new Date().toISOString().split('T')[0]
  const followUps = crmContacts.filter(c => c.nextFollowUp && c.nextFollowUp <= today).length

  return (
    <div style={{ maxWidth: '1200px' }}>
      <style>{`
        .crm-contact-row{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(14,14,13,.06);transition:background .15s}
        .crm-contact-row:hover{background:rgba(28,74,53,.04)}
        .crm-contact-row.active{background:rgba(201,169,110,.08);border-left:3px solid #c9a96e}
        .crm-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:.56rem;font-weight:400;flex-shrink:0;letter-spacing:.04em}
        .crm-status{display:inline-flex;align-items:center;padding:2px 8px;font-family:'DM Mono',monospace;font-size:.42rem;letter-spacing:.1em;text-transform:uppercase}
        .crm-stat-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:16px 20px;flex:1}
        .crm-profile-tab{padding:8px 16px;font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:rgba(14,14,13,.4);transition:all .2s;white-space:nowrap}
        .crm-profile-tab.active{color:#1c4a35;border-bottom-color:#1c4a35}
        @media(max-width:768px){.crm-layout{flex-direction:column!important}.crm-list{width:100%!important;min-width:unset!important;border-right:none!important;border-bottom:1px solid rgba(14,14,13,.08)!important}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '6px' }}>Gestão de Clientes · World-Class Real Estate CRM</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: '#0e0e0d' }}>CRM <em style={{ color: '#1c4a35' }}>Clientes</em></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid rgba(14,14,13,.12)', overflow: 'hidden' }}>
            {(['list', 'kanban'] as const).map(v => (
              <button key={v} onClick={() => setCrmView(v)}
                style={{ padding: '7px 14px', background: crmView === v ? '#1c4a35' : 'transparent', color: crmView === v ? '#f4f0e6' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}>
                {v === 'list' ? '≡ Lista' : '⬛ Kanban'}
              </button>
            ))}
          </div>
          <button onClick={() => setCrmShowFilters(!crmShowFilters)}
            style={{ padding: '7px 14px', background: crmShowFilters ? 'rgba(28,74,53,.1)' : 'transparent', color: '#1c4a35', border: '1px solid rgba(28,74,53,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', cursor: 'pointer' }}>
            ⚙ Filtros {(crmNatFilter || crmZonaFilter || crmStatusFilter) ? '●' : ''}
          </button>
          <button onClick={() => exportCrmCSV(crmContacts)}
            style={{ padding: '7px 14px', background: 'transparent', color: 'rgba(14,14,13,.5)', border: '1px solid rgba(14,14,13,.12)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', cursor: 'pointer' }}>
            ↓ CSV
          </button>
          <button onClick={() => setShowImportCSV(!showImportCSV)}
            style={{ padding: '7px 14px', background: showImportCSV ? 'rgba(28,74,53,.1)' : 'transparent', color: '#1c4a35', border: '1px solid rgba(28,74,53,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', cursor: 'pointer' }}>
            ↑ Import CSV
          </button>
          <button className="p-btn p-btn-gold" style={{ padding: '8px 16px', fontSize: '.52rem' }} onClick={() => setShowNewContact(true)}>+ Novo</button>
        </div>
      </div>

      {/* Advanced Filters */}
      {crmShowFilters && (
        <div style={{ background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.12)', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '5px' }}>Nacionalidade</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '5px' }}>
                {['🇺🇸 Americana', '🇫🇷 Francesa', '🇬🇧 Britânica', '🇨🇳 Chinesa', '🇧🇷 Brasileira', '🇩🇪 Alemã', '🇵🇹 Portuguesa'].map(flag => {
                  const nat = flag.split(' ')[1]
                  return (
                    <button key={nat} onClick={() => setCrmNatFilter(crmNatFilter === nat ? '' : nat)}
                      style={{ padding: '3px 8px', background: crmNatFilter === nat ? 'rgba(28,74,53,.15)' : 'rgba(14,14,13,.04)', border: `1px solid ${crmNatFilter === nat ? 'rgba(28,74,53,.3)' : 'rgba(14,14,13,.1)'}`, fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer', color: crmNatFilter === nat ? '#1c4a35' : 'rgba(14,14,13,.5)' }}>
                      {flag}
                    </button>
                  )
                })}
              </div>
              <input className="p-inp" style={{ fontSize: '.75rem', padding: '6px 8px' }} placeholder="ou escrever..." value={crmNatFilter} onChange={e => setCrmNatFilter(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '5px' }}>Zona</div>
              <input className="p-inp" style={{ fontSize: '.75rem', padding: '6px 8px' }} placeholder="ex: Cascais..." value={crmZonaFilter} onChange={e => setCrmZonaFilter(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '5px' }}>Status</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                {(['', 'lead', 'prospect', 'cliente', 'vip'] as const).map(s => {
                  const sc = s ? STATUS_CONFIG[s] : null
                  return (
                    <button key={s || 'all'} onClick={() => setCrmStatusFilter(s)}
                      style={{ padding: '3px 8px', background: crmStatusFilter === s ? (sc?.bg || 'rgba(28,74,53,.12)') : 'transparent', border: `1px solid ${crmStatusFilter === s ? (sc?.color || '#1c4a35') + '50' : 'rgba(14,14,13,.1)'}`, fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer', color: crmStatusFilter === s ? (sc?.color || '#1c4a35') : 'rgba(14,14,13,.45)' }}>
                      {s ? s.toUpperCase() : 'TODOS'}
                    </button>
                  )
                })}
              </div>
            </div>
            <button onClick={() => { setCrmNatFilter(''); setCrmZonaFilter(''); setCrmStatusFilter(''); setBudgetFilterMin(0); setBudgetFilterMax(10) }}
              style={{ padding: '6px 12px', background: 'rgba(14,14,13,.06)', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.5)', cursor: 'pointer', alignSelf: 'flex-end' }}>
              Limpar
            </button>
          </div>
          {/* Budget range slider */}
          <div style={{ borderTop: '1px solid rgba(28,74,53,.1)', paddingTop: '10px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '6px' }}>
              Budget Range: €{budgetFilterMin}M – €{budgetFilterMax}M {budgetFilterMin === 0 && budgetFilterMax === 10 ? '(sem filtro)' : ''}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', minWidth: '30px' }}>€0M</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', width: '20px' }}>Mín</span>
                  <input type="range" min={0} max={10} step={0.5} value={budgetFilterMin}
                    onChange={e => setBudgetFilterMin(Math.min(Number(e.target.value), budgetFilterMax - 0.5))}
                    style={{ flex: 1, accentColor: '#1c4a35' }} />
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: '#1c4a35', width: '36px', textAlign: 'right' }}>€{budgetFilterMin}M</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', width: '20px' }}>Máx</span>
                  <input type="range" min={0} max={10} step={0.5} value={budgetFilterMax}
                    onChange={e => setBudgetFilterMax(Math.max(Number(e.target.value), budgetFilterMin + 0.5))}
                    style={{ flex: 1, accentColor: '#c9a96e' }} />
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: '#c9a96e', width: '36px', textAlign: 'right' }}>€{budgetFilterMax}M</span>
                </div>
              </div>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', minWidth: '34px' }}>€10M+</span>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Panel */}
      {showImportCSV && (
        <div style={{ background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.15)', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#1c4a35', marginBottom: '10px' }}>↑ Import CSV — Contactos</div>
          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.5)', lineHeight: 1.5, marginBottom: '10px' }}>
            Formato esperado: <strong>Nome, Email, Telefone, Nacionalidade, BudgetMin, BudgetMax, Zonas, Status</strong><br />
            Primeira linha = cabeçalhos (ignorada). Separador: vírgula ou ponto e vírgula.
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#1c4a35', color: '#c9a96e', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.08em', cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Selecionar ficheiro CSV"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Selecionar Ficheiro .CSV
              <input type="file" accept=".csv,.txt" style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = evt => {
                    const text = evt.target?.result as string
                    const lines = text.split(/\r?\n/).filter(l => l.trim())
                    if (lines.length < 2) { setCsvImportResult('Ficheiro vazio ou sem dados.'); return }
                    const sep = lines[0].includes(';') ? ';' : ','
                    const rows = lines.slice(1) // skip header
                    const imported: CRMContact[] = []
                    const errors: string[] = []
                    rows.forEach((row, i) => {
                      const cols = row.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
                      const [name, email, phone, nationality, budgetMinStr, budgetMaxStr, zonas, status] = cols
                      if (!name) { errors.push(`Linha ${i + 2}: nome em falta`); return }
                      const validStatus = ['lead', 'prospect', 'cliente', 'vip']
                      imported.push({
                        id: Date.now() + i,
                        name, email: email || '', phone: phone || '',
                        nationality: nationality || '',
                        budgetMin: parseInt(budgetMinStr) || 0,
                        budgetMax: parseInt(budgetMaxStr) || 0,
                        tipos: [],
                        zonas: zonas ? zonas.split('|').map(z => z.trim()).filter(Boolean) : [],
                        status: (validStatus.includes((status || '').toLowerCase()) ? (status || '').toLowerCase() : 'lead') as CRMContact['status'],
                        notes: '', lastContact: today, nextFollowUp: '', dealRef: '', origin: 'Import CSV',
                        createdAt: today,
                      })
                    })
                    saveCrmContacts([...crmContacts, ...imported])
                    setCsvImportResult(`✓ ${imported.length} contactos importados${errors.length > 0 ? ` · ${errors.length} erros: ${errors.join(', ')}` : ''}`)
                    e.target.value = ''
                  }
                  reader.readAsText(file)
                }}
              />
            </label>
            {csvImportResult && (
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: csvImportResult.startsWith('✓') ? '#4a9c7a' : '#e05252', flex: 1 }}>
                {csvImportResult}
              </div>
            )}
            <button onClick={() => { setShowImportCSV(false); setCsvImportResult('') }}
              style={{ padding: '6px 12px', background: 'none', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.4)', cursor: 'pointer' }}>
              × Fechar
            </button>
          </div>
          {/* Download template */}
          <button
            style={{ marginTop: '10px', padding: '5px 12px', background: 'transparent', border: '1px dashed rgba(28,74,53,.3)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(28,74,53,.6)', cursor: 'pointer' }}
            onClick={() => {
              const template = 'Nome,Email,Telefone,Nacionalidade,BudgetMin,BudgetMax,Zonas,Status\nJohn Smith,john@example.com,+44700000000,Britânica,800000,1500000,Lisboa|Cascais,prospect'
              const blob = new Blob([template], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = 'template_crm.csv'; a.click()
              URL.revokeObjectURL(url)
            }}>
            ↓ Download Template CSV
          </button>
        </div>
      )}

      {/* KPI bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Contactos', val: String(crmContacts.length), color: '#1c4a35' },
          { label: 'VIP / Clientes', val: `${vipCount + clienteCount}`, color: '#c9a96e' },
          { label: 'Follow-up Urgente', val: String(followUps), color: followUps > 0 ? '#e05454' : '#1c4a35' },
          { label: 'Budget Total', val: `€${(totalBudget / 1e6).toFixed(0)}M`, color: '#1c4a35' },
        ].map(k => (
          <div key={k.label} className="crm-stat-card">
            <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: k.color, lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginTop: '4px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* New Contact Modal */}
      {showNewContact && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#f4f0e6', padding: '32px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.5rem', color: '#0e0e0d' }}>Novo <em style={{ color: '#1c4a35' }}>Contacto</em></div>
              <button style={{ padding: '6px 14px', background: showSmartImport ? 'rgba(28,74,53,.12)' : 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.2)', color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.08em', cursor: 'pointer' }}
                onClick={() => setShowSmartImport(!showSmartImport)}>
                {showSmartImport ? '× Fechar' : '✦ Import Inteligente IA'}
              </button>
            </div>
            {showSmartImport && (
              <div style={{ background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.15)', padding: '14px', marginBottom: '14px' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(28,74,53,.6)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>✦ Colar email, WA, LinkedIn ou texto livre — Claude extrai automaticamente</div>
                <textarea style={{ width: '100%', minHeight: '80px', border: '1px solid rgba(28,74,53,.15)', background: '#fff', color: '#0e0e0d', fontFamily: "'Jost',sans-serif", fontSize: '.8rem', padding: '8px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                  value={smartImportText} onChange={e => setSmartImportText(e.target.value)}
                  placeholder="Cole aqui o email, mensagem WhatsApp, perfil LinkedIn..." />
                <button style={{ marginTop: '8px', padding: '8px 18px', background: '#1c4a35', color: '#c9a96e', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', cursor: 'pointer' }}
                  disabled={smartImportLoading || !smartImportText.trim()}
                  onClick={async () => {
                    setSmartImportLoading(true)
                    try {
                      const res = await fetch('/api/crm/extract-contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: smartImportText }) })
                      const d = await res.json()
                      if (d.contact) {
                        const c = d.contact
                        setNewContact({
                          name: c.name || newContact.name, email: c.email || newContact.email, phone: c.phone || newContact.phone,
                          nationality: c.nationality || newContact.nationality,
                          budgetMin: c.budgetMin ? String(c.budgetMin) : newContact.budgetMin,
                          budgetMax: c.budgetMax ? String(c.budgetMax) : newContact.budgetMax,
                          tipos: c.tipos?.join(', ') || newContact.tipos, zonas: c.zonas?.join(', ') || newContact.zonas,
                          origin: c.origin || newContact.origin, notes: c.notes || newContact.notes,
                        })
                        setShowSmartImport(false); setSmartImportText('')
                      }
                    } catch { /* ignore */ } finally { setSmartImportLoading(false) }
                  }}>
                  {smartImportLoading ? '✦ A extrair...' : '✦ Extrair Dados'}
                </button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div><label className="p-label">Nome *</label><input className="p-inp" value={newContact.name} onChange={e => setNewContact({ name: e.target.value })} placeholder="Nome completo" /></div>
              <div><label className="p-label">Email</label><input className="p-inp" value={newContact.email} onChange={e => setNewContact({ email: e.target.value })} placeholder="email@exemplo.com" /></div>
              <div><label className="p-label">Telefone</label><input className="p-inp" value={newContact.phone} onChange={e => setNewContact({ phone: e.target.value })} placeholder="+351 9xx xxx xxx" /></div>
              <div><label className="p-label">Nacionalidade</label><input className="p-inp" value={newContact.nationality} onChange={e => setNewContact({ nationality: e.target.value })} placeholder="🇬🇧 Britânico" /></div>
              <div><label className="p-label">Budget Mín (€)</label><input type="number" className="p-inp" value={newContact.budgetMin} onChange={e => setNewContact({ budgetMin: e.target.value })} placeholder="500000" /></div>
              <div><label className="p-label">Budget Máx (€)</label><input type="number" className="p-inp" value={newContact.budgetMax} onChange={e => setNewContact({ budgetMax: e.target.value })} placeholder="1500000" /></div>
              <div><label className="p-label">Tipologias</label><input className="p-inp" value={newContact.tipos} onChange={e => setNewContact({ tipos: e.target.value })} placeholder="Villa, T4, Penthouse" /></div>
              <div><label className="p-label">Zonas</label><input className="p-inp" value={newContact.zonas} onChange={e => setNewContact({ zonas: e.target.value })} placeholder="Cascais, Lisboa" /></div>
              <div>
                <label className="p-label">Origem</label>
                <select className="p-sel" value={newContact.origin} onChange={e => setNewContact({ origin: e.target.value })}>
                  {['Website', 'WhatsApp', 'Email', 'Referência', 'Redes Sociais', 'Evento', 'Portal'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div><label className="p-label">Notas</label><textarea className="p-inp" style={{ minHeight: '60px', resize: 'vertical' }} value={newContact.notes} onChange={e => setNewContact({ notes: e.target.value })} placeholder="Preferências, observações..." /></div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="p-btn p-btn-gold" style={{ flex: 1 }}
                onClick={() => {
                  if (!newContact.name) return
                  const c: CRMContact = {
                    id: Date.now(), name: newContact.name, email: newContact.email, phone: newContact.phone,
                    nationality: newContact.nationality, budgetMin: parseInt(newContact.budgetMin) || 0, budgetMax: parseInt(newContact.budgetMax) || 0,
                    tipos: newContact.tipos.split(',').map(s => s.trim()).filter(Boolean),
                    zonas: newContact.zonas.split(',').map(s => s.trim()).filter(Boolean),
                    status: 'lead', notes: newContact.notes, lastContact: today, nextFollowUp: '', dealRef: '',
                    origin: newContact.origin, createdAt: today,
                  }
                  saveCrmContacts([...crmContacts, c])
                  setNewContact({ name: '', email: '', phone: '', nationality: '', budgetMin: '', budgetMax: '', tipos: '', zonas: '', origin: 'Website', notes: '' })
                  setShowNewContact(false); setActiveCrmId(c.id)
                  // Persist to Supabase (fire-and-forget)
                  fetch('/api/crm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      full_name: c.name,
                      email: c.email || null,
                      phone: c.phone || null,
                      nationality: c.nationality || null,
                      budget_min: c.budgetMin || null,
                      budget_max: c.budgetMax || null,
                      preferred_locations: c.zonas.length > 0 ? c.zonas : null,
                      typologies_wanted: c.tipos.length > 0 ? c.tipos : null,
                      source: c.origin || null,
                      notes: c.notes || null,
                      status: 'lead',
                      gdpr_consent: true,
                    }),
                  }).catch(() => { /* silently fail — data persisted to localStorage */ })
                }}>Guardar Contacto</button>
              <button className="p-btn" style={{ background: 'rgba(14,14,13,.06)', color: 'rgba(14,14,13,.6)' }} onClick={() => setShowNewContact(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 14px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.1)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1c4a35', animation: 'pulse 1.2s ease-in-out infinite' }} />
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#1c4a35', letterSpacing: '.08em' }}>A sincronizar contactos...</span>
        </div>
      )}
      {!isLoading && dataSource === 'live' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4a9c7a' }} />
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#4a9c7a' }}>Dados em tempo real · /api/crm</span>
        </div>
      )}

      {/* Email Campaign Modal */}
      {showCampaignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#f4f0e6', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(14,14,13,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.3rem', color: '#0e0e0d' }}>📧 Email <em style={{ color: '#1c4a35' }}>Campaign</em></div>
              <button onClick={() => setShowCampaignModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'rgba(14,14,13,.4)' }}>×</button>
            </div>
            {campaignSent ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>✅</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', color: '#1c4a35', marginBottom: '8px' }}>Campanha enviada!</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.4)' }}>
                  {crmSelectedIds.size} destinatários · {campaignName}
                </div>
                <button className="p-btn" style={{ marginTop: '20px', padding: '8px 20px' }} onClick={() => { setShowCampaignModal(false); setCampaignSent(false) }}>Fechar</button>
              </div>
            ) : (
              <div style={{ padding: '20px 24px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label className="p-label">Nome da Campanha</label>
                  <input className="p-inp" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="ex: Seguimento Q2 2026" />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label className="p-label">Template</label>
                  <select className="p-sel" value={campaignTemplate} onChange={e => setCampaignTemplate(e.target.value)}>
                    <option value="followup">Follow-up — Seguimento</option>
                    <option value="proposta">Nova Propriedade</option>
                    <option value="visita">Convite Visita</option>
                  </select>
                </div>
                <div style={{ marginBottom: '16px', background: '#fff', border: '1px solid rgba(14,14,13,.08)', padding: '14px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#c9a96e', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Preview</div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(14,14,13,.7)', lineHeight: 1.6 }}>
                    {campaignTemplate === 'followup' && `Olá! Queria saber se já teve oportunidade de pensar nas opções que partilhei. Tenho novos imóveis exclusivos que podem ser exactamente o que procura. — ${agentName}, Agency Group`}
                    {campaignTemplate === 'proposta' && `Olá! Tenho uma nova propriedade exclusiva que combina perfeitamente com o seu perfil. Posso partilhar mais detalhes? — ${agentName}, Agency Group`}
                    {campaignTemplate === 'visita' && `Olá! Gostaria de o/a convidar para uma visita privada a uma propriedade excepcional. Quando estaria disponível? — ${agentName}, Agency Group`}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.1)', marginBottom: '16px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: '#1c4a35' }}>
                  Total: <strong>{crmSelectedIds.size} destinatários</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="p-btn p-btn-gold" style={{ flex: 1 }} disabled={!campaignName.trim()}
                    onClick={async () => {
                      try {
                        const selectedContacts = crmContacts.filter(c => crmSelectedIds.has(c.id))
                        await fetch('/api/automation/vendor-report', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ campaign: campaignName, template: campaignTemplate, contacts: selectedContacts }),
                        }).catch(() => undefined)
                      } catch { /* ignore */ }
                      setCampaignSent(true)
                    }}>
                    Enviar Campanha
                  </button>
                  <button className="p-btn" style={{ background: 'rgba(14,14,13,.06)', color: 'rgba(14,14,13,.5)' }} onClick={() => setShowCampaignModal(false)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enrich Toast */}
      {!!enrichToast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 400, background: '#1c4a35', color: '#c9a96e', padding: '12px 20px', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.08em', boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>
          {enrichToast}
        </div>
      )}

      {/* WhatsApp Modal — Enhanced with template selector + char counter + preview */}
      {showWaModal && (() => {
        const wc = waModalContact ? crmContacts.find(c => c.id === waModalContact) : null
        const templates = WA_TEMPLATES[waLang] || WA_TEMPLATES['PT']
        // Enhanced WA modal with proper features
        return (
          <WAModal
            wc={wc || null}
            waLang={waLang}
            setWaLang={setWaLang}
            templates={templates}
            agentName={agentName}
            onClose={() => setShowWaModal(false)}
          />
        )
      })()}

      {/* Kanban View */}
      {crmView === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
          {(['lead', 'prospect', 'cliente', 'vip'] as const).map(status => {
            const sc = STATUS_CONFIG[status]
            const statusContacts = filtered.filter(c => c.status === status)
            return (
              <div key={status} style={{ background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.08)', minHeight: '400px' }}>
                <div style={{ padding: '10px 14px', borderBottom: '2px solid ' + sc.color, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: sc.bg }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: sc.color, fontWeight: 600 }}>{sc.label}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: sc.color, background: sc.avatar, padding: '2px 7px', borderRadius: '10px' }}>{statusContacts.length}</span>
                </div>
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {statusContacts.map(c => {
                    const ls = computeLeadScore(c)
                    const na = getAINextAction(c)
                    const ini = c.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                    return (
                      <div key={c.id} onClick={() => { setActiveCrmId(c.id); setCrmProfileTab('overview'); setCrmView('list') }}
                        style={{ background: '#fff', border: '1px solid rgba(14,14,13,.08)', padding: '10px', cursor: 'pointer', borderLeft: `3px solid ${ls.color}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: sc.avatar, color: sc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.42rem', fontWeight: 600, flexShrink: 0 }}>{ini}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '.8rem', fontWeight: 500, color: '#0e0e0d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)' }}>{c.nationality}</div>
                          </div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: ls.color, fontWeight: 600 }}>{ls.score}</div>
                        </div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#1c4a35', marginBottom: '4px' }}>
                          {(Number(c.budgetMin) || 0) > 0 ? `€${((Number(c.budgetMin)) / 1e6).toFixed(1)}M–€${((Number(c.budgetMax)) / 1e6).toFixed(1)}M` : 'Budget n/d'}
                        </div>
                        {na.urgency !== 'low' && (
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: na.urgency === 'high' ? '#e05454' : '#c9a96e', background: na.urgency === 'high' ? 'rgba(224,84,84,.06)' : 'rgba(201,169,110,.06)', padding: '3px 6px', borderRadius: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {na.urgency === 'high' ? '🔴' : '🟡'} {na.text}
                          </div>
                        )}
                        <button onClick={e => { e.stopPropagation(); setWaModalContact(c.id); setWaLang((c.language as typeof waLang) || 'PT'); setShowWaModal(true) }}
                          style={{ marginTop: '6px', width: '100%', padding: '4px', background: '#25D366', color: '#fff', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer', borderRadius: '2px' }}>
                          📱 WhatsApp
                        </button>
                      </div>
                    )
                  })}
                  {statusContacts.length === 0 && (
                    <div style={{ padding: '24px 12px', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.25)', letterSpacing: '.08em' }}>Sem contactos</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CRM Stats Funnel Panel (collapsible) */}
      {crmView === 'list' && (
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={() => setShowStatsPanel(!showStatsPanel)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: showStatsPanel ? 'rgba(28,74,53,.08)' : 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', color: '#1c4a35', cursor: 'pointer', width: '100%', justifyContent: 'space-between' }}>
            <span>📊 Funil CRM — {crmContacts.length} Contactos</span>
            <span style={{ fontSize: '.5rem' }}>{showStatsPanel ? '▲' : '▼'}</span>
          </button>
          {showStatsPanel && (() => {
            const leads = crmContacts.filter(c => c.status === 'lead').length
            const prospects = crmContacts.filter(c => c.status === 'prospect').length
            const clientes = crmContacts.filter(c => c.status === 'cliente').length
            const vips = crmContacts.filter(c => c.status === 'vip').length
            const total = crmContacts.length || 1
            const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
            const newThisWeek = crmContacts.filter(c => c.createdAt && new Date(c.createdAt) >= oneWeekAgo).length
            const inactive30d = crmContacts.filter(c => {
              if (!c.lastContact) return true
              return Math.floor((Date.now() - new Date(c.lastContact).getTime()) / 86400000) >= 30
            }).length
            const stages = [
              { label: 'Leads', count: leads, color: '#888', pct: (leads / total) * 100 },
              { label: 'Prospects', count: prospects, color: '#3a7bd5', pct: (prospects / total) * 100 },
              { label: 'Clientes', count: clientes, color: '#4a9c7a', pct: (clientes / total) * 100 },
              { label: 'VIP', count: vips, color: '#c9a96e', pct: (vips / total) * 100 },
            ]
            return (
              <div style={{ background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.08)', borderTop: 'none', padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {stages.map((s, i) => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.08em', textTransform: 'uppercase', color: s.color, width: '60px', flexShrink: 0 }}>{s.label}</div>
                      <div style={{ flex: 1, height: '8px', background: 'rgba(14,14,13,.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: '4px', transition: 'width .4s', opacity: 0.8 }} />
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', fontWeight: 700, color: s.color, width: '24px', textAlign: 'right', flexShrink: 0 }}>{s.count}</div>
                      {i < stages.length - 1 && stages[i + 1].count > 0 && stages[i].count > 0 && (
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.3)', width: '36px', flexShrink: 0 }}>→{Math.round((stages[i + 1].count / stages[i].count) * 100)}%</div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid rgba(14,14,13,.07)', paddingTop: '10px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#4a9c7a' }}>+{newThisWeek} esta semana</div>
                  {inactive30d > 0 && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#e05252' }}>{inactive30d} inactivos 30d+</div>}
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.4)' }}>{crmContacts.length} total</div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* List View */}
      {crmView === 'list' && (
        <div className="crm-layout" style={{ display: 'flex', gap: '0', background: '#fff', border: '1px solid rgba(14,14,13,.08)', minHeight: '500px' }}>
          {/* Contact list sidebar */}
          <div className="crm-list" style={{ width: '320px', minWidth: '280px', borderRight: '1px solid rgba(14,14,13,.08)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(14,14,13,.06)' }}>
              <input className="p-inp" placeholder="Pesquisar contacto..." value={crmSearch} onChange={e => setCrmSearch(e.target.value)} style={{ fontSize: '.78rem', padding: '8px 12px' }} />
            </div>

            {/* Quick Filters */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(14,14,13,.06)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                {([
                  ['todos', `Todos (${crmContacts.length})`],
                  ['lead', `Leads (${crmContacts.filter(c => c.status === 'lead').length})`],
                  ['prospect', `Prospects (${crmContacts.filter(c => c.status === 'prospect').length})`],
                  ['cliente', `Clientes (${crmContacts.filter(c => c.status === 'cliente').length})`],
                  ['vip', `VIP (${crmContacts.filter(c => c.status === 'vip').length})`],
                ] as [string, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => setQuickFilter(k)}
                    style={{ padding: '3px 7px', background: quickFilter === k ? (STATUS_CONFIG[k as keyof typeof STATUS_CONFIG]?.bg || 'rgba(28,74,53,.12)') : 'transparent', border: `1px solid ${quickFilter === k ? (STATUS_CONFIG[k as keyof typeof STATUS_CONFIG]?.color || '#1c4a35') + '50' : 'rgba(14,14,13,.1)'}`, fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.06em', color: quickFilter === k ? (STATUS_CONFIG[k as keyof typeof STATUS_CONFIG]?.color || '#1c4a35') : 'rgba(14,14,13,.45)', cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                {([
                  ['followup', `Follow-up Hoje (${crmContacts.filter(c => c.nextFollowUp && c.nextFollowUp <= today).length})`],
                  ['sem_contacto', `Sem Contacto 14d+ (${crmContacts.filter(c => { const d = c.lastContact ? Math.floor((Date.now() - new Date(c.lastContact).getTime()) / 86400000) : null; return d !== null && d >= 14 }).length})`],
                ] as [string, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => setQuickFilter(quickFilter === k ? 'todos' : k)}
                    style={{ padding: '3px 7px', background: quickFilter === k ? 'rgba(224,82,82,.1)' : 'transparent', border: `1px solid ${quickFilter === k ? 'rgba(224,82,82,.3)' : 'rgba(14,14,13,.1)'}`, fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: quickFilter === k ? '#e05252' : 'rgba(14,14,13,.45)', cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    style={{ padding: '3px 6px', border: '1px solid rgba(14,14,13,.1)', background: '#fff', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.5)', cursor: 'pointer', outline: 'none' }}>
                    <option value="score">↓ Score</option>
                    <option value="actividade">↓ Actividade</option>
                    <option value="nome">↓ Nome</option>
                    <option value="budget">↓ Budget</option>
                  </select>
                  <button onClick={() => { setCrmBulkMode(!crmBulkMode); setCrmSelectedIds(new Set()) }}
                    style={{ padding: '3px 8px', background: crmBulkMode ? 'rgba(28,74,53,.12)' : 'rgba(14,14,13,.04)', border: `1px solid ${crmBulkMode ? 'rgba(28,74,53,.3)' : 'rgba(14,14,13,.1)'}`, color: crmBulkMode ? '#1c4a35' : 'rgba(14,14,13,.4)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer' }}>
                    {crmBulkMode ? '✓ Bulk' : '☐ Bulk'}
                  </button>
                </div>
              </div>
            </div>

            {/* Enhanced Bulk Actions */}
            {crmBulkMode && crmSelectedIds.size > 0 && (
              <div style={{ padding: '8px 10px', background: 'rgba(28,74,53,.06)', borderBottom: '1px solid rgba(28,74,53,.12)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#1c4a35', fontWeight: 700 }}>{crmSelectedIds.size} seleccionados</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button style={{ padding: '4px 8px', background: 'rgba(28,74,53,.1)', color: '#1c4a35', border: '1px solid rgba(28,74,53,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', cursor: 'pointer' }}
                    onClick={() => { setShowCampaignModal(true); setCampaignSent(false) }}>📧 Email Campaign</button>
                  <button style={{ padding: '4px 8px', background: '#25d366', color: '#fff', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', cursor: 'pointer' }}
                    onClick={() => {
                      const selected = crmContacts.filter(c => crmSelectedIds.has(c.id))
                      const phones = selected.map(c => c.phone?.replace(/\D/g, '')).filter(Boolean)
                      if (phones.length === 1) window.open(`https://wa.me/${phones[0]}`)
                      else { alert(`Campanha WA para ${phones.length} contactos.`); phones.forEach((p, i) => setTimeout(() => window.open(`https://wa.me/${p}`), i * 500)) }
                    }}>💬 WA</button>
                  <button style={{ padding: '4px 8px', background: 'rgba(201,169,110,.1)', color: '#c9a96e', border: '1px solid rgba(201,169,110,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', cursor: 'pointer' }}
                    onClick={() => setShowBulkStatusModal(true)}>📊 Status</button>
                  <button style={{ padding: '4px 8px', background: 'rgba(14,14,13,.06)', color: 'rgba(14,14,13,.5)', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', cursor: 'pointer' }}
                    onClick={() => {
                      const d = new Date(); d.setDate(d.getDate() + 3)
                      saveCrmContacts(crmContacts.map(c => crmSelectedIds.has(c.id) ? { ...c, nextFollowUp: d.toISOString().split('T')[0] } : c))
                      setCrmSelectedIds(new Set())
                    }}>📅 +3d</button>
                  <button style={{ padding: '4px 8px', background: 'rgba(14,14,13,.06)', color: 'rgba(14,14,13,.5)', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', cursor: 'pointer' }}
                    onClick={() => {
                      const selected = crmContacts.filter(c => crmSelectedIds.has(c.id))
                      const csv = ['Nome,Email,Telefone,Nacionalidade,Status,Budget Max,Zonas', ...selected.map(c => `"${c.name}","${c.email}","${c.phone}","${c.nationality}","${c.status}","${c.budgetMax}","${(c.zonas || []).join(';')}"`)]
                      const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a'); a.href = url; a.download = `crm_export_${new Date().toISOString().split('T')[0]}.csv`; a.click()
                      URL.revokeObjectURL(url)
                    }}>📤 CSV</button>
                  <button style={{ padding: '4px 8px', background: 'rgba(224,82,82,.06)', color: '#e05252', border: '1px solid rgba(224,82,82,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', cursor: 'pointer' }}
                    onClick={() => {
                      if (confirm(`Arquivar ${crmSelectedIds.size} contactos?`)) {
                        saveCrmContacts(crmContacts.filter(c => !crmSelectedIds.has(c.id)))
                        setCrmSelectedIds(new Set()); setCrmBulkMode(false)
                      }
                    }}>🗑️ Arquivar</button>
                  <button style={{ padding: '4px 8px', background: 'rgba(14,14,13,.04)', color: 'rgba(14,14,13,.35)', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', cursor: 'pointer' }} onClick={() => setCrmSelectedIds(new Set())}>× Limpar</button>
                </div>
              </div>
            )}

            {/* Bulk Status Modal */}
            {showBulkStatusModal && (
              <div style={{ padding: '8px 10px', background: 'rgba(201,169,110,.06)', borderBottom: '1px solid rgba(201,169,110,.12)' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#c9a96e', marginBottom: '6px' }}>Alterar status para:</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(['lead', 'prospect', 'cliente', 'vip'] as const).map(s => (
                    <button key={s} style={{ padding: '4px 8px', background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color, border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer' }}
                      onClick={() => { saveCrmContacts(crmContacts.map(c => crmSelectedIds.has(c.id) ? { ...c, status: s } : c)); setCrmSelectedIds(new Set()); setShowBulkStatusModal(false) }}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                  <button style={{ padding: '4px 8px', background: 'none', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', cursor: 'pointer' }} onClick={() => setShowBulkStatusModal(false)}>× cancelar</button>
                </div>
              </div>
            )}

            {/* Bulk Email Campaign Modal */}
            {showBulkEmailModal && (
              <div style={{ padding: '10px', background: 'rgba(28,74,53,.04)', borderBottom: '1px solid rgba(28,74,53,.12)' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#1c4a35', marginBottom: '6px' }}>📧 Email em Massa · {crmSelectedIds.size} contactos</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)', lineHeight: 1.5, marginBottom: '6px' }}>
                  Emails: {crmContacts.filter(c => crmSelectedIds.has(c.id) && c.email).map(c => c.email).join(', ').substring(0, 100)}{crmContacts.filter(c => crmSelectedIds.has(c.id) && c.email).length > 3 ? '...' : ''}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button style={{ padding: '5px 10px', background: '#1c4a35', color: '#c9a96e', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer' }}
                    onClick={() => { const emails = crmContacts.filter(c => crmSelectedIds.has(c.id) && c.email).map(c => c.email).join(','); window.open(`mailto:${emails}`); setShowBulkEmailModal(false) }}>
                    Abrir no Mail
                  </button>
                  <button style={{ padding: '5px 8px', background: 'none', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', cursor: 'pointer' }} onClick={() => setShowBulkEmailModal(false)}>× Cancelar</button>
                </div>
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtered.map(c => {
                const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG['lead']
                const ini = c.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                const isOverdue = c.nextFollowUp && c.nextFollowUp < today
                const ls2 = calcLeadScore({ budgetMax: c.budgetMax, budgetMin: c.budgetMin, phone: c.phone, email: c.email, source: c.origin, notes: c.notes })
                const dSince = c.lastContact ? Math.floor((Date.now() - new Date(c.lastContact).getTime()) / 86400000) : null
                const dColor = dSince === null ? '#9ca3af' : dSince > 14 ? '#e05454' : dSince > 7 ? '#f97316' : dSince > 3 ? '#f59e0b' : '#10b981'
                const dLabel = dSince === null ? '—' : dSince === 0 ? 'hoje' : `${dSince}d`
                const budgetLabel = Number(c.budgetMax) > 2e6 ? 'Alto' : Number(c.budgetMax) > 800000 ? 'Médio' : 'Base'
                const engagementLabel = dSince === null ? 'Desconhecido' : dSince < 3 ? 'Muito Alto' : dSince < 7 ? 'Alto' : dSince < 14 ? 'Médio' : 'Baixo'
                const isQuickNoteOpen = quickNoteId === c.id
                return (
                  <div key={c.id}>
                    <div
                      className={`crm-contact-row${activeCrmId === c.id ? ' active' : ''}`}
                      style={{ background: crmBulkMode && crmSelectedIds.has(c.id) ? 'rgba(28,74,53,.08)' : undefined }}
                      onClick={() => {
                        if (crmBulkMode) {
                          const next = new Set(crmSelectedIds); next.has(c.id) ? next.delete(c.id) : next.add(c.id); setCrmSelectedIds(next)
                        } else {
                          setActiveCrmId(c.id); setCrmProfileTab('overview')
                        }
                      }}>
                      {crmBulkMode && (
                        <div style={{ flexShrink: 0, width: '18px', height: '18px', border: `2px solid ${crmSelectedIds.has(c.id) ? '#1c4a35' : 'rgba(14,14,13,.2)'}`, background: crmSelectedIds.has(c.id) ? '#1c4a35' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px' }}>
                          {crmSelectedIds.has(c.id) && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      )}
                      <div className="crm-avatar" style={{ background: sc.avatar, color: sc.color }}>{ini}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 500, fontSize: '.83rem', color: '#0e0e0d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.name}</span>
                          <span className="crm-status" style={{ background: sc.bg, color: sc.color, flexShrink: 0 }}>{sc.label}</span>
                          <TemperatureBadge score={ls2.score} lastContactDays={dSince} />
                        </div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{c.nationality}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#1c4a35' }}>
                            {(Number(c.budgetMin) || 0) > 0 ? `€${(Number(c.budgetMin) / 1e6).toFixed(1)}M–€${(Number(c.budgetMax) / 1e6).toFixed(1)}M` : 'Budget n/d'}
                          </span>
                          {isOverdue && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#e05454', background: 'rgba(224,84,84,.08)', padding: '1px 4px' }}>Follow-up!</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                        <ScoreCircle score={ls2.score} budgetLabel={budgetLabel} engagementLabel={engagementLabel} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', fontWeight: 700, color: dColor, marginRight: '2px' }}>{dLabel}</div>
                          {/* Quick Action: Call */}
                          {c.phone && (
                            <button
                              title={`Ligar para ${c.phone}`}
                              onClick={e => { e.stopPropagation(); setQuickCallId(quickCallId === c.id ? null : c.id) }}
                              style={{ padding: '2px 5px', background: quickCallId === c.id ? 'rgba(28,74,53,.15)' : 'transparent', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#1c4a35', cursor: 'pointer', lineHeight: 1 }}>
                              📞
                            </button>
                          )}
                          {/* Quick Action: WhatsApp */}
                          {c.phone && (
                            <button
                              title="WhatsApp"
                              onClick={e => { e.stopPropagation(); setWaModalContact(c.id); setWaLang((c.language as typeof waLang) || 'PT'); setShowWaModal(true) }}
                              style={{ padding: '2px 5px', background: 'transparent', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#25D366', cursor: 'pointer', lineHeight: 1 }}>
                              💬
                            </button>
                          )}
                          {/* Quick Action: Email */}
                          {c.email && (
                            <button
                              title={`Email: ${c.email}`}
                              onClick={e => { e.stopPropagation(); setQuickEmailId(quickEmailId === c.id ? null : c.id) }}
                              style={{ padding: '2px 5px', background: quickEmailId === c.id ? 'rgba(58,123,213,.12)' : 'transparent', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#3a7bd5', cursor: 'pointer', lineHeight: 1 }}>
                              ✉️
                            </button>
                          )}
                          {/* Quick Note */}
                          <button
                            title="Nota rápida"
                            onClick={e => { e.stopPropagation(); setQuickNoteId(isQuickNoteOpen ? null : c.id); setQuickNoteText('') }}
                            style={{ padding: '2px 5px', background: isQuickNoteOpen ? 'rgba(28,74,53,.12)' : 'transparent', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#1c4a35', cursor: 'pointer', lineHeight: 1 }}>
                            📝
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Quick Call inline */}
                    {quickCallId === c.id && (
                      <div style={{ padding: '8px 12px', background: 'rgba(28,74,53,.04)', borderBottom: '1px solid rgba(28,74,53,.1)', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: '#1c4a35' }}>📞 {c.phone}</span>
                        <a href={`tel:${c.phone}`}
                          style={{ padding: '4px 12px', background: '#1c4a35', color: '#c9a96e', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', textDecoration: 'none', cursor: 'pointer' }}
                          onClick={() => {
                            const act = { id: Date.now(), type: 'call' as const, note: 'Chamada iniciada', date: today }
                            saveCrmContacts(crmContacts.map(cont => cont.id === c.id ? { ...cont, activities: [act, ...(cont.activities || [])], lastContact: today } : cont))
                            setQuickCallId(null)
                          }}>
                          Ligar ↗
                        </a>
                        <button style={{ background: 'none', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', cursor: 'pointer' }} onClick={() => setQuickCallId(null)}>× cancelar</button>
                      </div>
                    )}
                    {/* Quick Email inline */}
                    {quickEmailId === c.id && (
                      <div style={{ padding: '8px 12px', background: 'rgba(58,123,213,.04)', borderBottom: '1px solid rgba(58,123,213,.1)', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: '#3a7bd5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>✉ {c.email}</span>
                        <a href={`mailto:${c.email}`}
                          style={{ padding: '4px 12px', background: '#3a7bd5', color: '#fff', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', textDecoration: 'none', cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => {
                            const act = { id: Date.now(), type: 'email' as const, note: 'Email enviado', date: today }
                            saveCrmContacts(crmContacts.map(cont => cont.id === c.id ? { ...cont, activities: [act, ...(cont.activities || [])], lastContact: today } : cont))
                            setQuickEmailId(null)
                          }}>
                          Abrir Mail ↗
                        </a>
                        <button style={{ background: 'none', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', cursor: 'pointer', flexShrink: 0 }} onClick={() => setQuickEmailId(null)}>× cancelar</button>
                      </div>
                    )}
                    {/* Quick Note inline */}
                    {isQuickNoteOpen && (
                      <div style={{ padding: '8px 12px', background: 'rgba(28,74,53,.04)', borderBottom: '1px solid rgba(28,74,53,.1)' }} onClick={e => e.stopPropagation()}>
                        <textarea
                          autoFocus
                          rows={2}
                          value={quickNoteText}
                          onChange={e => setQuickNoteText(e.target.value)}
                          placeholder="Adicionar nota rápida..."
                          style={{ width: '100%', border: '1px solid rgba(28,74,53,.2)', background: '#fff', fontFamily: "'Jost',sans-serif", fontSize: '.78rem', padding: '6px 8px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#0e0e0d', lineHeight: 1.5 }}
                        />
                        <div style={{ display: 'flex', gap: '6px', marginTop: '5px' }}>
                          <button
                            style={{ padding: '4px 12px', background: '#1c4a35', color: '#c9a96e', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', cursor: 'pointer' }}
                            disabled={!quickNoteText.trim()}
                            onClick={() => {
                              if (!quickNoteText.trim()) return
                              const act = { id: Date.now(), type: 'note' as const, note: quickNoteText.trim(), date: today }
                              saveCrmContacts(crmContacts.map(cont => cont.id === c.id ? { ...cont, activities: [act, ...(cont.activities || [])], lastContact: today } : cont))
                              setQuickNoteId(null); setQuickNoteText('')
                            }}>Guardar</button>
                          <button style={{ padding: '4px 10px', background: 'none', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', cursor: 'pointer' }} onClick={() => { setQuickNoteId(null); setQuickNoteText('') }}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(14,14,13,.3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Sem contactos</div>
              )}
            </div>
          </div>

          {/* Contact profile */}
          {activeContact ? (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(14,14,13,.08)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  <div className="crm-avatar" style={{ width: '48px', height: '48px', background: (STATUS_CONFIG[activeContact.status] ?? STATUS_CONFIG['lead']).avatar, color: (STATUS_CONFIG[activeContact.status] ?? STATUS_CONFIG['lead']).color, fontSize: '.7rem', flexShrink: 0 }}>
                    {activeContact.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.4rem', color: '#0e0e0d' }}>{activeContact.name}</div>
                      <span className="crm-status" style={{ background: (STATUS_CONFIG[activeContact.status] ?? STATUS_CONFIG['lead']).bg, color: (STATUS_CONFIG[activeContact.status] ?? STATUS_CONFIG['lead']).color, fontSize: '.46rem', padding: '3px 10px' }}>
                        {(STATUS_CONFIG[activeContact.status] ?? STATUS_CONFIG['lead']).label}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: 'rgba(14,14,13,.4)', marginTop: '3px' }}>{activeContact.nationality} · {activeContact.origin}</div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {activeContact.email && <a href={`mailto:${activeContact.email}`} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: '#1c4a35', textDecoration: 'none' }}>✉ {activeContact.email}</a>}
                      {activeContact.phone && <a href={`https://wa.me/${activeContact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: '#1c4a35', textDecoration: 'none' }}>📱 {activeContact.phone}</a>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                    {(['lead', 'prospect', 'cliente', 'vip'] as const).map(s => (
                      <button key={s}
                        style={{ padding: '5px 10px', background: activeContact.status === s ? STATUS_CONFIG[s].bg : 'transparent', border: `1px solid ${activeContact.status === s ? STATUS_CONFIG[s].color : 'rgba(14,14,13,.12)'}`, fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.1em', textTransform: 'uppercase', color: activeContact.status === s ? STATUS_CONFIG[s].color : 'rgba(14,14,13,.4)', cursor: 'pointer' }}
                        onClick={() => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, status: s } : c))}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.08)', padding: '0 24px', overflowX: 'auto' }}>
                {[['overview', 'Perfil'], ['timeline', 'Timeline'], ['tasks', 'Tarefas'], ['notes', 'Notas'], ['matching', 'Matching']].map(([t, l]) => (
                  <button key={t} className={`crm-profile-tab${crmProfileTab === t ? ' active' : ''}`} onClick={() => setCrmProfileTab(t as typeof crmProfileTab)}>{l}</button>
                ))}
                {activeContact.status === 'cliente' && <button className={`crm-profile-tab${crmProfileTab === 'postclosing' ? ' active' : ''}`} onClick={() => setCrmProfileTab('postclosing')}>Post-Sale</button>}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                {/* OVERVIEW */}
                {crmProfileTab === 'overview' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="p-card">
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '8px' }}>Budget</div>
                      <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: '#1c4a35', lineHeight: 1 }}>{(Number(activeContact.budgetMin) || 0) > 0 ? `€${(Number(activeContact.budgetMin) / 1e6).toFixed(1)}M` : '—'}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: 'rgba(14,14,13,.4)', marginTop: '2px' }}>{(Number(activeContact.budgetMax) || 0) > 0 ? `até €${(Number(activeContact.budgetMax) / 1e6).toFixed(1)}M` : 'Budget não definido'}</div>
                    </div>
                    <div className="p-card">
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '8px' }}>Preferências</div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {(activeContact.tipos || []).map(t => <span key={t} style={{ background: 'rgba(28,74,53,.08)', color: '#1c4a35', padding: '3px 8px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem' }}>{t}</span>)}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(activeContact.zonas || []).map(z => <span key={z} style={{ background: 'rgba(201,169,110,.1)', color: '#c9a96e', padding: '3px 8px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem' }}>{z}</span>)}
                      </div>
                    </div>
                    <div className="p-card" style={{ borderLeft: activeContact.nextFollowUp && activeContact.nextFollowUp <= today ? '3px solid #e05454' : activeContact.nextFollowUp ? '3px solid #c9a96e' : '3px solid rgba(14,14,13,.1)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '8px' }}>Contacto &amp; Follow-up</div>
                      {/* Next follow-up — prominent */}
                      {activeContact.nextFollowUp && (
                        <div style={{ padding: '8px 10px', background: activeContact.nextFollowUp <= today ? 'rgba(224,84,84,.08)' : 'rgba(201,169,110,.06)', border: `1px solid ${activeContact.nextFollowUp <= today ? 'rgba(224,84,84,.2)' : 'rgba(201,169,110,.15)'}`, marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: activeContact.nextFollowUp <= today ? '#e05454' : '#c9a96e', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
                              {activeContact.nextFollowUp <= today ? '🔴 FOLLOW-UP URGENTE' : '🟡 Próximo Follow-up'}
                            </div>
                            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 300, color: activeContact.nextFollowUp <= today ? '#e05454' : '#c9a96e', lineHeight: 1 }}>{activeContact.nextFollowUp}</div>
                          </div>
                          <button className="p-btn" style={{ padding: '5px 10px', fontSize: '.42rem', background: 'rgba(14,14,13,.06)' }}
                            onClick={() => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, lastContact: today, nextFollowUp: '' } : c))}>
                            ✓ Feito
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.5)' }}>Último contacto</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: '#1c4a35' }}>{activeContact.lastContact || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input type="date" className="p-inp" style={{ flex: 1, fontSize: '.75rem', padding: '6px 8px' }} value={activeContact.nextFollowUp || ''} onChange={e => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, nextFollowUp: e.target.value } : c))} />
                        <button className="p-btn" style={{ padding: '6px 12px', fontSize: '.44rem' }} onClick={() => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, lastContact: today } : c))}>Hoje</button>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {[1, 3, 7, 14, 30].map(d => {
                          const dt = new Date(); dt.setDate(dt.getDate() + d)
                          return (
                            <button key={d} style={{ padding: '3px 8px', background: 'rgba(14,14,13,.05)', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.5)', cursor: 'pointer' }}
                              onClick={() => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, nextFollowUp: dt.toISOString().split('T')[0] } : c))}>
                              +{d}d
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="p-card">
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '8px' }}>Deal Associado</div>
                      {activeContact.dealRef ? (
                        <div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.65rem', color: '#c9a96e', marginBottom: '4px' }}>{activeContact.dealRef}</div>
                          <button className="p-btn" style={{ padding: '6px 14px', fontSize: '.44rem', width: '100%' }} onClick={() => setSection('pipeline')}>Ver no Pipeline →</button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: 'rgba(14,14,13,.3)', marginBottom: '8px' }}>Sem deal activo</div>
                          <button className="p-btn" style={{ padding: '6px 14px', fontSize: '.44rem', width: '100%', background: 'rgba(28,74,53,.08)', color: '#1c4a35' }} onClick={() => setSection('pipeline')}>Criar Deal →</button>
                        </div>
                      )}
                    </div>
                    {/* AI Next Action */}
                    {(() => {
                      const na = getAINextAction(activeContact)
                      return (
                        <div style={{ gridColumn: '1/-1', padding: '12px 14px', background: na.urgency === 'high' ? 'rgba(224,84,84,.05)' : na.urgency === 'medium' ? 'rgba(201,169,110,.05)' : 'rgba(28,74,53,.04)', border: `1px solid ${na.urgency === 'high' ? 'rgba(224,84,84,.2)' : na.urgency === 'medium' ? 'rgba(201,169,110,.2)' : 'rgba(28,74,53,.12)'}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1rem', flexShrink: 0 }}>{na.urgency === 'high' ? '🔴' : na.urgency === 'medium' ? '🟡' : '🟢'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '2px' }}>IA · Próxima Acção</div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: na.urgency === 'high' ? '#e05454' : na.urgency === 'medium' ? '#c9a96e' : '#1c4a35', fontWeight: 600 }}>{na.text}</div>
                          </div>
                          <button className="p-btn" style={{ padding: '5px 12px', fontSize: '.42rem', flexShrink: 0, background: 'rgba(14,14,13,.06)' }} onClick={() => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, lastContact: today } : c))}>✓ Feito</button>
                        </div>
                      )
                    })()}
                    {/* Actions */}
                    <div className="p-card" style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '10px' }}>Acções Rápidas</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button className="p-btn p-btn-gold" style={{ padding: '8px 16px', fontSize: '.46rem' }} onClick={() => { setWaModalContact(activeContact.id); setWaLang((activeContact.language as typeof waLang) || 'PT'); setShowWaModal(true) }}>📱 Templates WA</button>
                        {activeContact.phone && <button className="p-btn" style={{ padding: '8px 16px', fontSize: '.46rem' }} onClick={() => window.open(`https://wa.me/${activeContact.phone.replace(/\D/g, '')}`)}>📱 WhatsApp</button>}
                        {activeContact.email && <button className="p-btn" style={{ padding: '8px 16px', fontSize: '.46rem' }} onClick={() => window.open(`mailto:${activeContact.email}`)}>✉ Email</button>}
                        <button className="p-btn" style={{ padding: '8px 16px', fontSize: '.46rem', background: 'rgba(28,74,53,.08)', color: '#1c4a35' }} onClick={() => setSection('avm')}>📊 AVM</button>
                        <button className="p-btn" style={{ padding: '8px 16px', fontSize: '.46rem', background: 'linear-gradient(135deg,#0c1f15,#1c4a35)', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)' }}
                          disabled={crmNextStepLoading}
                          onClick={async () => {
                            setCrmNextStepLoading(true); setCrmNextStep(null)
                            try {
                              const res = await fetch('/api/crm/next-step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: activeContact, deals, recentActivity: activeContact.notes }) })
                              const d = await res.json(); setCrmNextStep(d)
                            } catch { /* ignore */ } finally { setCrmNextStepLoading(false) }
                          }}>
                          {crmNextStepLoading ? '✦ A analisar...' : '✦ IA Próxima Acção'}
                        </button>
                        <button className="p-btn" style={{ padding: '8px 16px', fontSize: '.46rem', background: 'rgba(14,14,13,.06)', color: 'rgba(14,14,13,.55)', border: '1px solid rgba(14,14,13,.15)' }}
                          disabled={meetingPrepLoading}
                          onClick={async () => {
                            if (meetingPrep) { setMeetingPrep(null); return }
                            setMeetingPrepLoading(true)
                            try {
                              const res = await fetch('/api/crm/meeting-prep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: activeContact, properties: PORTAL_PROPERTIES, deals, agentName }) })
                              const d = await res.json(); if (d.briefing) setMeetingPrep(d.briefing)
                            } catch { /* ignore */ } finally { setMeetingPrepLoading(false) }
                          }}>
                          {meetingPrepLoading ? '✦ A preparar...' : meetingPrep ? '× Fechar Briefing' : '📋 Meeting Prep IA'}
                        </button>
                        <button className="p-btn" style={{ padding: '8px 16px', fontSize: '.46rem', background: 'rgba(28,74,53,.06)', color: '#1c4a35', border: '1px solid rgba(28,74,53,.2)' }}
                          disabled={emailDraftLoading}
                          onClick={async () => {
                            setEmailDraftLoading(true); setEmailDraft(null)
                            try {
                              const res = await fetch('/api/crm/email-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: activeContact, purpose: emailDraftPurpose, agentName }) })
                              const d = await res.json(); if (d.draft) setEmailDraft(d.draft)
                            } catch { /* ignore */ } finally { setEmailDraftLoading(false) }
                          }}>
                          {emailDraftLoading ? '✦ A gerar...' : '✉ Draft Email IA'}
                        </button>
                        <button className="p-btn" style={{ padding: '8px 16px', fontSize: '.46rem', background: enrichLoading === activeContact.id ? 'rgba(201,169,110,.12)' : 'rgba(201,169,110,.08)', color: '#c9a96e', border: '1px solid rgba(201,169,110,.25)' }}
                          disabled={enrichLoading === activeContact.id}
                          onClick={async () => {
                            setEnrichLoading(activeContact.id)
                            try {
                              const res = await fetch('/api/automation/lead-score', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ contact: activeContact }),
                              })
                              if (res.ok) {
                                const d = await res.json()
                                if (d.score !== undefined) {
                                  // Append enriched score to notes for persistence
                                  saveCrmContacts(crmContacts.map(c => c.id === activeContact.id
                                    ? { ...c, notes: `${c.notes ? c.notes + '\n' : ''}[Enrich ${new Date().toISOString().slice(0,10)}] Score: ${d.score}/100` }
                                    : c))
                                }
                                if (enrichToastRef.current) clearTimeout(enrichToastRef.current)
                                setEnrichToast(`✦ Score actualizado: ${d.score ?? '—'}/100`)
                                enrichToastRef.current = setTimeout(() => setEnrichToast(null), 3000)
                              }
                            } catch {
                              if (enrichToastRef.current) clearTimeout(enrichToastRef.current)
                              setEnrichToast('Score calculado localmente')
                              enrichToastRef.current = setTimeout(() => setEnrichToast(null), 2500)
                            } finally { setEnrichLoading(null) }
                          }}>
                          {enrichLoading === activeContact.id ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid #c9a96e', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                              A enriquecer...
                            </span>
                          ) : '✦ Enriquecer Lead'}
                        </button>
                        <button className="p-btn" style={{ padding: '8px 16px', fontSize: '.46rem', background: 'rgba(224,84,84,.08)', color: '#e05454', border: '1px solid rgba(224,84,84,.2)' }}
                          onClick={() => { if (confirm(`Eliminar ${activeContact.name}?`)) { saveCrmContacts(crmContacts.filter(c => c.id !== activeContact.id)); setActiveCrmId(null) } }}>
                          🗑 Eliminar
                        </button>
                      </div>
                    </div>
                    {/* AI Lead Score */}
                    {(() => {
                      const ls = computeLeadScore(activeContact)
                      return (
                        <div style={{ gridColumn: '1/-1', background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.08)', padding: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)' }}>AI Lead Score</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.8rem', color: ls.color, lineHeight: 1 }}>{ls.score}</div>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: ls.color }}>{ls.label}</div>
                            </div>
                          </div>
                          <div style={{ height: '4px', background: 'rgba(14,14,13,.08)', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
                            <div style={{ height: '100%', width: `${ls.score}%`, background: ls.score >= 80 ? '#e05454' : ls.score >= 60 ? '#c9a96e' : '#4a9c7a', borderRadius: '2px', transition: 'width .5s' }} />
                          </div>
                          {ls.breakdown.map((b, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.5)' }}>{b.factor}</span>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: b.pts >= 15 ? '#4a9c7a' : b.pts >= 8 ? '#c9a96e' : 'rgba(14,14,13,.4)' }}>+{b.pts}pts</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                    {/* IA Next Step result */}
                    {crmNextStep && (
                      <div style={{ gridColumn: '1/-1', background: 'linear-gradient(135deg,#0c1f15,#1c4a35)', border: '1px solid rgba(201,169,110,.2)', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(201,169,110,.6)' }}>✦ IA Próxima Acção</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', fontWeight: 700, color: '#c9a96e', background: 'rgba(201,169,110,.12)', padding: '2px 8px' }}>Score: {String(crmNextStep.leadScore || '—')}/100</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(244,240,230,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Acção Recomendada</div>
                            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '.95rem', color: '#f4f0e6', lineHeight: 1.4 }}>{String(crmNextStep.nextAction || '—')}</div>
                          </div>
                          <div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(244,240,230,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Canal · Timing</div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#c9a96e' }}>{String(crmNextStep.channel || '—').toUpperCase()} · {String(crmNextStep.timing || '—')}</div>
                          </div>
                        </div>
                        {!!crmNextStep.messageTemplate && (
                          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(244,240,230,.08)', padding: '10px 12px', marginBottom: '10px' }}>
                            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(244,240,230,.75)', lineHeight: 1.6 }}>{String(crmNextStep.messageTemplate)}</div>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {!!crmNextStep.messageTemplate && <button className="p-btn p-btn-gold" style={{ padding: '6px 14px', fontSize: '.42rem' }} onClick={() => window.open(`https://wa.me/${activeContact.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(String(crmNextStep.messageTemplate || ''))}`)}>💬 Enviar WA</button>}
                          <button style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(244,240,230,.12)', color: 'rgba(244,240,230,.6)', padding: '6px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer' }} onClick={() => setCrmNextStep(null)}>✕ Fechar</button>
                        </div>
                      </div>
                    )}
                    {/* Email Draft result */}
                    {emailDraft && (
                      <div style={{ gridColumn: '1/-1', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.18)', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(28,74,53,.5)' }}>✉ Draft Email IA</div>
                          <button onClick={() => setEmailDraft(null)} style={{ background: 'none', border: 'none', color: 'rgba(14,14,13,.3)', cursor: 'pointer', fontSize: '.85rem' }}>✕</button>
                        </div>
                        <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.05rem', fontWeight: 700, color: '#1c4a35', marginBottom: '14px' }}>{emailDraft.subject}</div>
                        <div style={{ background: '#fff', border: '1px solid rgba(14,14,13,.08)', padding: '16px', marginBottom: '12px' }}>
                          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(14,14,13,.75)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                            {emailDraft.greeting}{'\n\n'}{emailDraft.body}{'\n\n'}{emailDraft.cta}{'\n\n'}{emailDraft.signature}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button className="p-btn p-btn-gold" style={{ padding: '7px 16px', fontSize: '.42rem' }} onClick={() => navigator.clipboard.writeText(`${emailDraft.subject}\n\n${emailDraft.greeting}\n\n${emailDraft.body}\n\n${emailDraft.cta}\n\n${emailDraft.signature}`)}>📋 Copiar</button>
                          {activeContact.email && <button className="p-btn" style={{ padding: '7px 16px', fontSize: '.42rem' }} onClick={() => window.open(`mailto:${activeContact.email}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.greeting + '\n\n' + emailDraft.body + '\n\n' + emailDraft.cta + '\n\n' + emailDraft.signature)}`)}>✉ Abrir no Mail</button>}
                        </div>
                      </div>
                    )}
                    {/* Meeting Prep result */}
                    {meetingPrep && (
                      <div style={{ gridColumn: '1/-1', background: 'linear-gradient(135deg,#0c1f15,#1a3d2a)', padding: '18px', border: '1px solid rgba(201,169,110,.12)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)' }}>📋 Meeting Prep IA</div>
                          <button style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(244,240,230,.12)', color: 'rgba(244,240,230,.5)', padding: '4px 10px', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', cursor: 'pointer' }} onClick={() => setMeetingPrep(null)}>× Fechar</button>
                        </div>
                        <div style={{ background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.15)', padding: '10px 14px', marginBottom: '12px', fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: '#f4f0e6', lineHeight: 1.6, fontStyle: 'italic' }}>
                          &ldquo;{String(meetingPrep.openingLine)}&rdquo;
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(201,169,110,.4)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Key Insights</div>
                            {((meetingPrep.keyInsights as string[]) || []).map((ins, i) => (
                              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px' }}>
                                <span style={{ color: '#c9a96e', flexShrink: 0 }}>★</span>
                                <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.75rem', color: 'rgba(244,240,230,.6)', lineHeight: 1.4 }}>{ins}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(201,169,110,.4)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Perguntas a Fazer</div>
                            {((meetingPrep.questionsToAsk as string[]) || []).map((q, i) => (
                              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px' }}>
                                <span style={{ color: '#4a9c7a', flexShrink: 0, fontWeight: 700 }}>?</span>
                                <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.75rem', color: 'rgba(244,240,230,.6)', lineHeight: 1.4 }}>{q}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TIMELINE */}
                {crmProfileTab === 'timeline' && (
                  <div>
                    {/* Heatmap */}
                    {(() => {
                      const acts = activeContact.activities || []
                      const weeks = 12; const totalDays = weeks * 7
                      const countMap: Record<string, number> = {}
                      acts.forEach(a => { countMap[a.date] = (countMap[a.date] || 0) + 1 })
                      const cells: { date: string; count: number }[] = []
                      for (let i = totalDays - 1; i >= 0; i--) {
                        const d = new Date(); d.setDate(d.getDate() - i)
                        const ds = d.toISOString().split('T')[0]
                        cells.push({ date: ds, count: countMap[ds] || 0 })
                      }
                      const maxActs = Math.max(1, ...Object.values(countMap))
                      const getColor = (n: number) => {
                        if (n === 0) return 'rgba(14,14,13,.06)'
                        const pct = n / maxActs
                        if (pct >= .75) return '#1c4a35'; if (pct >= .5) return '#2d7a56'; if (pct >= .25) return '#4a9c7a'; return '#7abfa3'
                      }
                      return (
                        <div style={{ background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.08)', padding: '14px', marginBottom: '16px' }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Actividade — 12 semanas</div>
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks},1fr)`, gap: '2px' }}>
                            {Array.from({ length: weeks }, (_, wi) => (
                              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {cells.slice(wi * 7, wi * 7 + 7).map(cell => (
                                  <div key={cell.date} title={`${cell.date}: ${cell.count}`} style={{ width: '100%', aspectRatio: '1', background: getColor(cell.count), borderRadius: '2px' }} />
                                ))}
                              </div>
                            ))}
                          </div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.45)', marginTop: '8px' }}>{acts.length} actividades · {Object.keys(countMap).length} dias activos</div>
                        </div>
                      )
                    })()}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)' }}>Timeline de Actividades</div>
                      <button onClick={() => setShowAddActivity(!showAddActivity)}
                        style={{ padding: '6px 14px', background: 'rgba(28,74,53,.08)', color: '#1c4a35', border: '1px solid rgba(28,74,53,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer' }}>
                        + Actividade
                      </button>
                    </div>
                    {showAddActivity && (
                      <div style={{ background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.12)', padding: '14px', marginBottom: '14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                          <div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '4px' }}>Tipo</div>
                            <select className="p-sel" style={{ fontSize: '.75rem', padding: '6px 8px' }} value={newActivity.type} onChange={e => setNewActivity({ type: e.target.value as Activity['type'] })}>
                              {[['call', '📞 Chamada'], ['whatsapp', '📱 WhatsApp'], ['email', '✉ Email'], ['visit', '🏡 Visita'], ['note', '📝 Nota'], ['proposal', '📋 Proposta'], ['cpcv', '✍ CPCV']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </div>
                          <div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '4px' }}>Data</div>
                            <input type="date" className="p-inp" style={{ fontSize: '.75rem', padding: '6px 8px' }} value={newActivity.date} onChange={e => setNewActivity({ date: e.target.value })} />
                          </div>
                        </div>
                        <input className="p-inp" style={{ fontSize: '.8rem', padding: '6px 8px', marginBottom: '8px' }} placeholder="Resumo da actividade..." value={newActivity.note} onChange={e => setNewActivity({ note: e.target.value })} />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="p-btn p-btn-gold" style={{ padding: '6px 14px', fontSize: '.44rem' }}
                            onClick={() => {
                              if (!newActivity.note.trim()) return
                              const act: Activity = { id: Date.now(), ...newActivity }
                              saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, activities: [act, ...(c.activities || [])], lastContact: newActivity.date } : c))
                              setNewActivity({ type: 'call', note: '', date: today })
                              setShowAddActivity(false)
                            }}>Guardar</button>
                          <button className="p-btn" style={{ padding: '6px 12px', fontSize: '.44rem', background: 'rgba(14,14,13,.06)', color: 'rgba(14,14,13,.5)' }} onClick={() => setShowAddActivity(false)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                    {(!activeContact.activities || activeContact.activities.length === 0) ? (
                      <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed rgba(14,14,13,.1)' }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(14,14,13,.3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Sem actividades registadas</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: 0, bottom: 0, width: '1px', background: 'rgba(14,14,13,.08)' }} />
                        {activeContact.activities.map((act, i) => {
                          const icons: Record<string, string> = { call: '📞', whatsapp: '📱', email: '✉️', visit: '🏡', note: '📝', proposal: '📋', cpcv: '✍️' }
                          const colors: Record<string, string> = { call: '#1c4a35', whatsapp: '#25D366', email: '#3a7bd5', visit: '#c9a96e', note: 'rgba(14,14,13,.4)', proposal: '#c9a96e', cpcv: '#e05454' }
                          return (
                            <div key={act.id} style={{ display: 'flex', gap: '16px', paddingBottom: '16px', position: 'relative' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', border: `2px solid ${colors[act.type] || 'rgba(14,14,13,.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, fontSize: '.7rem' }}>
                                {icons[act.type] || '•'}
                              </div>
                              <div style={{ flex: 1, paddingTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.08em', textTransform: 'uppercase', color: colors[act.type] || 'rgba(14,14,13,.5)', fontWeight: 600 }}>{act.type}</span>
                                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.35)' }}>{act.date}</span>
                                </div>
                                <div style={{ fontSize: '.82rem', color: 'rgba(14,14,13,.75)', lineHeight: 1.5 }}>{act.note}</div>
                              </div>
                              <button onClick={() => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, activities: (c.activities || []).filter((_, idx) => idx !== i) } : c))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(14,14,13,.2)', fontSize: '.8rem', padding: '0 4px', flexShrink: 0 }}>×</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TASKS */}
                {crmProfileTab === 'tasks' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)' }}>Tarefas</div>
                      <button onClick={() => setShowAddTask(!showAddTask)}
                        style={{ padding: '6px 14px', background: 'rgba(28,74,53,.08)', color: '#1c4a35', border: '1px solid rgba(28,74,53,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', cursor: 'pointer' }}>
                        + Tarefa
                      </button>
                    </div>
                    {showAddTask && (
                      <div style={{ background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.12)', padding: '14px', marginBottom: '14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ gridColumn: '1/3' }}>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '4px' }}>Tarefa</div>
                            <input className="p-inp" style={{ fontSize: '.8rem', padding: '6px 8px' }} placeholder="Descreve a tarefa..." value={newTask.title} onChange={e => setNewTask({ title: e.target.value })} />
                          </div>
                          <div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '4px' }}>Prazo</div>
                            <input type="date" className="p-inp" style={{ fontSize: '.75rem', padding: '6px 8px' }} value={newTask.dueDate} onChange={e => setNewTask({ dueDate: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <select className="p-sel" style={{ fontSize: '.75rem', padding: '6px 8px' }} value={newTask.type} onChange={e => setNewTask({ type: e.target.value as Task['type'] })}>
                            {[['call', 'Chamada'], ['visit', 'Visita'], ['email', 'Email'], ['proposal', 'Proposta'], ['other', 'Outro']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="p-btn p-btn-gold" style={{ padding: '6px 14px', fontSize: '.44rem' }}
                            onClick={() => {
                              if (!newTask.title.trim()) return
                              const task: Task = { id: Date.now(), ...newTask, done: false }
                              saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, tasks: [...(c.tasks || []), task] } : c))
                              setNewTask({ title: '', dueDate: '', type: 'call' })
                              setShowAddTask(false)
                            }}>Guardar</button>
                          <button className="p-btn" style={{ padding: '6px 12px', fontSize: '.44rem', background: 'rgba(14,14,13,.06)', color: 'rgba(14,14,13,.5)' }} onClick={() => setShowAddTask(false)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                    {(!activeContact.tasks || activeContact.tasks.length === 0) ? (
                      <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed rgba(14,14,13,.1)' }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(14,14,13,.3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Sem tarefas</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {activeContact.tasks.map((task, i) => {
                          const isOverdueTask = task.dueDate && !task.done && task.dueDate < today
                          return (
                            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#fff', border: '1px solid rgba(14,14,13,.08)', opacity: task.done ? 0.5 : 1 }}>
                              <input type="checkbox" checked={task.done} onChange={e => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, tasks: (c.tasks || []).map((t, idx) => idx === i ? { ...t, done: e.target.checked } : t) } : c))} style={{ cursor: 'pointer', width: '15px', height: '15px', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '.83rem', color: '#0e0e0d', textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</div>
                                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: isOverdueTask ? '#e05454' : 'rgba(14,14,13,.35)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                  {task.type}{task.dueDate ? ` · ${isOverdueTask ? 'OVERDUE — ' : ''}${task.dueDate}` : ''}
                                </div>
                              </div>
                              <button onClick={() => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, tasks: (c.tasks || []).filter((_, idx) => idx !== i) } : c))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(14,14,13,.2)', fontSize: '.8rem' }}>×</button>
                            </div>
                          )
                        })}
                        {activeContact.tasks.filter(t => t.done).length > 0 && (
                          <button onClick={() => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, tasks: (c.tasks || []).filter(t => !t.done) } : c))}
                            style={{ marginTop: '4px', padding: '5px 12px', background: 'rgba(14,14,13,.04)', border: '1px dashed rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.35)', cursor: 'pointer', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                            Limpar concluídas ({activeContact.tasks.filter(t => t.done).length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* NOTES */}
                {crmProfileTab === 'notes' && (
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '12px' }}>Notas &amp; Histórico</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                      <button
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: voiceActive ? 'rgba(224,84,84,.1)' : 'rgba(28,74,53,.06)', border: `1px solid ${voiceActive ? 'rgba(224,84,84,.4)' : 'rgba(28,74,53,.2)'}`, fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.08em', color: voiceActive ? '#e05454' : '#1c4a35', cursor: 'pointer' }}
                        onClick={() => {
                          if (voiceActive) { setVoiceActive(false); return }
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
                          if (!SR) { alert('Browser não suporta reconhecimento de voz'); return }
                          const recognition = new SR()
                          recognition.lang = 'pt-PT'; recognition.continuous = false; recognition.interimResults = false
                          setVoiceActive(true); recognition.start()
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          recognition.onresult = (e: any) => { setVoiceText(e.results[0][0].transcript); setVoiceActive(false) }
                          recognition.onerror = () => setVoiceActive(false)
                          recognition.onend = () => setVoiceActive(false)
                        }}>
                        <span style={{ fontSize: '.8rem' }}>{voiceActive ? '⏹' : '🎤'}</span>
                        {voiceActive ? 'A gravar...' : 'Gravar nota'}
                      </button>
                      {voiceText && <button style={{ padding: '5px 10px', background: 'rgba(74,156,122,.08)', border: '1px solid rgba(74,156,122,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: '#4a9c7a', cursor: 'pointer' }} onClick={() => setVoiceText('')}>Limpar</button>}
                    </div>
                    {voiceText && (
                      <div style={{ background: 'rgba(74,156,122,.06)', border: '1px solid rgba(74,156,122,.15)', padding: '10px 12px', marginBottom: '10px', fontFamily: "'Jost',sans-serif", fontSize: '.86rem', color: 'rgba(14,14,13,.7)', lineHeight: 1.6 }}>
                        🎤 &ldquo;{voiceText}&rdquo;
                      </div>
                    )}
                    <textarea className="p-inp" style={{ minHeight: '200px', resize: 'vertical', fontSize: '.84rem', lineHeight: 1.7 }}
                      value={activeContact.notes}
                      onChange={e => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, notes: e.target.value } : c))}
                      placeholder="Adiciona notas, preferências detalhadas, histórico de visitas..." />
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.3)', marginTop: '6px' }}>Guardado automaticamente · Criado em {activeContact.createdAt}</div>
                  </div>
                )}

                {/* MATCHING */}
                {crmProfileTab === 'matching' && (
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '4px' }}>Smart Matching — Pipeline + Carteira</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.3)', marginBottom: '14px' }}>Budget ±20% · Zonas · Tipologias</div>
                    {deals.filter(d => {
                      const budget = parseFloat(d.valor.replace(/[^0-9.]/g, ''))
                      const bMin = Number(activeContact.budgetMin) || 0; const bMax = Number(activeContact.budgetMax) || 0
                      if (!bMin && !bMax) return true
                      return budget >= bMin * 0.8 && budget <= bMax * 1.2
                    }).map(d => {
                      const budget = parseFloat(d.valor.replace(/[^0-9.]/g, ''))
                      const inBudget = budget >= activeContact.budgetMin && budget <= activeContact.budgetMax
                      return (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#fff', border: '1px solid rgba(14,14,13,.08)', marginBottom: '8px', borderLeft: `3px solid ${inBudget ? '#4a9c7a' : '#c9a96e'}` }}>
                          <div>
                            <div style={{ fontSize: '.83rem', fontWeight: 500, color: '#0e0e0d' }}>{d.imovel}</div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: '#c9a96e', marginTop: '2px' }}>{d.valor} · {d.fase}</div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: inBudget ? '#4a9c7a' : '#c9a96e', marginTop: '2px' }}>{inBudget ? '✓ Budget ideal' : '~ Budget ajustado'}</div>
                          </div>
                          <button className="p-btn" style={{ padding: '6px 12px', fontSize: '.44rem' }} onClick={() => saveCrmContacts(crmContacts.map(c => c.id === activeContact.id ? { ...c, dealRef: d.ref } : c))}>Associar</button>
                        </div>
                      )
                    })}
                    {PORTAL_PROPERTIES.filter(im => {
                      const bMin = Number(activeContact.budgetMin) || 0; const bMax = Number(activeContact.budgetMax) || 0
                      const inBudget = (!bMin && !bMax) || (im.preco >= bMin * 0.8 && im.preco <= bMax * 1.2)
                      const zonaMatch = !(activeContact.zonas || []).length || (activeContact.zonas || []).some(z => im.zona?.toLowerCase().includes(z.toLowerCase()))
                      const tipoMatch = !(activeContact.tipos || []).length || (activeContact.tipos || []).some(t => im.tipo?.toLowerCase().includes(t.toLowerCase()))
                      return inBudget && (zonaMatch || tipoMatch)
                    }).slice(0, 5).map(im => (
                      <div key={im.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#fff', border: '1px solid rgba(28,74,53,.12)', marginBottom: '8px', borderLeft: '3px solid #1c4a35' }}>
                        <div>
                          <div style={{ fontSize: '.83rem', fontWeight: 500, color: '#0e0e0d' }}>{im.nome}</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: '#c9a96e', marginTop: '2px' }}>€{(im.preco / 1e6).toFixed(2)}M · {im.zona} · {im.tipo}</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.4)', marginTop: '2px' }}>{im.area}m² · T{im.quartos}</div>
                        </div>
                        <button className="p-btn" style={{ padding: '6px 12px', fontSize: '.44rem' }} onClick={() => setSection('imoveis')}>Ver →</button>
                      </div>
                    ))}
                    {deals.filter(d => { const b = parseFloat(d.valor.replace(/[^0-9.]/g, '')); const bMin = Number(activeContact.budgetMin) || 0; const bMax = Number(activeContact.budgetMax) || 0; return (!bMin && !bMax) || (b >= bMin * 0.8 && b <= bMax * 1.2) }).length === 0 &&
                      PORTAL_PROPERTIES.filter(im => { const bMin = Number(activeContact.budgetMin) || 0; const bMax = Number(activeContact.budgetMax) || 0; return (!bMin && !bMax) || (im.preco >= bMin * 0.8 && im.preco <= bMax * 1.2) }).length === 0 && (
                        <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.3)' }}>
                          Nenhum imóvel compatível encontrado com o budget definido
                        </div>
                      )}
                  </div>
                )}

                {/* POST-SALE */}
                {crmProfileTab === 'postclosing' && (
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '16px' }}>Post-Sale · Fidelização</div>
                    {[
                      { icon: '🏡', title: 'Registo Predial', desc: 'Confirmar actualização do registo predial em nome do cliente', done: false },
                      { icon: '📋', title: 'Documentação', desc: 'Entregar cópia escritura, caderneta predial, certificado energético', done: false },
                      { icon: '🔑', title: 'Entrega de Chaves', desc: 'Organizar cerimónia de entrega — fotografia, momento memorável', done: false },
                      { icon: '🏠', title: 'Gestão Imóvel', desc: 'Apresentar parceiros: decoração, remodelação, arrendamento, AL', done: false },
                      { icon: '📅', title: 'Check-in 3 Meses', desc: 'Follow-up pós-compra — satisfação e referências', done: false },
                      { icon: '⭐', title: 'Review Google', desc: 'Solicitar avaliação — chave para novos clientes', done: false },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '12px 14px', background: '#fff', border: '1px solid rgba(14,14,13,.08)', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '2px' }}>{item.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#0e0e0d', fontWeight: 600, letterSpacing: '.06em', marginBottom: '2px' }}>{item.title}</div>
                          <div style={{ fontSize: '.78rem', color: 'rgba(14,14,13,.55)', lineHeight: 1.5 }}>{item.desc}</div>
                        </div>
                        <input type="checkbox" style={{ cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0, marginTop: '2px', accentColor: '#1c4a35' }} />
                      </div>
                    ))}
                    <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.12)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: '#1c4a35', marginBottom: '8px', letterSpacing: '.08em', textTransform: 'uppercase' }}>Próximas Oportunidades</div>
                      <div style={{ fontSize: '.8rem', color: 'rgba(14,14,13,.6)', lineHeight: 1.6 }}>Cliente {activeContact.name} poderá estar interessado em investimento adicional, AL ou nova aquisição em 12–24 meses. Manter contacto trimestral.</div>
                      <button className="p-btn p-btn-gold" style={{ marginTop: '10px', padding: '8px 16px', fontSize: '.46rem' }} onClick={() => { setWaModalContact(activeContact.id); setWaLang((activeContact.language as typeof waLang) || 'PT'); setShowWaModal(true) }}>📱 Enviar Mensagem Pós-Venda</button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', fontWeight: 300, color: 'rgba(14,14,13,.3)' }}>Selecciona um contacto</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.25)', letterSpacing: '.1em' }}>{filtered.length} contacto{filtered.length !== 1 ? 's' : ''} disponíve{filtered.length !== 1 ? 'is' : 'l'}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
