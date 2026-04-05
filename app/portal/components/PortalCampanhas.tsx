'use client'
import { useState } from 'react'
import { useCRMStore } from '../stores/crmStore'
import { PORTAL_PROPERTIES } from './constants'

// ─── WA Templates (inline) ────────────────────────────────────────────────────
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
    pos_venda: { label: 'Après-Vente', msg: "Bonjour {name}! J'espère que vous adorez votre nouvelle propriété! Pour tout besoin — rénovation, décoration ou gestion — nous sommes là. Agency Group." },
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

// ─── Email Templates ───────────────────────────────────────────────────────────
const EMAIL_TEMPLATES = [
  { id: 'novo_imovel',  label: 'Novo Imóvel',    icon: '🏡', desc: 'Apresentação de novo imóvel ao cliente',          subject: 'Novo imóvel exclusivo que pode interessar — Agency Group' },
  { id: 'followup',    label: 'Follow-up',       icon: '📞', desc: 'Acompanhamento após contacto ou visita',          subject: 'A pensar em si — Agency Group' },
  { id: 'proposta',    label: 'Proposta',        icon: '📋', desc: 'Proposta formal de imóvel',                       subject: 'Proposta formal — Agency Group AMI 22506' },
  { id: 'market',      label: 'Market Update',  icon: '📊', desc: 'Actualização de mercado personalizada',            subject: 'Mercado imobiliário em Portugal — Abril 2026' },
  { id: 'cpcv',        label: 'CPCV',           icon: '✍️', desc: 'Informação sobre CPCV e próximos passos',          subject: 'CPCV — próximos passos e documentação' },
  { id: 'pos_venda',   label: 'Pós-Venda',      icon: '🎉', desc: 'Follow-up após escritura e fidelização',          subject: 'Bem-vindo ao seu novo imóvel — Agency Group' },
]

// ─── Drip Sequence Templates ───────────────────────────────────────────────────
const DRIP_SEQUENCES: Record<string, Array<{ day: number; subject: string; preview: string }>> = {
  'd1': [
    { day: 0,  subject: 'Bem-vindo à Agency Group!',               preview: 'Olá, somos a sua equipa imobiliária de confiança em Portugal...' },
    { day: 2,  subject: 'Os melhores imóveis para si',             preview: 'Seleccionámos exclusivamente os imóveis que melhor correspondem...' },
    { day: 5,  subject: 'Como funciona o processo de compra?',     preview: 'Guia completo do processo de aquisição imobiliária em Portugal...' },
    { day: 9,  subject: 'Vantagens fiscais para não residentes',   preview: 'NHR, IFICI e outras vantagens que podem beneficiá-lo...' },
    { day: 14, subject: 'Pronto para marcar uma visita?',          preview: 'Estamos disponíveis para mostrar os imóveis que mais gostou...' },
  ],
  'd2': [
    { day: 0,  subject: 'Obrigado pela visita a {property}',       preview: 'Foi um prazer mostrar-lhe este imóvel. Seguem os detalhes...' },
    { day: 2,  subject: 'Análise de mercado — {zona}',             preview: 'Para que possa tomar a melhor decisão, aqui está uma análise...' },
    { day: 5,  subject: 'Outros imóveis que podem interessar',     preview: 'Com base no seu perfil, seleccionámos estas alternativas...' },
    { day: 10, subject: 'Ainda está a considerar {property}?',     preview: 'Gostaríamos de saber se tem alguma questão que possamos esclarecer...' },
  ],
  'd3': [
    { day: 0,  subject: 'Notícias do mercado imobiliário',         preview: 'O mercado continua a valorizar — oportunidades que não deve perder...' },
    { day: 7,  subject: 'Imóveis em destaque esta semana',         preview: 'Selecção exclusiva de imóveis com potencial de valorização...' },
    { day: 21, subject: 'Posso ajudá-lo de outra forma?',          preview: 'Sei que os planos podem mudar. Se precisar de ajuda estou aqui...' },
  ],
}

// ─── Personas ─────────────────────────────────────────────────────────────────
const PERSONAS = [
  { id: 'americano',     label: '🇺🇸 Americano',     sub: 'Tech/Finance · ROI + lifestyle' },
  { id: 'frances',       label: '🇫🇷 Francês',        sub: 'Art de vivre · Fiscal' },
  { id: 'britanico',     label: '🇬🇧 Britânico',      sub: 'Investor · Post-Brexit' },
  { id: 'brasileiro',    label: '🇧🇷 Brasileiro',     sub: 'Passaporte EU · Família' },
  { id: 'hnwi',          label: '🌍 HNWI Global',    sub: 'Family office · Capital preservation' },
  { id: 'investidor_pt', label: '🇵🇹 Investidor PT', sub: 'Yield · Cap rate · ROI' },
  { id: 'emirados',      label: '🇦🇪 Emirados',       sub: 'Family office · Off-plan' },
]

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg:    '#f4f0e6',
  green: '#1c4a35',
  gold:  '#c9a96e',
  text:  '#0e0e0d',
  wa:    '#25D366',
  muted: '#7a7167',
  card:  '#ffffff',
  border:'rgba(28,74,53,.1)',
}

// ─── Utility ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export default function PortalCampanhas() {
  // ─── Local State ─────────────────────────────────────────────────────────
  const [campTab, setCampTab] = useState<'email' | 'whatsapp' | 'drip'>('email')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set())
  const [previewMode, setPreviewMode] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [waMessage, setWaMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [expandedDrip, setExpandedDrip] = useState<string | null>(null)
  const [campTopic, setCampTopic] = useState('')
  const [aiCampaign, setAiCampaign] = useState<Record<string, unknown> | null>(null)
  const [contactFilter, setContactFilter] = useState<string>('all')
  const [waLang, setWaLang] = useState<'PT' | 'EN' | 'FR' | 'DE' | 'AR'>('PT')
  const [selectedWaTemplate, setSelectedWaTemplate] = useState<string | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<string>('')
  const [selectedPersona, setSelectedPersona] = useState<string>('americano')
  const [waSendingIdx, setWaSendingIdx] = useState<number>(-1)
  const [copiedAI, setCopiedAI] = useState(false)
  const [showNewDrip, setShowNewDrip] = useState(false)
  const [newDrip, setNewDrip] = useState({ name: '', emails: '3', days: '14', goal: '' })
  const [dripCampaigns, setDripCampaigns] = useState([
    { id: 'd1', name: 'Boas-Vindas Novo Lead',    status: 'active' as 'active' | 'paused' | 'draft', emails: 5, days: 14, openRate: '42%' },
    { id: 'd2', name: 'Follow-Up Imóvel',          status: 'paused' as 'active' | 'paused' | 'draft', emails: 4, days: 10, openRate: '38%' },
    { id: 'd3', name: 'Reactivação Lead Frio',     status: 'draft'  as 'active' | 'paused' | 'draft', emails: 3, days: 21, openRate: '29%' },
  ])

  // ─── Store ────────────────────────────────────────────────────────────────
  const { crmContacts } = useCRMStore()

  // ─── Derived ─────────────────────────────────────────────────────────────
  const activeLeads = crmContacts.filter(c => c.status === 'lead' || c.status === 'prospect').length
  const filteredContacts = contactFilter === 'all'
    ? crmContacts
    : crmContacts.filter(c => c.status === contactFilter)

  const selectedContactList = crmContacts.filter(c => selectedContacts.has(c.id))

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleContact = (id: number) => {
    const next = new Set(selectedContacts)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedContacts(next)
  }

  const selectAllContacts = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)))
    }
  }

  const pickTemplate = (tplId: string) => {
    setSelectedTemplate(tplId)
    const tpl = EMAIL_TEMPLATES.find(t => t.id === tplId)
    if (tpl) setEmailSubject(tpl.subject)
    setPreviewMode(false)
    setSent(false)
  }

  const generateWithAI = async () => {
    if (!campTopic.trim()) return
    setAiGenerating(true)
    setAiCampaign(null)
    try {
      const prop = PORTAL_PROPERTIES.find(p => p.id === selectedProperty)
      const res = await fetch('/api/marketing/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: campTopic,
          property: prop ? `${prop.nome} — ${fmt(prop.preco)}` : '',
          persona: selectedPersona,
          agentName: 'Agency Group · AMI 22506',
          contacts: selectedContactList.map(c => c.name),
        }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json() as Record<string, unknown>
      setAiCampaign(data)
      if (typeof data.subject === 'string') setEmailSubject(data.subject)
      if (typeof data.body === 'string') setEmailBody(data.body)
    } catch {
      setAiCampaign({
        subject: `${campTopic} — Agency Group Portugal`,
        body: `Caro cliente,\n\nGostaríamos de partilhar consigo uma oportunidade única no mercado imobiliário português.\n\n${campTopic}\n\nEstamos ao seu dispor para qualquer questão.\n\nCom os melhores cumprimentos,\nAgency Group · AMI 22506`,
        error: 'Modo demo — ligue a API para geração real',
      })
      const err = aiCampaign as Record<string, unknown> | null
      if (err && typeof err.subject === 'string') setEmailSubject(err.subject)
      if (err && typeof err.body === 'string') setEmailBody(err.body)
    } finally {
      setAiGenerating(false)
    }
  }

  const copyAIContent = () => {
    const text = `${emailSubject}\n\n${emailBody}`
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedAI(true)
    setTimeout(() => setCopiedAI(false), 2000)
  }

  const sendEmail = async () => {
    if (selectedContacts.size === 0) return
    setSending(true)
    await new Promise(r => setTimeout(r, 1800))
    setSending(false)
    setSent(true)
  }

  const openWA = (name: string, phone: string, msg: string) => {
    const clean = phone.replace(/\s/g, '')
    const encoded = encodeURIComponent(msg.replace('{name}', name.split(' ')[0]))
    window.open(`https://wa.me/${clean}?text=${encoded}`, '_blank')
  }

  const sendWABulk = async () => {
    const contacts = selectedContactList
    for (let i = 0; i < contacts.length; i++) {
      setWaSendingIdx(i)
      const c = contacts[i]
      const tplKey = selectedWaTemplate || 'inicial'
      const tpl = WA_TEMPLATES[waLang]?.[tplKey]
      if (tpl) openWA(c.name, c.phone, tpl.msg)
      if (i < contacts.length - 1) await new Promise(r => setTimeout(r, 500))
    }
    setWaSendingIdx(-1)
  }

  const toggleDripStatus = (id: string) => {
    setDripCampaigns(prev => prev.map(d => {
      if (d.id !== id) return d
      const next = d.status === 'active' ? 'paused' : d.status === 'paused' ? 'active' : 'active'
      return { ...d, status: next }
    }))
  }

  const addDrip = () => {
    if (!newDrip.name.trim()) return
    const id = `d${Date.now()}`
    setDripCampaigns(prev => [...prev, {
      id,
      name: newDrip.name,
      status: 'draft',
      emails: parseInt(newDrip.emails) || 3,
      days: parseInt(newDrip.days) || 14,
      openRate: '—',
    }])
    setNewDrip({ name: '', emails: '3', days: '14', goal: '' })
    setShowNewDrip(false)
  }

  // ─── Status pill helper ───────────────────────────────────────────────────
  const dripPill = (status: 'active' | 'paused' | 'draft') => {
    const map = {
      active: { bg: 'rgba(28,74,53,.12)', color: '#1c4a35', label: 'Activo' },
      paused: { bg: 'rgba(201,169,110,.15)', color: '#c9a96e', label: 'Pausado' },
      draft:  { bg: 'rgba(120,120,120,.12)', color: '#888', label: 'Rascunho' },
    }
    const s = map[status]
    return (
      <span style={{ background: s.bg, color: s.color, fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {s.label}
      </span>
    )
  }

  const contactStatusPill = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      lead:     { bg: 'rgba(136,136,136,.12)', color: '#888',    label: 'Lead' },
      prospect: { bg: 'rgba(58,123,213,.1)',   color: '#3a7bd5', label: 'Prospect' },
      cliente:  { bg: 'rgba(74,156,122,.1)',   color: '#4a9c7a', label: 'Cliente' },
      vip:      { bg: 'rgba(201,169,110,.12)', color: '#c9a96e', label: 'VIP' },
    }
    const s = map[status] ?? map.lead
    return (
      <span style={{ background: s.bg, color: s.color, fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, textTransform: 'uppercase' }}>
        {s.label}
      </span>
    )
  }

  // ─── KPI Cards ────────────────────────────────────────────────────────────
  const kpis = [
    { label: 'Contactos CRM',      value: String(crmContacts.length),  sub: 'total activos' },
    { label: 'Leads Activos',       value: String(activeLeads),          sub: 'lead + prospect' },
    { label: 'Taxa Abertura Avg',   value: '42%',                        sub: 'últimas campanhas' },
    { label: 'Campanhas Enviadas',  value: '12',                         sub: 'este trimestre' },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Jost',sans-serif", color: C.text, minHeight: '100vh' }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <svg width={20} height={20} fill="none" stroke={C.gold} strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <h1 style={{ fontFamily: "'Cormorant',serif", fontSize: 26, fontWeight: 700, margin: 0, color: C.green }}>
            Campanhas
          </h1>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.gold, background: 'rgba(201,169,110,.1)', border: '1px solid rgba(201,169,110,.25)', padding: '2px 8px', borderRadius: 20, marginLeft: 4 }}>
            EMAIL · WHATSAPP · DRIP
          </span>
        </div>
        <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>
          Geração IA · Templates multilingues · Campanhas automáticas
        </p>
      </div>

      {/* ── Tab Switcher ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(28,74,53,.06)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {(['email', 'whatsapp', 'drip'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setCampTab(tab); setSent(false) }}
            style={{
              padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600,
              letterSpacing: '.04em', textTransform: 'uppercase',
              background: campTab === tab ? C.green : 'transparent',
              color: campTab === tab ? '#fff' : C.muted,
              transition: 'all .18s',
            }}
          >
            {tab === 'email' ? '✉ Email' : tab === 'whatsapp' ? '💬 WhatsApp' : '⚡ Drip'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          EMAIL TAB
      ══════════════════════════════════════════════════════════════════ */}
      {campTab === 'email' && (
        <div>
          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {kpis.map(k => (
              <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: 26, fontWeight: 700, color: C.green, lineHeight: 1 }}>
                  {k.value}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {k.label}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* 2-col layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* LEFT — Config */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* AI Generator */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 16 }}>✦</span>
                  <span style={{ fontFamily: "'Cormorant',serif", fontSize: 18, fontWeight: 700, color: C.green }}>
                    Gerador IA de Campanhas
                  </span>
                </div>

                {/* Topic */}
                <label style={{ display: 'block', fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                  Tópico da campanha
                </label>
                <input
                  className="p-inp"
                  value={campTopic}
                  onChange={e => setCampTopic(e.target.value)}
                  placeholder="Ex: Villa em Cascais exclusiva para família americana..."
                  style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
                />

                {/* Property selector */}
                <label style={{ display: 'block', fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                  Imóvel (opcional)
                </label>
                <select
                  className="p-sel"
                  value={selectedProperty}
                  onChange={e => setSelectedProperty(e.target.value)}
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <option value="">— Sem imóvel específico —</option>
                  {PORTAL_PROPERTIES.slice(0, 10).map(p => (
                    <option key={p.id} value={p.id}>{p.nome} · {fmt(p.preco)}</option>
                  ))}
                </select>

                {/* Persona selector */}
                <label style={{ display: 'block', fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                  Persona
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {PERSONAS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPersona(p.id)}
                      title={p.sub}
                      style={{
                        padding: '5px 11px', borderRadius: 20, border: `1px solid ${selectedPersona === p.id ? C.gold : C.border}`,
                        background: selectedPersona === p.id ? 'rgba(201,169,110,.12)' : 'transparent',
                        color: selectedPersona === p.id ? C.gold : C.muted,
                        fontSize: 12, cursor: 'pointer', fontFamily: "'Jost',sans-serif",
                        fontWeight: selectedPersona === p.id ? 600 : 400,
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={generateWithAI}
                  disabled={aiGenerating || !campTopic.trim()}
                  className="p-btn-gold"
                  style={{ width: '100%', opacity: aiGenerating || !campTopic.trim() ? .55 : 1 }}
                >
                  {aiGenerating ? '⟳ A gerar...' : '✦ Gerar com IA'}
                </button>

                {/* AI Result */}
                {aiCampaign && (
                  <div style={{ marginTop: 14, background: 'rgba(28,74,53,.04)', border: `1px solid rgba(28,74,53,.1)`, borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.green, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        ✦ Campanha Gerada
                      </span>
                      <button
                        onClick={copyAIContent}
                        style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: C.muted, fontFamily: "'DM Mono',monospace" }}
                      >
                        {copiedAI ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                    {typeof aiCampaign.error === 'string' && (
                      <div style={{ fontSize: 11, color: C.gold, marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>
                        ⚠ {aiCampaign.error}
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 6 }}>
                      {emailSubject}
                    </div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>
                      {emailBody}
                    </div>
                  </div>
                )}
              </div>

              {/* Email Templates */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 14 }}>
                  Templates de Email
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {EMAIL_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => pickTemplate(tpl.id)}
                      style={{
                        textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: `1px solid ${selectedTemplate === tpl.id ? C.gold : C.border}`,
                        background: selectedTemplate === tpl.id ? 'rgba(201,169,110,.08)' : 'transparent',
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                    >
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{tpl.icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 12, color: C.text, marginBottom: 2 }}>{tpl.label}</div>
                      <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4 }}>{tpl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact Selector */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: 16, fontWeight: 700, color: C.green }}>
                    Contactos
                  </div>
                  <button
                    onClick={selectAllContacts}
                    style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: C.muted, fontFamily: "'DM Mono',monospace" }}
                  >
                    {selectedContacts.size === filteredContacts.length ? 'Desselect.' : 'Select. todos'}
                  </button>
                </div>

                {/* Filter */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {['all', 'lead', 'prospect', 'cliente', 'vip'].map(f => (
                    <button
                      key={f}
                      onClick={() => setContactFilter(f)}
                      style={{
                        padding: '4px 10px', borderRadius: 20, border: `1px solid ${contactFilter === f ? C.green : C.border}`,
                        background: contactFilter === f ? C.green : 'transparent',
                        color: contactFilter === f ? '#fff' : C.muted,
                        fontSize: 10, cursor: 'pointer', fontFamily: "'DM Mono',monospace",
                        fontWeight: 600, textTransform: 'capitalize', letterSpacing: '.03em',
                      }}
                    >
                      {f === 'all' ? 'Todos' : f}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {filteredContacts.map(c => (
                    <label
                      key={c.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: selectedContacts.has(c.id) ? 'rgba(28,74,53,.04)' : 'transparent', border: `1px solid ${selectedContacts.has(c.id) ? 'rgba(28,74,53,.15)' : 'transparent'}`, transition: 'all .15s' }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(c.id)}
                        onChange={() => toggleContact(c.id)}
                        style={{ accentColor: C.green, width: 14, height: 14 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {c.name}
                          {contactStatusPill(c.status)}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{c.email} · {c.nationality}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {selectedContacts.size > 0 && (
                  <div style={{ marginTop: 10, fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.gold, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, background: C.gold, borderRadius: '50%', display: 'inline-block' }} />
                    {selectedContacts.size} contacto{selectedContacts.size !== 1 ? 's' : ''} seleccionado{selectedContacts.size !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — Preview & Send */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Subject Editor */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 14 }}>
                  Composição
                </div>
                <label className="p-label" style={{ marginBottom: 6, display: 'block' }}>Assunto</label>
                <input
                  className="p-inp"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Assunto do email..."
                  style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
                />
                <label className="p-label" style={{ marginBottom: 6, display: 'block' }}>Corpo do email</label>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Escreva o email ou use o gerador IA acima..."
                  rows={10}
                  style={{
                    width: '100%', boxSizing: 'border-box', borderRadius: 8,
                    border: `1px solid ${C.border}`, background: C.bg, padding: '10px 12px',
                    fontFamily: "'Jost',sans-serif", fontSize: 13, color: C.text,
                    resize: 'vertical', outline: 'none', lineHeight: 1.6,
                  }}
                />
              </div>

              {/* Preview Pane */}
              {previewMode && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
                    Preview Email
                  </div>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    {/* Email chrome */}
                    <div style={{ background: '#f0f0f0', padding: '8px 14px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: '#666' }}>
                        <span style={{ fontWeight: 600 }}>De:</span> Agency Group &lt;geral@agencygroup.pt&gt;
                      </div>
                      <div style={{ fontSize: 11, color: '#666' }}>
                        <span style={{ fontWeight: 600 }}>Para:</span>{' '}
                        {selectedContactList.slice(0, 3).map(c => c.email).join(', ')}
                        {selectedContactList.length > 3 && ` +${selectedContactList.length - 3} mais`}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 4 }}>
                        {emailSubject || '(sem assunto)'}
                      </div>
                    </div>
                    <div style={{ padding: 16, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: C.text, minHeight: 120 }}>
                      {emailBody || '(sem conteúdo)'}
                      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
                        Agency Group · AMI 22506 · Lisboa, Portugal
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="p-btn"
                    style={{ flex: 1 }}
                  >
                    {previewMode ? 'Fechar Preview' : '👁 Preview'}
                  </button>
                  <button
                    onClick={sendEmail}
                    disabled={sending || selectedContacts.size === 0 || !emailSubject}
                    className="p-btn-gold"
                    style={{ flex: 2, opacity: sending || selectedContacts.size === 0 || !emailSubject ? .55 : 1 }}
                  >
                    {sending
                      ? '⟳ A enviar...'
                      : sent
                        ? `✓ Enviado para ${selectedContacts.size} contacto${selectedContacts.size !== 1 ? 's' : ''}`
                        : selectedContacts.size === 0
                          ? 'Seleccione contactos'
                          : `✉ Enviar para ${selectedContacts.size} contacto${selectedContacts.size !== 1 ? 's' : ''}`
                    }
                  </button>
                </div>
                {sent && (
                  <div style={{ marginTop: 10, background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.green, fontWeight: 500 }}>
                    ✓ Campanha enviada com sucesso. Os contactos irão receber o email em breve.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          WHATSAPP TAB
      ══════════════════════════════════════════════════════════════════ */}
      {campTab === 'whatsapp' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* LEFT — Templates & Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Header */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 32, height: 32, background: C.wa, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: 18, fontWeight: 700, color: C.green }}>
                      WhatsApp Business
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>Agency Group · AMI 22506</div>
                  </div>
                </div>

                {/* Language Selector */}
                <label className="p-label" style={{ marginBottom: 8, display: 'block' }}>Idioma dos templates</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['PT', 'EN', 'FR', 'DE', 'AR'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setWaLang(lang)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, border: `1px solid ${waLang === lang ? C.wa : C.border}`,
                        background: waLang === lang ? C.wa : 'transparent',
                        color: waLang === lang ? '#fff' : C.muted,
                        fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* WA Template Cards */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 14 }}>
                  Templates · {waLang}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(WA_TEMPLATES[waLang] || {}).map(([key, tpl]) => {
                    const isSelected = selectedWaTemplate === key
                    return (
                      <div
                        key={key}
                        onClick={() => { setSelectedWaTemplate(key); setWaMessage(tpl.msg) }}
                        style={{
                          borderRadius: 10, border: `1px solid ${isSelected ? C.wa : C.border}`,
                          background: isSelected ? 'rgba(37,211,102,.04)' : 'transparent',
                          padding: '12px 14px', cursor: 'pointer', transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{tpl.label}</div>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: C.wa, background: 'rgba(37,211,102,.1)', padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase' }}>
                            {key}
                          </span>
                        </div>
                        {/* WA Bubble Preview */}
                        <div style={{
                          background: C.wa, color: '#fff', borderRadius: '12px 12px 12px 2px',
                          padding: '8px 12px', fontSize: 11, lineHeight: 1.5,
                          maxWidth: '90%', position: 'relative',
                        }}>
                          {tpl.msg.length > 100 ? tpl.msg.slice(0, 100) + '...' : tpl.msg}
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                          <button
                            onClick={e => { e.stopPropagation(); openWA('{name}', '+351000000000', tpl.msg) }}
                            style={{
                              background: C.wa, color: '#fff', border: 'none', borderRadius: 6,
                              padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono',monospace",
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="white">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            Abrir WA
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT — Multi-contact Campaign */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Message Editor */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 14 }}>
                  Mensagem Personalizada
                </div>
                <div style={{
                  background: '#e8f5e9', border: '1px solid rgba(37,211,102,.2)', borderRadius: 12,
                  padding: 14, marginBottom: 12,
                }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                    Variáveis disponíveis
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['{name}', '{agent}', '{property}', '{date}'].map(v => (
                      <span key={v} style={{ background: 'rgba(37,211,102,.15)', color: '#1a7a3a', fontFamily: "'DM Mono',monospace", fontSize: 10, padding: '2px 8px', borderRadius: 6, cursor: 'pointer' }}
                        onClick={() => setWaMessage(m => m + v)}>
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
                <textarea
                  value={waMessage}
                  onChange={e => setWaMessage(e.target.value)}
                  placeholder="Mensagem WA... ou seleccione um template à esquerda"
                  rows={5}
                  style={{
                    width: '100%', boxSizing: 'border-box', borderRadius: 8,
                    border: `1px solid ${C.border}`, background: C.bg, padding: '10px 12px',
                    fontFamily: "'Jost',sans-serif", fontSize: 13, color: C.text,
                    resize: 'vertical', outline: 'none', lineHeight: 1.6, marginBottom: 12,
                  }}
                />

                {/* Preview bubble */}
                {waMessage && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                      Preview
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{
                        background: '#dcf8c6', color: '#111', borderRadius: '12px 12px 2px 12px',
                        padding: '10px 14px', fontSize: 13, lineHeight: 1.5, maxWidth: '85%',
                        boxShadow: '0 1px 2px rgba(0,0,0,.1)',
                      }}>
                        {waMessage.replace('{name}', 'Cliente').replace('{agent}', 'Agency Group').replace('{property}', 'Villa Cascais').replace('{date}', '5 Abril')}
                        <div style={{ textAlign: 'right', fontSize: 10, color: '#999', marginTop: 4 }}>
                          {new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} ✓✓
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Select Contacts */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: 16, fontWeight: 700, color: C.green }}>
                    Destinatários WA
                  </div>
                  <button
                    onClick={selectAllContacts}
                    style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 9px', fontSize: 10, cursor: 'pointer', color: C.muted, fontFamily: "'DM Mono',monospace" }}
                  >
                    {selectedContacts.size === crmContacts.length ? 'Desselect.' : 'Todos'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {crmContacts.map(c => (
                    <label
                      key={c.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: selectedContacts.has(c.id) ? 'rgba(37,211,102,.05)' : 'transparent', border: `1px solid ${selectedContacts.has(c.id) ? 'rgba(37,211,102,.25)' : 'transparent'}` }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(c.id)}
                        onChange={() => toggleContact(c.id)}
                        style={{ accentColor: C.wa, width: 14, height: 14 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{c.phone} · {c.nationality}</div>
                      </div>
                      {contactStatusPill(c.status)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Send WA Button */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                {waSendingIdx >= 0 && (
                  <div style={{ marginBottom: 12, fontFamily: "'DM Mono',monospace", fontSize: 11, color: C.wa }}>
                    A abrir WA para {selectedContactList[waSendingIdx]?.name}... ({waSendingIdx + 1}/{selectedContactList.length})
                  </div>
                )}
                <button
                  onClick={sendWABulk}
                  disabled={selectedContacts.size === 0 || !waMessage || waSendingIdx >= 0}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: selectedContacts.size === 0 || !waMessage ? '#ccc' : C.wa,
                    color: '#fff', fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700,
                    letterSpacing: '.03em', opacity: selectedContacts.size === 0 || !waMessage ? .6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  {waSendingIdx >= 0
                    ? `A enviar ${waSendingIdx + 1}/${selectedContactList.length}...`
                    : selectedContacts.size === 0
                      ? 'Seleccione contactos'
                      : `Enviar para ${selectedContacts.size} contacto${selectedContacts.size !== 1 ? 's' : ''}`
                  }
                </button>
                {selectedContacts.size > 0 && waMessage && waSendingIdx < 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: C.muted, textAlign: 'center' }}>
                    Abre o WA para cada contacto com 500ms de intervalo
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DRIP TAB
      ══════════════════════════════════════════════════════════════════ */}
      {campTab === 'drip' && (
        <div>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: 20, fontWeight: 700, color: C.green }}>
                Drip Campaigns
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                Sequências automáticas de email para nurturing de leads
              </div>
            </div>
            <button
              onClick={() => setShowNewDrip(!showNewDrip)}
              className="p-btn-gold"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 16 }}>+</span> Nova Campanha
            </button>
          </div>

          {/* New Drip Form */}
          {showNewDrip && (
            <div style={{ background: C.card, border: `1px solid ${C.gold}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 16 }}>
                Nova Campanha Drip
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="p-label" style={{ marginBottom: 6, display: 'block' }}>Nome da campanha</label>
                  <input
                    className="p-inp"
                    value={newDrip.name}
                    onChange={e => setNewDrip(d => ({ ...d, name: e.target.value }))}
                    placeholder="Ex: Reactivação Q2 2026"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label className="p-label" style={{ marginBottom: 6, display: 'block' }}>N.º de emails</label>
                  <input
                    className="p-inp"
                    type="number"
                    min="1"
                    max="20"
                    value={newDrip.emails}
                    onChange={e => setNewDrip(d => ({ ...d, emails: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label className="p-label" style={{ marginBottom: 6, display: 'block' }}>Duração (dias)</label>
                  <input
                    className="p-inp"
                    type="number"
                    min="1"
                    value={newDrip.days}
                    onChange={e => setNewDrip(d => ({ ...d, days: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="p-label" style={{ marginBottom: 6, display: 'block' }}>Objectivo</label>
                <input
                  className="p-inp"
                  value={newDrip.goal}
                  onChange={e => setNewDrip(d => ({ ...d, goal: e.target.value }))}
                  placeholder="Ex: Converter leads frios em visitas"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={addDrip} className="p-btn-gold" disabled={!newDrip.name.trim()}>
                  Criar Campanha
                </button>
                <button onClick={() => setShowNewDrip(false)} className="p-btn">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Drip List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dripCampaigns.map(drip => {
              const isExpanded = expandedDrip === drip.id
              const sequence = DRIP_SEQUENCES[drip.id] || []

              return (
                <div
                  key={drip.id}
                  style={{ background: C.card, border: `1px solid ${isExpanded ? C.gold : C.border}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .2s' }}
                >
                  {/* Drip Header */}
                  <div
                    style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                    onClick={() => setExpandedDrip(isExpanded ? null : drip.id)}
                  >
                    {/* Toggle icon */}
                    <div style={{ color: C.muted, transition: 'transform .2s', transform: isExpanded ? 'rotate(90deg)' : 'none', fontSize: 14 }}>
                      ▶
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{drip.name}</span>
                        {dripPill(drip.status)}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.muted }}>
                        <span>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: C.green }}>{drip.emails}</span> emails
                        </span>
                        <span>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: C.green }}>{drip.days}</span> dias
                        </span>
                        <span>
                          Taxa abertura: <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: C.gold }}>{drip.openRate}</span>
                        </span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => toggleDripStatus(drip.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 8, border: `1px solid ${drip.status === 'active' ? C.border : C.green}`,
                          background: drip.status === 'active' ? 'transparent' : C.green,
                          color: drip.status === 'active' ? C.muted : '#fff',
                          fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontWeight: 600,
                        }}
                      >
                        {drip.status === 'active' ? '⏸ Pausar' : '▶ Activar'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded — Email Sequence */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 20px', background: 'rgba(28,74,53,.02)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 16 }}>
                        Sequência de Emails
                      </div>

                      {sequence.length > 0 ? (
                        <div style={{ position: 'relative' }}>
                          {/* Timeline line */}
                          <div style={{ position: 'absolute', left: 16, top: 20, bottom: 20, width: 2, background: 'rgba(28,74,53,.1)' }} />

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {sequence.map((step, i) => (
                              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', paddingLeft: 4 }}>
                                {/* Timeline dot */}
                                <div style={{
                                  width: 26, height: 26, borderRadius: '50%',
                                  background: i === 0 ? C.green : 'rgba(28,74,53,.1)',
                                  border: `2px solid ${i === 0 ? C.green : 'rgba(28,74,53,.2)'}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexShrink: 0, zIndex: 1,
                                }}>
                                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: i === 0 ? '#fff' : C.muted, fontWeight: 700 }}>
                                    {i + 1}
                                  </span>
                                </div>

                                <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{step.subject}</div>
                                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.gold, background: 'rgba(201,169,110,.1)', padding: '2px 8px', borderRadius: 10 }}>
                                      Dia {step.day}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
                                    {step.preview}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 13 }}>
                          Sequência personalizada — configure os emails desta campanha
                        </div>
                      )}

                      {/* Stats row for active/paused */}
                      {drip.status !== 'draft' && (
                        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                          {[
                            { label: 'Enviados',   value: drip.status === 'active' ? '124' : '89' },
                            { label: 'Abertos',    value: drip.openRate },
                            { label: 'Cliques',    value: '18%' },
                            { label: 'Conversões', value: '6%' },
                          ].map(s => (
                            <div key={s.label} style={{ background: C.bg, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                              <div style={{ fontFamily: "'Cormorant',serif", fontSize: 20, fontWeight: 700, color: C.green }}>{s.value}</div>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Summary Footer */}
          <div style={{ marginTop: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, textAlign: 'center' }}>
              <div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: 28, fontWeight: 700, color: C.green }}>
                  {dripCampaigns.filter(d => d.status === 'active').length}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Activas
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: 28, fontWeight: 700, color: C.gold }}>
                  {dripCampaigns.reduce((a, d) => a + d.emails, 0)}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Total Emails
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: 28, fontWeight: 700, color: C.green }}>
                  38%
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Avg Open Rate
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
