// ─── normalizeSignal Test Suite ───────────────────────────────────────────────
// normalizeSignal is not exported from PortalOutbound.tsx, so we reproduce the
// exact logic here for unit testing. The implementation is extracted verbatim
// from the source.
import { describe, it, expect } from 'vitest'

// ── Types (mirrored from PortalOutbound.tsx) ──────────────────────────────────

type SignalType =
  | 'heranca'
  | 'divorcio'
  | 'insolvencia'
  | 'tempo_mercado'
  | 'multiplos_imoveis'
  | 'emigrante'
  | 'obra_parada'
  | 'renda_antiga'
  | 'preco_reduzido'
  | 'manual'

interface OutreachRecord {
  id: number
  date: string
  channel: 'carta' | 'email' | 'telefone' | 'whatsapp' | 'visita_porta'
  content: string
  response: 'sem_resposta' | 'positivo' | 'negativo' | 'neutro'
  nextDate: string | null
}

interface ProspectSignal {
  id: number
  type: SignalType
  address: string
  zona: string
  proprietario: string | null
  contacto: string | null
  avmEstimate: number | null
  probability: number
  priority: 'alta' | 'media' | 'baixa'
  source: string
  status: 'novo' | 'contactado' | 'interesse' | 'reuniao' | 'exclusividade' | 'arquivo'
  lastContact: string | null
  nextAction: string | null
  notes: string
  outreachHistory: OutreachRecord[]
  createdAt: string
}

// ── normalizeSignal (extracted verbatim from PortalOutbound.tsx) ──────────────

function normalizeSignal(raw: Record<string, unknown>): ProspectSignal {
  const VALID_TYPES: SignalType[] = [
    'heranca','divorcio','insolvencia','tempo_mercado','multiplos_imoveis',
    'emigrante','obra_parada','renda_antiga','preco_reduzido','manual'
  ]
  const VALID_STATUS = ['novo','contactado','interesse','reuniao','exclusividade','arquivo']
  const VALID_PRIORITY = ['alta','media','baixa']

  return {
    id:              (raw.id as number) ?? Date.now(),
    type:            VALID_TYPES.includes(raw.type as SignalType) ? (raw.type as SignalType) : 'manual',
    address:         String(raw.address ?? raw.title ?? raw.morada ?? '—'),
    zona:            String(raw.zona ?? raw.zone ?? raw.area ?? ''),
    proprietario:    (raw.proprietario ?? raw.owner_name ?? raw.owner ?? null) as string | null,
    contacto:        (raw.contacto ?? raw.contact ?? raw.phone ?? null) as string | null,
    avmEstimate:     (typeof raw.avmEstimate === 'number' ? raw.avmEstimate
                      : typeof raw.avm_estimate === 'number' ? raw.avm_estimate
                      : null) as number | null,
    probability:     typeof raw.probability === 'number' ? raw.probability : 50,
    priority:        VALID_PRIORITY.includes(raw.priority as string) ? (raw.priority as 'alta' | 'media' | 'baixa') : 'media',
    source:          String(raw.source ?? 'API'),
    status:          VALID_STATUS.includes(raw.status as string) ? (raw.status as ProspectSignal['status']) : 'novo',
    lastContact:     (raw.lastContact ?? raw.last_contact ?? null) as string | null,
    nextAction:      (raw.nextAction ?? raw.next_action ?? null) as string | null,
    notes:           String(raw.notes ?? raw.description ?? ''),
    outreachHistory: Array.isArray(raw.outreachHistory) ? (raw.outreachHistory as OutreachRecord[]) : [],
    createdAt:       String(raw.createdAt ?? raw.created_at ?? new Date().toISOString().split('T')[0]),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('normalizeSignal', () => {

  // outreachHistory
  it('defaults outreachHistory to empty array when field is missing', () => {
    const raw = { id: 1, type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).outreachHistory).toEqual([])
  })

  it('preserves outreachHistory when it is a valid array', () => {
    const history = [
      { id: 1, date: '2026-03-01', channel: 'carta', content: 'Intro letter', response: 'neutro', nextDate: null }
    ]
    const raw = { id: 1, type: 'heranca', title: 'Test', outreachHistory: history }
    expect(normalizeSignal(raw).outreachHistory).toHaveLength(1)
    expect(normalizeSignal(raw).outreachHistory[0].channel).toBe('carta')
  })

  it('resets outreachHistory to [] when it is not an array (e.g. null)', () => {
    const raw = { id: 1, type: 'heranca', title: 'Test', outreachHistory: null }
    expect(normalizeSignal(raw).outreachHistory).toEqual([])
  })

  it('resets outreachHistory to [] when it is a string', () => {
    const raw = { id: 1, type: 'heranca', title: 'Test', outreachHistory: 'invalid' }
    expect(normalizeSignal(raw).outreachHistory).toEqual([])
  })

  // type normalisation
  it('normalizes unknown type to manual', () => {
    const raw = { id: 1, type: 'unknown_type', title: 'Test' }
    expect(normalizeSignal(raw).type).toBe('manual')
  })

  it('preserves valid signal type: heranca', () => {
    const raw = { id: 1, type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).type).toBe('heranca')
  })

  it('preserves valid signal type: divorcio', () => {
    const raw = { id: 1, type: 'divorcio', title: 'Test' }
    expect(normalizeSignal(raw).type).toBe('divorcio')
  })

  it('preserves valid signal type: insolvencia', () => {
    expect(normalizeSignal({ type: 'insolvencia', title: 'T' }).type).toBe('insolvencia')
  })

  it('preserves valid signal type: tempo_mercado', () => {
    expect(normalizeSignal({ type: 'tempo_mercado', title: 'T' }).type).toBe('tempo_mercado')
  })

  it('preserves valid signal type: multiplos_imoveis', () => {
    expect(normalizeSignal({ type: 'multiplos_imoveis', title: 'T' }).type).toBe('multiplos_imoveis')
  })

  it('preserves valid signal type: emigrante', () => {
    expect(normalizeSignal({ type: 'emigrante', title: 'T' }).type).toBe('emigrante')
  })

  it('preserves valid signal type: obra_parada', () => {
    expect(normalizeSignal({ type: 'obra_parada', title: 'T' }).type).toBe('obra_parada')
  })

  it('preserves valid signal type: renda_antiga', () => {
    expect(normalizeSignal({ type: 'renda_antiga', title: 'T' }).type).toBe('renda_antiga')
  })

  it('preserves valid signal type: preco_reduzido', () => {
    expect(normalizeSignal({ type: 'preco_reduzido', title: 'T' }).type).toBe('preco_reduzido')
  })

  it('preserves valid signal type: manual', () => {
    expect(normalizeSignal({ type: 'manual', title: 'T' }).type).toBe('manual')
  })

  it('normalizes undefined type to manual', () => {
    const raw = { id: 1, title: 'No type field' }
    expect(normalizeSignal(raw).type).toBe('manual')
  })

  // address fallback chain
  it('uses address field when present', () => {
    const raw = { type: 'heranca', address: 'Rua A 10', title: 'Should not use this' }
    expect(normalizeSignal(raw).address).toBe('Rua A 10')
  })

  it('falls back to title when address is missing', () => {
    const raw = { type: 'heranca', title: 'Rua das Flores 10' }
    expect(normalizeSignal(raw).address).toBe('Rua das Flores 10')
  })

  it('falls back to morada when address and title are missing', () => {
    const raw = { type: 'heranca', morada: 'Av. da Liberdade 100' }
    expect(normalizeSignal(raw).address).toBe('Av. da Liberdade 100')
  })

  it('uses — when address, title, and morada are all missing', () => {
    const raw = { type: 'heranca' }
    expect(normalizeSignal(raw).address).toBe('—')
  })

  // priority defaults
  it('defaults priority to media when missing', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).priority).toBe('media')
  })

  it('preserves valid priority: alta', () => {
    const raw = { type: 'heranca', title: 'Test', priority: 'alta' }
    expect(normalizeSignal(raw).priority).toBe('alta')
  })

  it('preserves valid priority: baixa', () => {
    const raw = { type: 'heranca', title: 'Test', priority: 'baixa' }
    expect(normalizeSignal(raw).priority).toBe('baixa')
  })

  it('resets invalid priority to media', () => {
    const raw = { type: 'heranca', title: 'Test', priority: 'urgente' }
    expect(normalizeSignal(raw).priority).toBe('media')
  })

  // status defaults
  it('defaults status to novo when missing', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).status).toBe('novo')
  })

  it('preserves valid status: contactado', () => {
    const raw = { type: 'heranca', title: 'Test', status: 'contactado' }
    expect(normalizeSignal(raw).status).toBe('contactado')
  })

  it('preserves valid status: interesse', () => {
    const raw = { type: 'heranca', title: 'Test', status: 'interesse' }
    expect(normalizeSignal(raw).status).toBe('interesse')
  })

  it('preserves valid status: reuniao', () => {
    const raw = { type: 'heranca', title: 'Test', status: 'reuniao' }
    expect(normalizeSignal(raw).status).toBe('reuniao')
  })

  it('preserves valid status: exclusividade', () => {
    const raw = { type: 'heranca', title: 'Test', status: 'exclusividade' }
    expect(normalizeSignal(raw).status).toBe('exclusividade')
  })

  it('preserves valid status: arquivo', () => {
    const raw = { type: 'heranca', title: 'Test', status: 'arquivo' }
    expect(normalizeSignal(raw).status).toBe('arquivo')
  })

  it('resets invalid status to novo', () => {
    const raw = { type: 'heranca', title: 'Test', status: 'pendente' }
    expect(normalizeSignal(raw).status).toBe('novo')
  })

  // probability
  it('preserves probability when it is a number', () => {
    const raw = { type: 'heranca', title: 'Test', probability: 75 }
    expect(normalizeSignal(raw).probability).toBe(75)
  })

  it('defaults probability to 50 when missing', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).probability).toBe(50)
  })

  it('defaults probability to 50 when it is a string', () => {
    const raw = { type: 'heranca', title: 'Test', probability: '80' }
    expect(normalizeSignal(raw).probability).toBe(50)
  })

  // avmEstimate
  it('preserves avmEstimate when it is a number', () => {
    const raw = { type: 'heranca', title: 'Test', avmEstimate: 980000 }
    expect(normalizeSignal(raw).avmEstimate).toBe(980000)
  })

  it('reads snake_case avm_estimate as fallback', () => {
    const raw = { type: 'heranca', title: 'Test', avm_estimate: 750000 }
    expect(normalizeSignal(raw).avmEstimate).toBe(750000)
  })

  it('returns null for avmEstimate when neither field is a number', () => {
    const raw = { type: 'heranca', title: 'Test', avmEstimate: '980000' }
    expect(normalizeSignal(raw).avmEstimate).toBeNull()
  })

  it('returns null for avmEstimate when missing', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).avmEstimate).toBeNull()
  })

  // source default
  it('defaults source to "API" when missing', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).source).toBe('API')
  })

  it('preserves source when present', () => {
    const raw = { type: 'heranca', title: 'Test', source: 'Idealista' }
    expect(normalizeSignal(raw).source).toBe('Idealista')
  })

  // owner/proprietario aliases
  it('reads proprietario field', () => {
    const raw = { type: 'heranca', title: 'Test', proprietario: 'João Silva' }
    expect(normalizeSignal(raw).proprietario).toBe('João Silva')
  })

  it('falls back to owner_name for proprietario', () => {
    const raw = { type: 'heranca', title: 'Test', owner_name: 'Maria Santos' }
    expect(normalizeSignal(raw).proprietario).toBe('Maria Santos')
  })

  it('falls back to owner for proprietario', () => {
    const raw = { type: 'heranca', title: 'Test', owner: 'Carlos Costa' }
    expect(normalizeSignal(raw).proprietario).toBe('Carlos Costa')
  })

  it('returns null for proprietario when no owner fields present', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).proprietario).toBeNull()
  })

  // contacto aliases
  it('reads contacto field', () => {
    const raw = { type: 'heranca', title: 'Test', contacto: '+351 910 000 000' }
    expect(normalizeSignal(raw).contacto).toBe('+351 910 000 000')
  })

  it('falls back to contact field', () => {
    const raw = { type: 'heranca', title: 'Test', contact: '+351 920 000 000' }
    expect(normalizeSignal(raw).contacto).toBe('+351 920 000 000')
  })

  it('falls back to phone field', () => {
    const raw = { type: 'heranca', title: 'Test', phone: '+351 930 000 000' }
    expect(normalizeSignal(raw).contacto).toBe('+351 930 000 000')
  })

  it('returns null for contacto when none of the phone fields present', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).contacto).toBeNull()
  })

  // notes / description aliases
  it('uses notes field when present', () => {
    const raw = { type: 'heranca', title: 'Test', notes: 'Imóvel em bom estado' }
    expect(normalizeSignal(raw).notes).toBe('Imóvel em bom estado')
  })

  it('falls back to description for notes', () => {
    const raw = { type: 'heranca', title: 'Test', description: 'Descrição do imóvel' }
    expect(normalizeSignal(raw).notes).toBe('Descrição do imóvel')
  })

  it('returns empty string for notes when both missing', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).notes).toBe('')
  })

  // lastContact / last_contact aliases
  it('reads lastContact field', () => {
    const raw = { type: 'heranca', title: 'Test', lastContact: '2026-03-01' }
    expect(normalizeSignal(raw).lastContact).toBe('2026-03-01')
  })

  it('falls back to last_contact', () => {
    const raw = { type: 'heranca', title: 'Test', last_contact: '2026-02-01' }
    expect(normalizeSignal(raw).lastContact).toBe('2026-02-01')
  })

  it('returns null for lastContact when missing', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).lastContact).toBeNull()
  })

  // nextAction / next_action aliases
  it('reads nextAction field', () => {
    const raw = { type: 'heranca', title: 'Test', nextAction: 'Reunião 2026-04-10' }
    expect(normalizeSignal(raw).nextAction).toBe('Reunião 2026-04-10')
  })

  it('falls back to next_action', () => {
    const raw = { type: 'heranca', title: 'Test', next_action: 'Ligar amanhã' }
    expect(normalizeSignal(raw).nextAction).toBe('Ligar amanhã')
  })

  it('returns null for nextAction when missing', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).nextAction).toBeNull()
  })

  // zona aliases
  it('reads zona field', () => {
    const raw = { type: 'heranca', title: 'Test', zona: 'Lisboa - Chiado' }
    expect(normalizeSignal(raw).zona).toBe('Lisboa - Chiado')
  })

  it('falls back to zone field', () => {
    const raw = { type: 'heranca', title: 'Test', zone: 'Porto' }
    expect(normalizeSignal(raw).zona).toBe('Porto')
  })

  it('falls back to area field', () => {
    const raw = { type: 'heranca', title: 'Test', area: 'Cascais' }
    expect(normalizeSignal(raw).zona).toBe('Cascais')
  })

  it('returns empty string for zona when none present', () => {
    const raw = { type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).zona).toBe('')
  })

  // id
  it('uses raw id when present', () => {
    const raw = { id: 42, type: 'heranca', title: 'Test' }
    expect(normalizeSignal(raw).id).toBe(42)
  })

  // createdAt / created_at aliases
  it('reads createdAt field', () => {
    const raw = { type: 'heranca', title: 'Test', createdAt: '2026-01-01' }
    expect(normalizeSignal(raw).createdAt).toBe('2026-01-01')
  })

  it('falls back to created_at', () => {
    const raw = { type: 'heranca', title: 'Test', created_at: '2026-02-01' }
    expect(normalizeSignal(raw).createdAt).toBe('2026-02-01')
  })

  // empty object (robustness)
  it('handles empty object without throwing', () => {
    expect(() => normalizeSignal({})).not.toThrow()
  })

  it('returns a valid ProspectSignal shape for empty object', () => {
    const result = normalizeSignal({})
    expect(result.type).toBe('manual')
    expect(result.address).toBe('—')
    expect(result.priority).toBe('media')
    expect(result.status).toBe('novo')
    expect(result.probability).toBe(50)
    expect(result.outreachHistory).toEqual([])
    expect(result.source).toBe('API')
    expect(result.avmEstimate).toBeNull()
    expect(result.proprietario).toBeNull()
    expect(result.contacto).toBeNull()
    expect(result.lastContact).toBeNull()
    expect(result.nextAction).toBeNull()
    expect(result.notes).toBe('')
    expect(result.zona).toBe('')
  })
})
