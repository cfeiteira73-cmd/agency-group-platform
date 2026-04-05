'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useCRMStore } from '../stores/crmStore'

// SpeechRecognition type helper — use unknown cast to handle browser SR types
type SRResultCast = { isFinal: boolean; 0: { transcript: string } }

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
  bg:     '#f4f0e6',
  green:  '#1c4a35',
  gold:   '#c9a96e',
  text:   '#0e0e0d',
  muted:  '#7a7167',
  card:   '#ffffff',
  border: 'rgba(28,74,53,.1)',
  red:    '#e05454',
  blue:   '#3b6fd4',
}

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = 'ditado' | 'visitas' | 'comandos' | 'transcricoes'
type VozLanguage = 'pt-PT' | 'en-US' | 'fr-FR' | 'es-ES'
type IntentType = 'nota_visita' | 'follow_up' | 'proposta' | 'tarefa' | 'desconhecido'
type TranscriptType = 'ditado' | 'visita' | 'comando'

interface AIProcessResult {
  intent: IntentType
  summary: string
  actionItems: string[]
  followUpDate?: string
  contactName?: string
  urgency: 'alta' | 'media' | 'baixa'
  sentiment: 'positivo' | 'neutro' | 'negativo'
}

interface VozTranscript {
  id: string
  date: string
  duration: number
  text: string
  type: TranscriptType
  language: VozLanguage
  wordCount: number
  aiResult?: AIProcessResult
}

interface VisitNote {
  id: string
  propertyId: string
  propertyName: string
  buyerName: string
  date: string
  time: string
  transcript: string
  reaction: string
  objections: string[]
  interest: number
  nextStep: string
  createdAt: string
}

interface VoiceCommand {
  id: string
  command: string
  pattern: string
  example: string
  icon: string
  action: string
  result?: string
  executedAt?: string
}

interface CommandHistoryEntry {
  id: string
  raw: string
  matched: string
  result: string
  executedAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LANGUAGE_OPTIONS: { value: VozLanguage; label: string; flag: string }[] = [
  { value: 'pt-PT', label: 'PT', flag: '🇵🇹' },
  { value: 'en-US', label: 'EN', flag: '🇺🇸' },
  { value: 'fr-FR', label: 'FR', flag: '🇫🇷' },
  { value: 'es-ES', label: 'ES', flag: '🇪🇸' },
]

const MOCK_PROPERTIES = [
  { id: 'p1',  name: 'Quinta das Pedras, Cascais',          price: 1850000 },
  { id: 'p2',  name: 'Penthouse Avenida da Liberdade, Lisboa', price: 3200000 },
  { id: 'p3',  name: 'Villa Vale do Lobo, Algarve',         price: 2750000 },
  { id: 'p4',  name: 'Apartamento Bairro Alto, Lisboa',     price: 890000  },
  { id: 'p5',  name: 'Moradia Estoril, Cascais',            price: 1450000 },
  { id: 'p6',  name: 'Quinta Douro, Porto',                 price: 680000  },
  { id: 'p7',  name: 'Apartamento Foz do Douro, Porto',     price: 745000  },
  { id: 'p8',  name: 'Villa Funchal, Madeira',              price: 920000  },
  { id: 'p9',  name: 'Herdade Comporta, Setúbal',           price: 4100000 },
  { id: 'p10', name: 'Palacete Sintra',                     price: 5800000 },
]

const INTENT_LABELS: Record<IntentType, string> = {
  nota_visita:  'Nota de Visita',
  follow_up:    'Follow-Up',
  proposta:     'Proposta',
  tarefa:       'Tarefa',
  desconhecido: 'Geral',
}

const INTENT_COLORS: Record<IntentType, string> = {
  nota_visita:  C.green,
  follow_up:    C.gold,
  proposta:     '#7c5cbf',
  tarefa:       C.blue,
  desconhecido: C.muted,
}

const MOCK_COMMANDS: VoiceCommand[] = [
  {
    id: 'cmd1', icon: '👤',
    command: 'Criar lead',
    pattern: 'criar lead [nome] [budget]',
    example: '"Criar lead João Silva 500 mil"',
    action: 'Cria entrada no CRM com nome e budget',
  },
  {
    id: 'cmd2', icon: '🏡',
    command: 'Agendar visita',
    pattern: 'agendar visita [imóvel] [data]',
    example: '"Agendar visita Cascais sexta"',
    action: 'Cria entrada na agenda com imóvel e data',
  },
  {
    id: 'cmd3', icon: '📋',
    command: 'Enviar proposta',
    pattern: 'enviar proposta para [nome]',
    example: '"Enviar proposta para Maria Santos"',
    action: 'Activa rascunho de proposta formal',
  },
  {
    id: 'cmd4', icon: '📊',
    command: 'Resumo do dia',
    pattern: 'resumo do dia',
    example: '"Resumo do dia"',
    action: 'IA gera resumo das actividades do dia',
  },
  {
    id: 'cmd5', icon: '📞',
    command: 'Nota de chamada',
    pattern: 'nota de chamada [nome]',
    example: '"Nota de chamada Carlos Silva"',
    action: 'Abre dictado de nota ligado ao contacto',
  },
  {
    id: 'cmd6', icon: '🔔',
    command: 'Follow-up',
    pattern: 'follow-up [nome] [quando]',
    example: '"Follow-up João amanhã às 10h"',
    action: 'Cria lembrete de follow-up no CRM',
  },
]

const MOCK_VISIT_NOTES: VisitNote[] = [
  {
    id: 'v1',
    propertyId: 'p1', propertyName: 'Quinta das Pedras, Cascais',
    buyerName: 'David Thompson', date: '2026-04-04', time: '10:30',
    transcript: 'Cliente muito entusiasmado com a vista e o jardim. Perguntou sobre possibilidade de pool adicional. Esposa adorou a cozinha. Preocupação com o preço mas interesse real.',
    reaction: 'Muito positiva — casal entusiasmado especialmente com as vistas para o mar e jardim privado.',
    objections: ['Preço acima do budget inicial', 'Distância para Lisboa centro', 'Custos de manutenção'],
    interest: 4,
    nextStep: 'Enviar comparação com imóveis similares + análise custos manutenção. Follow-up terça.',
    createdAt: '2026-04-04T12:00:00Z',
  },
  {
    id: 'v2',
    propertyId: 'p2', propertyName: 'Penthouse Avenida da Liberdade, Lisboa',
    buyerName: 'Marie Dubois', date: '2026-04-03', time: '15:00',
    transcript: 'Cliente francesa, family office. Impressionada com a localização e acabamentos. Quer análise de rentabilidade para arrendamento. Prazo de decisão até fim de Abril.',
    reaction: 'Positiva mas calculista — foco em retorno do investimento acima da componente emocional.',
    objections: ['Yield de arrendamento esperado mais alto', 'IMT e custos de aquisição'],
    interest: 3,
    nextStep: 'Preparar análise de yield com comparáveis de arrendamento na Avenida. Enviar até 6 Abril.',
    createdAt: '2026-04-03T16:30:00Z',
  },
  {
    id: 'v3',
    propertyId: 'p9', propertyName: 'Herdade Comporta, Setúbal',
    buyerName: 'James & Sarah Hartley', date: '2026-04-01', time: '11:00',
    transcript: 'Casal britânico, reform capital. Adoraram a natureza e privacidade. Preocupação com infraestrutura local. Muito interessados mas querem segunda visita com arquitecto.',
    reaction: 'Extremamente positiva — já a imaginar como casa principal de reforma.',
    objections: ['Infraestrutura local limitada', 'Internet e conectividade', 'Acesso médico próximo'],
    interest: 5,
    nextStep: 'Marcar segunda visita com arquitecto parceiro para semana 15. Enviar info sobre Comporta infrastructure upgrades 2026.',
    createdAt: '2026-04-01T13:00:00Z',
  },
  {
    id: 'v4',
    propertyId: 'p4', propertyName: 'Apartamento Bairro Alto, Lisboa',
    buyerName: 'Pedro Menezes', date: '2026-03-28', time: '14:00',
    transcript: 'Investidor local, quarto investimento. Foco em yield e liquidez. Análise fria, sem emoção. Quer ver mais 2-3 opções antes de decidir.',
    reaction: 'Neutro — análise puramente financeira sem envolvimento emocional.',
    objections: ['Yield abaixo de 5%', 'Concorrência com outros APTs no mesmo edifício', 'Prazo de escritura'],
    interest: 2,
    nextStep: 'Seleccionar 3 alternativas com yield 5%+ em Lisboa. Apresentar na semana seguinte.',
    createdAt: '2026-03-28T15:30:00Z',
  },
  {
    id: 'v5',
    propertyId: 'p3', propertyName: 'Villa Vale do Lobo, Algarve',
    buyerName: 'Abdullah Al-Rashidi', date: '2026-03-25', time: '10:00',
    transcript: 'Family office Emirados. Visita rápida, muito selectiva. Gostou do condomínio e segurança. Quer comparação com outras villas de golf na zona. Budget sem restrições.',
    reaction: 'Moderadamente positiva — critérios muito específicos de segurança e exclusividade.',
    objections: ['Condomínio não suficientemente exclusivo', 'Piscina precisa renovação'],
    interest: 3,
    nextStep: 'Apresentar comparação Vale do Lobo vs Quinta do Lago vs Vilamoura. Meeting zoom 7 Abril.',
    createdAt: '2026-03-25T11:30:00Z',
  },
]

const MOCK_TRANSCRIPTS: VozTranscript[] = [
  {
    id: 'tr1', date: '2026-04-04T12:00:00Z', duration: 142, type: 'visita', language: 'pt-PT', wordCount: 87,
    text: 'Cliente David Thompson muito entusiasmado com a Quinta das Pedras. Vista para o mar excepcional. Jardim privado foi o grande ponto de interesse. Esposa adorou a cozinha remodelada. Preocupação principal com o preço — 1.85M acima do budget inicial de 1.5M. Perguntou sobre possibilidade de instalar piscina adicional. Interesse real, follow-up urgente com comparação de preços.',
    aiResult: { intent: 'nota_visita', summary: 'Visita positiva — cliente interessado com objecção de preço', actionItems: ['Enviar análise de comparáveis', 'Orçamento para piscina adicional', 'Follow-up terça 10h'], urgency: 'alta', sentiment: 'positivo' },
  },
  {
    id: 'tr2', date: '2026-04-03T16:00:00Z', duration: 89, type: 'ditado', language: 'pt-PT', wordCount: 54,
    text: 'Nota para seguimento da Marie Dubois. Interessada no Penthouse da Avenida da Liberdade. Preciso de preparar análise de yield com dados de arrendamento comparáveis na zona. Prazo até sexta-feira 6 de Abril. Contactar gestor do condomínio para dados de arrendamentos recentes.',
    aiResult: { intent: 'follow_up', summary: 'Follow-up análise yield Penthouse Liberdade para Marie Dubois', actionItems: ['Análise yield até sexta', 'Contactar gestor condomínio', 'Enviar dados arrendamento'], urgency: 'alta', sentiment: 'neutro', followUpDate: '2026-04-06' },
  },
  {
    id: 'tr3', date: '2026-04-02T09:30:00Z', duration: 34, type: 'comando', language: 'pt-PT', wordCount: 12,
    text: 'Criar lead James Hartley budget dois milhões Algarve',
    aiResult: { intent: 'tarefa', summary: 'Novo lead criado: James Hartley', actionItems: ['Lead criado no CRM'], urgency: 'media', sentiment: 'positivo', contactName: 'James Hartley' },
  },
  {
    id: 'tr4', date: '2026-04-01T13:15:00Z', duration: 215, type: 'visita', language: 'pt-PT', wordCount: 134,
    text: 'Visita incrível na Herdade da Comporta com os Hartley. Casal britânico absolutamente apaixonado pelo lugar. Sarah disse que era o imóvel dos sonhos deles. James preocupado com infraestrutura mas admitiu que o espaço era único. Pediram segunda visita com arquitecto para confirmar possibilidades de remodelação. Prazo de decisão: 3 semanas. Budget confirmado 4.5M máximo.',
    aiResult: { intent: 'nota_visita', summary: 'Visita muito positiva — segundo encontro a confirmar', actionItems: ['Marcar visita com arquitecto', 'Info infrastructure Comporta', 'Follow-up semana 15'], urgency: 'alta', sentiment: 'positivo' },
  },
  {
    id: 'tr5', date: '2026-03-28T15:45:00Z', duration: 67, type: 'ditado', language: 'pt-PT', wordCount: 41,
    text: 'Lembrete: preparar proposta consolidada para apresentar ao Pedro Menezes. Incluir três alternativas de investimento com yield acima de 5% em Lisboa. Bairro Alto, Príncipe Real e Santos. Comparação de cap rates e histórico de valorizações.',
    aiResult: { intent: 'proposta', summary: 'Proposta multi-opção para Pedro Menezes', actionItems: ['3 opções yield 5%+', 'Cap rate comparison', 'Histórico valorizações'], urgency: 'media', sentiment: 'neutro', contactName: 'Pedro Menezes' },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

// ─── SVG Waveform ─────────────────────────────────────────────────────────────
function WaveformSVG({ recording, animated }: { recording: boolean; animated: boolean }) {
  const bars = 8
  const heights = [30, 55, 42, 70, 35, 60, 45, 38]
  return (
    <svg viewBox="0 0 120 80" style={{ width: 120, height: 56 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const x = 8 + i * 14
        const baseH = heights[i]
        const animClass = animated && recording ? `waveBar waveBar${i}` : ''
        return (
          <rect
            key={i}
            x={x} y={40 - baseH / 2} width={8} height={baseH}
            rx={4} fill={recording ? C.green : C.muted}
            fillOpacity={recording ? 0.85 : 0.3}
            className={animClass}
            style={
              animated && recording
                ? { animationDelay: `${i * 80}ms`, animationDuration: `${500 + i * 60}ms` }
                : {}
            }
          />
        )
      })}
    </svg>
  )
}

// ─── Interest Arc SVG ─────────────────────────────────────────────────────────
function InterestArc({ level }: { level: number }) {
  const r = 22; const cx = 30; const cy = 30
  const maxAngle = 220
  const angle = (level / 5) * maxAngle
  const startAngle = -200 * (Math.PI / 180)
  const endAngle = startAngle + angle * (Math.PI / 180)
  const bgEnd = startAngle + maxAngle * (Math.PI / 180)
  const arcPath = (a1: number, a2: number) =>
    `M ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} A ${r} ${r} 0 ${(a2 - a1 > Math.PI ? 1 : 0)} 1 ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)}`
  const col = level >= 4 ? C.green : level === 3 ? C.gold : C.red
  return (
    <svg viewBox="0 0 60 60" style={{ width: 52, height: 52 }}>
      <path d={arcPath(startAngle, bgEnd)} fill="none" stroke={C.border} strokeWidth={5} strokeLinecap="round" />
      <path d={arcPath(startAngle, endAngle)} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontWeight="bold" fill={col} fontFamily="Cormorant">{level}</text>
      <text x={cx} y={cy + 17} textAnchor="middle" fontSize={7} fill={C.muted} fontFamily="DM Mono">/5</text>
    </svg>
  )
}

// ─── Mock AI processing ───────────────────────────────────────────────────────
async function mockProcessVoz(text: string, intent?: IntentType): Promise<AIProcessResult> {
  await new Promise(r => setTimeout(r, 1400))
  try {
    const res = await fetch('/api/voz/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error()
    return await res.json() as AIProcessResult
  } catch {
    const lc = text.toLowerCase()
    const detectedIntent: IntentType =
      intent ??
      (lc.includes('visit') || lc.includes('imóvel') || lc.includes('casa') ? 'nota_visita' :
       lc.includes('follow') || lc.includes('contactar') || lc.includes('ligar') ? 'follow_up' :
       lc.includes('proposta') || lc.includes('oferta') ? 'proposta' :
       lc.includes('tarefa') || lc.includes('criar') || lc.includes('lembrar') ? 'tarefa' :
       'desconhecido')
    return {
      intent: detectedIntent,
      summary: text.slice(0, 80) + (text.length > 80 ? '...' : ''),
      actionItems: ['Rever conteúdo transcrito', 'Confirmar dados com cliente', 'Actualizar CRM'],
      urgency: 'media',
      sentiment: lc.includes('positiv') || lc.includes('gostar') || lc.includes('adorar') ? 'positivo' : 'neutro',
    }
  }
}

// ─── Tab: Ditado Inteligente ──────────────────────────────────────────────────
function TabDitado() {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [lang, setLang] = useState<VozLanguage>('pt-PT')
  const [seconds, setSeconds] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<AIProcessResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [transcripts, setTranscripts] = useState<VozTranscript[]>(() => {
    if (typeof window === 'undefined') return MOCK_TRANSCRIPTS
    try {
      const s = localStorage.getItem('ag_voz_transcripts')
      return s ? (JSON.parse(s) as VozTranscript[]) : MOCK_TRANSCRIPTS
    } catch { return MOCK_TRANSCRIPTS }
  })

  const recognitionRef = useRef<unknown>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef = useRef('')
  const transcriptAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem('ag_voz_transcripts', JSON.stringify(transcripts.slice(0, 20))) } catch {}
  }, [transcripts])

  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [recording])

  useEffect(() => {
    if (transcriptAreaRef.current) {
      transcriptAreaRef.current.scrollTop = transcriptAreaRef.current.scrollHeight
    }
  }, [transcript, interim])

  function startRecording() {
    setError(null)
    setTranscript('')
    setInterim('')
    transcriptRef.current = ''
    setResult(null)
    setSeconds(0)

    const SR = (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      ?? (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition

    if (!SR) {
      setError('O teu browser não suporta reconhecimento de voz. Usa Chrome ou Edge.')
      return
    }

    const recognition = new (SR as new () => {
      lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
      start(): void; stop(): void;
      onresult: ((e: { resultIndex: number; results: { isFinal: boolean; [i: number]: { transcript: string }[] }[] }) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
    })()

    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (e) => {
      let final = ''
      let int = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i] as unknown as SRResultCast
        if (r.isFinal) final += r[0].transcript + ' '
        else int += r[0].transcript
      }
      if (final) {
        transcriptRef.current += final
        setTranscript(transcriptRef.current)
      }
      setInterim(int)
    }

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') setError(`Erro: ${e.error}`)
      setRecording(false)
    }

    recognition.onend = () => setRecording(false)

    recognition.start()
    recognitionRef.current = recognition
    setRecording(true)
  }

  function stopRecording() {
    const r = recognitionRef.current as { stop?: () => void } | null
    if (r?.stop) r.stop()
    setRecording(false)
    setInterim('')
  }

  async function handleProcess() {
    if (!transcript.trim()) return
    setProcessing(true)
    const res = await mockProcessVoz(transcript)
    setResult(res)
    setProcessing(false)

    const entry: VozTranscript = {
      id: `tr${Date.now()}`,
      date: new Date().toISOString(),
      duration: seconds,
      text: transcript,
      type: 'ditado',
      language: lang,
      wordCount: transcript.split(/\s+/).filter(Boolean).length,
      aiResult: res,
    }
    setTranscripts(prev => [entry, ...prev])
  }

  const URGENCY_COLORS = { alta: C.red, media: C.gold, baixa: C.green }
  const SENTIMENT_COLORS = { positivo: C.green, neutro: C.muted, negativo: C.red }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Language selector */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: C.muted }}>Idioma:</span>
        {LANGUAGE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setLang(opt.value)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontFamily: 'DM Mono', fontSize: 12, cursor: 'pointer',
              border: `1.5px solid ${lang === opt.value ? C.green : C.border}`,
              background: lang === opt.value ? C.green + '12' : 'transparent',
              color: lang === opt.value ? C.green : C.muted,
              fontWeight: lang === opt.value ? 700 : 400,
            }}
          >
            {opt.flag} {opt.label}
          </button>
        ))}
      </div>

      {/* Main recording area */}
      <div className="p-card" style={{ padding: '32px', textAlign: 'center' }}>
        {/* Waveform */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <WaveformSVG recording={recording} animated={recording} />
        </div>

        {/* Timer */}
        <div style={{ fontFamily: 'DM Mono', fontSize: 13, color: C.muted, marginBottom: 24 }}>
          {recording ? (
            <span style={{ color: C.red }}>● {formatDuration(seconds)}</span>
          ) : seconds > 0 ? (
            <span>{formatDuration(seconds)} gravado</span>
          ) : (
            <span>Pronto para gravar</span>
          )}
        </div>

        {/* Mic button */}
        <button
          onClick={recording ? stopRecording : startRecording}
          style={{
            width: 88, height: 88, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: recording ? C.red : C.green,
            color: '#fff', fontSize: 32,
            boxShadow: recording
              ? `0 0 0 12px ${C.red}20, 0 0 0 24px ${C.red}0c`
              : `0 4px 20px ${C.green}40`,
            transition: 'all .25s',
            animation: recording ? 'micPulse 1.5s ease-in-out infinite' : 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {recording ? '⏹' : '🎙'}
        </button>

        <div style={{ marginTop: 14, fontFamily: 'DM Mono', fontSize: 11, color: C.muted }}>
          {recording ? 'Clique para parar' : 'Clique para gravar'}
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: '10px 16px', background: C.red + '10', border: `1px solid ${C.red}30`, borderRadius: 8, fontFamily: 'DM Mono', fontSize: 12, color: C.red }}>
            {error}
          </div>
        )}
      </div>

      {/* Transcript display */}
      {(transcript || interim) && (
        <div className="p-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontFamily: 'Cormorant', fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>Transcrição</h3>
            <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: C.muted }}>
              {transcript.split(/\s+/).filter(Boolean).length} palavras
            </span>
          </div>
          <div
            ref={transcriptAreaRef}
            style={{
              minHeight: 80, maxHeight: 200, overflowY: 'auto',
              fontFamily: 'Jost', fontSize: 14, color: C.text, lineHeight: 1.7,
              padding: '12px', background: C.bg, borderRadius: 8,
            }}
          >
            {transcript}
            {interim && <span style={{ color: C.muted, fontStyle: 'italic' }}>{interim}</span>}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button
              className="p-btn-gold"
              onClick={handleProcess}
              disabled={processing || !transcript.trim()}
              style={{ flex: 1, padding: '12px', opacity: !transcript.trim() ? 0.5 : 1 }}
            >
              {processing ? 'A processar com IA...' : '✦ Processar com IA'}
            </button>
            <button
              className="p-btn"
              onClick={() => { setTranscript(''); setInterim(''); setResult(null); setSeconds(0) }}
              style={{ padding: '12px 16px' }}
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* AI result */}
      {result && (
        <div className="p-card" style={{ padding: '20px', border: `1.5px solid ${INTENT_COLORS[result.intent]}30` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontFamily: 'Cormorant', fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
              Análise IA
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{
                background: INTENT_COLORS[result.intent] + '18', color: INTENT_COLORS[result.intent],
                fontFamily: 'DM Mono', fontSize: 10, padding: '3px 10px', borderRadius: 99,
              }}>{INTENT_LABELS[result.intent]}</span>
              <span style={{
                background: URGENCY_COLORS[result.urgency] + '18', color: URGENCY_COLORS[result.urgency],
                fontFamily: 'DM Mono', fontSize: 10, padding: '3px 10px', borderRadius: 99,
              }}>Urgência: {result.urgency}</span>
              <span style={{
                background: SENTIMENT_COLORS[result.sentiment] + '18', color: SENTIMENT_COLORS[result.sentiment],
                fontFamily: 'DM Mono', fontSize: 10, padding: '3px 10px', borderRadius: 99,
              }}>{result.sentiment}</span>
            </div>
          </div>
          <p style={{ fontFamily: 'Jost', fontSize: 14, color: C.text, lineHeight: 1.6, margin: '0 0 16px' }}>
            <strong>Resumo:</strong> {result.summary}
          </p>
          {result.actionItems.length > 0 && (
            <div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: C.muted, marginBottom: 8 }}>PRÓXIMOS PASSOS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.actionItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: C.green, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontFamily: 'Jost', fontSize: 13, color: C.text }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.followUpDate && (
            <div style={{ marginTop: 12, fontFamily: 'DM Mono', fontSize: 11, color: C.gold }}>
              📅 Follow-up: {new Date(result.followUpDate).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Notas de Visita ─────────────────────────────────────────────────────
function TabVisitas() {
  const [visitNotes, setVisitNotes] = useState<VisitNote[]>(MOCK_VISIT_NOTES)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [recording, setRecording] = useState(false)
  const [noteTranscript, setNoteTranscript] = useState('')
  const [noteInterim, setNoteInterim] = useState('')
  const [noteSeconds, setNoteSeconds] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [formProperty, setFormProperty] = useState(MOCK_PROPERTIES[0].id)
  const [formBuyer, setFormBuyer] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formTime, setFormTime] = useState('10:00')

  const recRef = useRef<unknown>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef = useRef('')

  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => setNoteSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [recording])

  function startNoteRecording() {
    setNoteTranscript(''); setNoteInterim(''); setNoteSeconds(0)
    transcriptRef.current = ''

    const SR = (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      ?? (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    if (!SR) return

    const recognition = new (SR as new () => {
      lang: string; continuous: boolean; interimResults: boolean;
      start(): void; stop(): void;
      onresult: ((e: { resultIndex: number; results: { isFinal: boolean; [i: number]: { transcript: string }[] }[] }) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
    })()
    recognition.lang = 'pt-PT'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e) => {
      let final = ''; let int = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i] as unknown as SRResultCast
        if (r.isFinal) final += r[0].transcript + ' '
        else int += r[0].transcript
      }
      if (final) { transcriptRef.current += final; setNoteTranscript(transcriptRef.current) }
      setNoteInterim(int)
    }
    recognition.onerror = () => setRecording(false)
    recognition.onend = () => setRecording(false)
    recognition.start()
    recRef.current = recognition
    setRecording(true)
  }

  function stopNoteRecording() {
    const r = recRef.current as { stop?: () => void } | null
    if (r?.stop) r.stop()
    setRecording(false); setNoteInterim('')
  }

  async function handleSaveNote() {
    if (!formBuyer || !noteTranscript) return
    setProcessing(true)
    const ai = await mockProcessVoz(noteTranscript, 'nota_visita')
    const prop = MOCK_PROPERTIES.find(p => p.id === formProperty)!
    const note: VisitNote = {
      id: `v${Date.now()}`,
      propertyId: formProperty,
      propertyName: prop.name,
      buyerName: formBuyer,
      date: formDate,
      time: formTime,
      transcript: noteTranscript,
      reaction: ai.summary,
      objections: ai.actionItems.slice(0, 2).map(a => a.replace(/^(rever|confirmar|actualizar)\s/i, '')),
      interest: ai.sentiment === 'positivo' ? 4 : ai.sentiment === 'neutro' ? 3 : 2,
      nextStep: ai.actionItems[0] ?? 'A definir',
      createdAt: new Date().toISOString(),
    }
    setVisitNotes(prev => [note, ...prev])
    setProcessing(false)
    setShowForm(false)
    setNoteTranscript(''); setFormBuyer(''); setNoteSeconds(0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'Cormorant', fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>Notas de Visita</h2>
          <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: C.muted, margin: 0 }}>{visitNotes.length} notas gravadas</p>
        </div>
        <button
          className="p-btn-gold"
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '9px 18px', fontSize: 13 }}
        >
          + Nova Nota
        </button>
      </div>

      {/* New note form */}
      {showForm && (
        <div className="p-card" style={{ padding: '20px' }}>
          <h3 style={{ fontFamily: 'Cormorant', fontSize: 18, fontWeight: 600, color: C.text, margin: '0 0 16px' }}>Nova Nota de Visita</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: 5 }}>Imóvel Visitado</label>
              <select className="p-sel" value={formProperty} onChange={e => setFormProperty(e.target.value)} style={{ width: '100%' }}>
                {MOCK_PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: 5 }}>Comprador</label>
              <input className="p-inp" value={formBuyer} onChange={e => setFormBuyer(e.target.value)} placeholder="Nome do comprador" style={{ width: '100%' }} />
            </div>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: 5 }}>Data</label>
              <input type="date" className="p-inp" value={formDate} onChange={e => setFormDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: 5 }}>Hora</label>
              <input type="time" className="p-inp" value={formTime} onChange={e => setFormTime(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          {/* Voice recorder for notes */}
          <div style={{ background: C.bg, borderRadius: 10, padding: '16px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <button
                onClick={recording ? stopNoteRecording : startNoteRecording}
                style={{
                  width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: recording ? C.red : C.green, color: '#fff', fontSize: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: recording ? `0 0 0 8px ${C.red}20` : `0 2px 10px ${C.green}40`,
                  animation: recording ? 'micPulse 1.5s ease-in-out infinite' : 'none',
                }}
              >{recording ? '⏹' : '🎙'}</button>
              <div>
                <WaveformSVG recording={recording} animated={recording} />
              </div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 12, color: recording ? C.red : C.muted }}>
                {recording ? `● ${formatDuration(noteSeconds)}` : noteSeconds > 0 ? formatDuration(noteSeconds) : 'Gravar nota de voz'}
              </div>
            </div>
            {(noteTranscript || noteInterim) && (
              <div style={{
                fontFamily: 'Jost', fontSize: 13, color: C.text, lineHeight: 1.6,
                padding: '10px 12px', background: '#fff', borderRadius: 7, maxHeight: 120, overflowY: 'auto',
              }}>
                {noteTranscript}
                {noteInterim && <span style={{ color: C.muted, fontStyle: 'italic' }}>{noteInterim}</span>}
              </div>
            )}
          </div>

          <button
            className="p-btn-gold"
            onClick={handleSaveNote}
            disabled={processing || !formBuyer || !noteTranscript}
            style={{ width: '100%', padding: '12px', opacity: (!formBuyer || !noteTranscript) ? 0.5 : 1 }}
          >
            {processing ? 'A processar com IA...' : '✦ Guardar Nota com IA'}
          </button>
        </div>
      )}

      {/* Visit notes list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visitNotes.map(note => (
          <div
            key={note.id}
            className="p-card"
            style={{ padding: '20px', border: expandedId === note.id ? `1.5px solid ${C.green}40` : undefined }}
          >
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {/* Interest arc */}
              <div style={{ flexShrink: 0 }}>
                <InterestArc level={note.interest} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontFamily: 'Jost', fontWeight: 600, fontSize: 15, color: C.text }}>{note.propertyName}</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {note.buyerName} · {new Date(note.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })} {note.time}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === note.id ? null : note.id)}
                    style={{
                      fontFamily: 'DM Mono', fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${C.green}30`, background: expandedId === note.id ? C.green + '12' : 'transparent',
                      color: C.green,
                    }}
                  >
                    {expandedId === note.id ? '▲ Fechar' : '▼ Ver Detalhe'}
                  </button>
                </div>

                {/* Objection badges */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {note.objections.map((obj, i) => (
                    <span key={i} style={{
                      background: C.red + '12', color: C.red, border: `1px solid ${C.red}30`,
                      fontSize: 10, fontFamily: 'DM Mono', padding: '2px 8px', borderRadius: 99,
                    }}>{obj}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedId === note.id && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: C.muted, marginBottom: 5 }}>REACÇÃO DO COMPRADOR</div>
                  <p style={{ fontFamily: 'Jost', fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0 }}>{note.reaction}</p>
                </div>
                <div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: C.muted, marginBottom: 5 }}>PRÓXIMO PASSO</div>
                  <p style={{ fontFamily: 'Jost', fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0 }}>{note.nextStep}</p>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: C.muted, marginBottom: 5 }}>TRANSCRIÇÃO COMPLETA</div>
                  <div style={{
                    fontFamily: 'Jost', fontSize: 12, color: C.muted, lineHeight: 1.6,
                    padding: '10px 12px', background: C.bg, borderRadius: 7,
                  }}>{note.transcript}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab: Comandos de Voz ─────────────────────────────────────────────────────
function TabComandos() {
  const [listening, setListening] = useState(false)
  const [liveText, setLiveText] = useState('')
  const [history, setHistory] = useState<CommandHistoryEntry[]>([
    { id: 'h1', raw: 'criar lead João Silva 800 mil Lisboa', matched: 'Criar lead', result: 'Lead criado: João Silva · Budget €800K · Lisboa', executedAt: '2026-04-04T11:32:00Z' },
    { id: 'h2', raw: 'resumo do dia', matched: 'Resumo do dia', result: 'IA: 3 visitas, 2 propostas enviadas, 5 follow-ups pendentes. Melhor lead: David Thompson (Cascais).', executedAt: '2026-04-04T09:05:00Z' },
    { id: 'h3', raw: 'agendar visita Cascais sexta tarde', matched: 'Agendar visita', result: 'Visita agendada: Cascais · Sexta-feira 17 Abril · 15h00', executedAt: '2026-04-03T16:45:00Z' },
    { id: 'h4', raw: 'enviar proposta para Marie Dubois', matched: 'Enviar proposta', result: 'Rascunho de proposta criado para Marie Dubois (Penthouse Liberdade)', executedAt: '2026-04-03T14:20:00Z' },
    { id: 'h5', raw: 'follow-up Pedro amanhã às 10h', matched: 'Follow-up', result: 'Lembrete criado: Pedro Menezes · 5 Abril · 10h00', executedAt: '2026-04-02T17:10:00Z' },
  ])

  const recRef = useRef<unknown>(null)
  const liveRef = useRef('')

  function matchCommand(text: string): { matched: string; result: string } {
    const lc = text.toLowerCase()
    if (lc.includes('criar lead')) {
      const parts = text.match(/criar lead (.+)/i)
      return { matched: 'Criar lead', result: `Lead criado: ${parts?.[1] ?? 'Novo lead'} · Adicionado ao CRM` }
    }
    if (lc.includes('agendar visita')) {
      const parts = text.match(/agendar visita (.+)/i)
      return { matched: 'Agendar visita', result: `Visita agendada: ${parts?.[1] ?? 'Imóvel'} · Entrada na agenda criada` }
    }
    if (lc.includes('enviar proposta')) {
      const parts = text.match(/enviar proposta para (.+)/i)
      return { matched: 'Enviar proposta', result: `Rascunho criado para ${parts?.[1] ?? 'cliente'} · Proposta formal em preparação` }
    }
    if (lc.includes('resumo do dia') || lc.includes('resumo dia')) {
      return { matched: 'Resumo do dia', result: 'IA: A gerar resumo diário... 3 visitas marcadas, pipeline total €8.2M, 7 follow-ups activos.' }
    }
    if (lc.includes('nota de chamada') || lc.includes('nota chamada')) {
      const parts = text.match(/nota (?:de )?chamada (.+)/i)
      return { matched: 'Nota de chamada', result: `Nota de chamada iniciada para ${parts?.[1] ?? 'contacto'}` }
    }
    if (lc.includes('follow-up') || lc.includes('follow up')) {
      const parts = text.match(/follow[\-\s]up (.+)/i)
      return { matched: 'Follow-up', result: `Lembrete criado: ${parts?.[1] ?? 'Contacto'} · Adicionado ao CRM` }
    }
    return { matched: '?', result: 'Comando não reconhecido. Tente: "criar lead", "agendar visita", "resumo do dia".' }
  }

  function startListening() {
    setLiveText(''); liveRef.current = ''
    const SR = (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      ?? (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    if (!SR) { setListening(false); return }

    const recognition = new (SR as new () => {
      lang: string; continuous: boolean; interimResults: boolean;
      start(): void; stop(): void;
      onresult: ((e: { resultIndex: number; results: { isFinal: boolean; [i: number]: { transcript: string }[] }[] }) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
    })()
    recognition.lang = 'pt-PT'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (e) => {
      let final = ''; let int = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i] as unknown as SRResultCast
        if (r.isFinal) final += r[0].transcript
        else int += r[0].transcript
      }
      if (final) {
        liveRef.current = final
        setLiveText(final)
        const { matched, result } = matchCommand(final)
        const entry: CommandHistoryEntry = {
          id: `h${Date.now()}`, raw: final, matched, result, executedAt: new Date().toISOString(),
        }
        setHistory(prev => [entry, ...prev.slice(0, 9)])
        setListening(false)
      } else {
        setLiveText(int)
      }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
    recRef.current = recognition
    setListening(true)
  }

  function stopListening() {
    const r = recRef.current as { stop?: () => void } | null
    if (r?.stop) r.stop()
    setListening(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Live command area */}
      <div className="p-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 99,
            background: listening ? C.red + '18' : C.green + '12',
            border: `1px solid ${listening ? C.red + '40' : C.green + '30'}`,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: listening ? C.red : C.green,
              animation: listening ? 'micPulse 1s infinite' : 'none',
              display: 'inline-block',
            }} />
            <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: listening ? C.red : C.green }}>
              {listening ? 'A ouvir...' : 'Aguardando comando'}
            </span>
          </div>
        </div>

        <button
          onClick={listening ? stopListening : startListening}
          style={{
            width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: listening ? C.red : C.green,
            color: '#fff', fontSize: 26,
            boxShadow: listening ? `0 0 0 10px ${C.red}20` : `0 4px 16px ${C.green}40`,
            animation: listening ? 'micPulse 1.5s ease-in-out infinite' : 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          {listening ? '⏹' : '🎙'}
        </button>

        {liveText && (
          <div style={{
            fontFamily: 'Jost', fontSize: 14, color: C.text,
            padding: '10px 16px', background: C.bg, borderRadius: 8,
            margin: '0 auto', maxWidth: 400,
          }}>
            "{liveText}"
          </div>
        )}
      </div>

      {/* Command cards */}
      <div>
        <h3 style={{ fontFamily: 'Cormorant', fontSize: 20, fontWeight: 600, color: C.text, margin: '0 0 14px' }}>
          Comandos Disponíveis
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {MOCK_COMMANDS.map(cmd => (
            <div key={cmd.id} className="p-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{cmd.icon}</span>
                <div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 3 }}>
                    {cmd.command}
                  </div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: C.muted, marginBottom: 6 }}>
                    Sintaxe: <span style={{ color: C.green }}>{cmd.pattern}</span>
                  </div>
                  <div style={{ fontFamily: 'Jost', fontSize: 12, color: C.muted, marginBottom: 4 }}>
                    Ex: {cmd.example}
                  </div>
                  <div style={{ fontFamily: 'Jost', fontSize: 11, color: C.blue }}>
                    → {cmd.action}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Command history */}
      <div>
        <h3 style={{ fontFamily: 'Cormorant', fontSize: 20, fontWeight: 600, color: C.text, margin: '0 0 14px' }}>
          Histórico de Comandos
        </h3>
        <div className="p-card" style={{ padding: 0, overflow: 'hidden' }}>
          {history.slice(0, 10).map((h, i) => (
            <div
              key={h.id}
              style={{
                padding: '14px 20px',
                borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : 'none',
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}
            >
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <span style={{
                  background: C.green + '18', color: C.green,
                  fontFamily: 'DM Mono', fontSize: 9, padding: '2px 7px', borderRadius: 99,
                }}>{h.matched}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'DM Mono', fontSize: 12, color: C.text, marginBottom: 3 }}>"{h.raw}"</div>
                <div style={{ fontFamily: 'Jost', fontSize: 12, color: C.muted }}>→ {h.result}</div>
              </div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: C.muted, flexShrink: 0, marginTop: 2 }}>
                {new Date(h.executedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: 12, color: C.muted }}>
              Nenhum comando executado ainda
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Transcrições ────────────────────────────────────────────────────────
function TabTranscricoes() {
  const [transcripts, setTranscripts] = useState<VozTranscript[]>(() => {
    if (typeof window === 'undefined') return MOCK_TRANSCRIPTS
    try {
      const s = localStorage.getItem('ag_voz_transcripts')
      return s ? (JSON.parse(s) as VozTranscript[]) : MOCK_TRANSCRIPTS
    } catch { return MOCK_TRANSCRIPTS }
  })
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const TYPE_LABELS: Record<TranscriptType, string> = { ditado: 'Ditado', visita: 'Visita', comando: 'Comando' }
  const TYPE_COLORS: Record<TranscriptType, string> = { ditado: C.blue, visita: C.green, comando: C.gold }

  const filtered = transcripts.filter(t =>
    !search || t.text.toLowerCase().includes(search.toLowerCase())
  )

  function copyText(t: VozTranscript) {
    navigator.clipboard.writeText(t.text).then(() => {
      setCopied(t.id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function exportPDF(t: VozTranscript) {
    const content = [
      `TRANSCRIÇÃO — Agency Group AMI 22506`,
      `Data: ${fmtDate(t.date)}`,
      `Duração: ${formatDuration(t.duration)}`,
      `Tipo: ${TYPE_LABELS[t.type]}`,
      `Idioma: ${t.language}`,
      `Palavras: ${t.wordCount}`,
      ``,
      `TEXTO:`,
      t.text,
      t.aiResult ? [``, `ANÁLISE IA:`, `Intenção: ${INTENT_LABELS[t.aiResult.intent]}`, `Resumo: ${t.aiResult.summary}`, `Urgência: ${t.aiResult.urgency}`, `Sentimento: ${t.aiResult.sentiment}`].join('\n') : '',
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `transcricao_${t.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function deleteTranscript(id: string) {
    setTranscripts(prev => {
      const updated = prev.filter(t => t.id !== id)
      try { localStorage.setItem('ag_voz_transcripts', JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats + search */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <input
            className="p-inp"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Pesquisar nas transcrições..."
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['ditado','visita','comando'] as TranscriptType[]).map(type => {
            const count = transcripts.filter(t => t.type === type).length
            return (
              <div key={type} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cormorant', fontSize: 20, fontWeight: 700, color: TYPE_COLORS[type] }}>{count}</div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 9, color: C.muted }}>{TYPE_LABELS[type].toUpperCase()}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Transcript list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'DM Mono', fontSize: 12, color: C.muted }}>
            {search ? `Nenhuma transcrição contém "${search}"` : 'Nenhuma transcrição ainda'}
          </div>
        )}
        {filtered.map(t => (
          <div
            key={t.id}
            className="p-card"
            style={{ padding: '16px', border: expandedId === t.id ? `1.5px solid ${TYPE_COLORS[t.type]}40` : undefined }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{
                    background: TYPE_COLORS[t.type] + '18', color: TYPE_COLORS[t.type],
                    fontFamily: 'DM Mono', fontSize: 9, padding: '2px 8px', borderRadius: 99,
                  }}>{TYPE_LABELS[t.type]}</span>
                  <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: C.muted }}>{fmtDate(t.date)}</span>
                  <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: C.muted }}>
                    {formatDuration(t.duration)} · {t.wordCount} palavras
                  </span>
                  {t.aiResult && (
                    <span style={{
                      background: INTENT_COLORS[t.aiResult.intent] + '18', color: INTENT_COLORS[t.aiResult.intent],
                      fontFamily: 'DM Mono', fontSize: 9, padding: '2px 7px', borderRadius: 99,
                    }}>{INTENT_LABELS[t.aiResult.intent]}</span>
                  )}
                </div>
                <p style={{ fontFamily: 'Jost', fontSize: 13, color: C.text, lineHeight: 1.5, margin: 0 }}>
                  {expandedId === t.id ? t.text : t.text.slice(0, 120) + (t.text.length > 120 ? '...' : '')}
                </p>
                {t.aiResult && expandedId === t.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: C.muted, marginBottom: 6 }}>ANÁLISE IA</div>
                    <p style={{ fontFamily: 'Jost', fontSize: 13, color: C.text, lineHeight: 1.6, margin: '0 0 8px' }}>
                      <strong>Resumo:</strong> {t.aiResult.summary}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {t.aiResult.actionItems.map((a, i) => (
                        <span key={i} style={{
                          background: C.green + '0f', color: C.green,
                          fontFamily: 'DM Mono', fontSize: 10, padding: '3px 9px', borderRadius: 99,
                        }}>✓ {a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  style={{
                    fontFamily: 'DM Mono', fontSize: 10, padding: '4px 10px', borderRadius: 5,
                    border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer',
                  }}
                >{expandedId === t.id ? '▲' : '▼'}</button>
                <button
                  onClick={() => copyText(t)}
                  style={{
                    fontFamily: 'DM Mono', fontSize: 10, padding: '4px 10px', borderRadius: 5,
                    border: `1px solid ${C.green}30`, background: C.green + '08', color: C.green, cursor: 'pointer',
                  }}
                >{copied === t.id ? '✓' : 'Copiar'}</button>
                <button
                  onClick={() => exportPDF(t)}
                  style={{
                    fontFamily: 'DM Mono', fontSize: 10, padding: '4px 10px', borderRadius: 5,
                    border: `1px solid ${C.gold}30`, background: C.gold + '08', color: C.gold, cursor: 'pointer',
                  }}
                >Export</button>
                <button
                  onClick={() => deleteTranscript(t.id)}
                  style={{
                    fontFamily: 'DM Mono', fontSize: 10, padding: '4px 10px', borderRadius: 5,
                    border: `1px solid ${C.red}30`, background: C.red + '08', color: C.red, cursor: 'pointer',
                  }}
                >Del.</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortalVoz() {
  const [activeTab, setActiveTab] = useState<TabId>('ditado')

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'ditado',       label: 'Ditado Inteligente', icon: '🎙' },
    { id: 'visitas',      label: 'Notas de Visita',    icon: '🏡' },
    { id: 'comandos',     label: 'Comandos de Voz',    icon: '⚡' },
    { id: 'transcricoes', label: 'Transcrições',       icon: '📄' },
  ]

  return (
    <div style={{ fontFamily: 'Jost', color: C.text }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Cormorant', fontSize: 32, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>
          Voz Inteligente
        </h1>
        <p style={{ fontFamily: 'DM Mono', fontSize: 12, color: C.muted, margin: 0 }}>
          Reconhecimento de voz · Notas automáticas · Comandos IA · Agency Group AMI 22506
        </p>
      </div>

      {/* Tab navigation */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: '#fff', borderRadius: 12, padding: 4,
        border: `1px solid ${C.border}`,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? C.green : 'transparent',
              color: activeTab === tab.id ? '#fff' : C.muted,
              fontFamily: 'DM Mono', fontSize: 11, fontWeight: activeTab === tab.id ? 700 : 400,
              transition: 'all .2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            <span>{tab.icon}</span>
            <span style={{ display: 'none' }}>{tab.label}</span>
            <span className="tab-label-text">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'ditado'       && <TabDitado />}
        {activeTab === 'visitas'      && <TabVisitas />}
        {activeTab === 'comandos'     && <TabComandos />}
        {activeTab === 'transcricoes' && <TabTranscricoes />}
      </div>

      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(28,74,53,.4); }
          50% { box-shadow: 0 0 0 16px rgba(28,74,53,0); }
        }
        @keyframes waveAnim {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.8); }
        }
        .waveBar0 { animation: waveAnim 480ms ease-in-out infinite; transform-origin: center; }
        .waveBar1 { animation: waveAnim 520ms ease-in-out infinite; transform-origin: center; }
        .waveBar2 { animation: waveAnim 560ms ease-in-out infinite; transform-origin: center; }
        .waveBar3 { animation: waveAnim 500ms ease-in-out infinite; transform-origin: center; }
        .waveBar4 { animation: waveAnim 540ms ease-in-out infinite; transform-origin: center; }
        .waveBar5 { animation: waveAnim 510ms ease-in-out infinite; transform-origin: center; }
        .waveBar6 { animation: waveAnim 570ms ease-in-out infinite; transform-origin: center; }
        .waveBar7 { animation: waveAnim 490ms ease-in-out infinite; transform-origin: center; }
        @media (min-width: 640px) {
          .tab-label-text { display: inline !important; }
        }
      `}</style>
    </div>
  )
}
