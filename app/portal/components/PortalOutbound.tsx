'use client'
import { useState, useMemo, useEffect } from 'react'

// ─── TYPES ────────────────────────────────────────────────────────────────────

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

interface SequenceStep {
  day: number
  channel: 'carta' | 'email' | 'telefone' | 'whatsapp'
  template: string
  condition: 'always' | 'no_response_previous'
}

interface OutreachSequence {
  id: number
  name: string
  description: string
  steps: SequenceStep[]
  targetSignalTypes: SignalType[]
  active: boolean
  stats: { sent: number; responded: number; converted: number }
}

// ─── SCORING ──────────────────────────────────────────────────────────────────

function calcSignalProbability(signal: ProspectSignal): number {
  const typeScores: Record<SignalType, number> = {
    heranca: 75, divorcio: 70, insolvencia: 65,
    tempo_mercado: 60, multiplos_imoveis: 45,
    emigrante: 55, obra_parada: 40,
    renda_antiga: 35, preco_reduzido: 65, manual: 50
  }
  let score = typeScores[signal.type] ?? 50
  if (signal.contacto) score += 10
  if (signal.outreachHistory.some(o => o.response === 'positivo')) score += 20
  if (signal.outreachHistory.some(o => o.response === 'negativo')) score -= 30
  return Math.max(0, Math.min(100, score))
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const INITIAL_SIGNALS: ProspectSignal[] = [
  {
    id: 1, type: 'heranca', address: 'Rua do Século 45, 3º Dto', zona: 'Lisboa - Chiado',
    proprietario: 'Herdeiros de António Ferreira', contacto: '+351 912 345 678',
    avmEstimate: 980000, probability: 85, priority: 'alta', source: 'Conservatória Registo Predial',
    status: 'interesse', lastContact: '2026-03-28', nextAction: 'Reunião 2026-04-08',
    notes: 'Três herdeiros. Filho mais novo quer vender. Pai faleceu jan/26. Imóvel devoluto há 14 meses.',
    outreachHistory: [
      { id: 1, date: '2026-03-01', channel: 'carta', content: 'Carta de apresentação com proposta de avaliação gratuita.', response: 'neutro', nextDate: '2026-03-15' },
      { id: 2, date: '2026-03-15', channel: 'telefone', content: 'Contacto com filho Carlos Ferreira. Mostrou interesse em saber o valor actual.', response: 'positivo', nextDate: '2026-03-28' },
      { id: 3, date: '2026-03-28', channel: 'whatsapp', content: 'Envio de análise de mercado da zona. Proposta de reunião.', response: 'positivo', nextDate: '2026-04-08' }
    ],
    createdAt: '2026-02-15'
  },
  {
    id: 2, type: 'divorcio', address: 'Av. da Boavista 1850, 4º Esq', zona: 'Porto - Boavista',
    proprietario: 'Maria João Sousa', contacto: '+351 934 567 890',
    avmEstimate: 720000, probability: 70, priority: 'alta', source: 'Tribunal de Família Porto',
    status: 'contactado', lastContact: '2026-03-30', nextAction: 'Follow-up semana de 07/04',
    notes: 'Processo de divórcio há 8 meses. Partilha judicial pendente. Advogada confirmou intenção de venda.',
    outreachHistory: [
      { id: 1, date: '2026-03-20', channel: 'carta', content: 'Carta dirigida à proprietária com proposta de avaliação confidencial.', response: 'neutro', nextDate: '2026-03-30' },
      { id: 2, date: '2026-03-30', channel: 'email', content: 'Email de follow-up com casos de sucesso em partilhas judiciais.', response: 'neutro', nextDate: '2026-04-07' }
    ],
    createdAt: '2026-03-10'
  },
  {
    id: 3, type: 'tempo_mercado', address: 'Quinta das Marianas, V5 Cascais',
    zona: 'Cascais - Birre', proprietario: 'Família Rodrigues',
    contacto: null, avmEstimate: 2450000, probability: 60, priority: 'alta',
    source: 'Idealista / SCI', status: 'novo', lastContact: null,
    nextAction: 'Enviar carta esta semana',
    notes: 'No mercado há 247 dias. Preço baixado 3x. De €2.9M para €2.45M. Agência Savills. Sinal forte.',
    outreachHistory: [], createdAt: '2026-04-01'
  },
  {
    id: 4, type: 'insolvencia', address: 'Rua de Santa Catarina 230, RC',
    zona: 'Porto - Baixa', proprietario: 'Sociedade Comercial Nortenha Lda',
    contacto: '+351 222 111 333', avmEstimate: 550000, probability: 65, priority: 'alta',
    source: 'Citius - Insolvências', status: 'contactado',
    lastContact: '2026-03-25', nextAction: 'Aguardar resposta do administrador de insolvência',
    notes: 'Processo 1234/2025. Administrador Dr. Paulo Mendes. Imóvel comercial em Lisboa classificado como activo a liquidar.',
    outreachHistory: [
      { id: 1, date: '2026-03-25', channel: 'email', content: 'Email ao administrador de insolvência com proposta de avaliação e mandato exclusivo.', response: 'neutro', nextDate: '2026-04-07' }
    ],
    createdAt: '2026-03-18'
  },
  {
    id: 5, type: 'multiplos_imoveis', address: 'Rua dos Jerónimos 12, 1º Dto',
    zona: 'Lisboa - Belém', proprietario: 'Carlos Augusto Pinheiro',
    contacto: '+351 965 432 100', avmEstimate: 820000, probability: 55, priority: 'media',
    source: 'IMI - Caderneta Predial', status: 'novo', lastContact: null,
    nextAction: 'Primeiro contacto telefónico',
    notes: 'Proprietário com 6 imóveis em Lisboa. 3 arrendados a preços abaixo de mercado. Potencial de consolidação patrimonial.',
    outreachHistory: [], createdAt: '2026-03-28'
  },
  {
    id: 6, type: 'emigrante', address: 'Travessa do Carmo 8, 2º',
    zona: 'Lisboa - Bairro Alto', proprietario: 'Susana Marques',
    contacto: '+33 6 12 34 56 78', avmEstimate: 650000, probability: 55, priority: 'media',
    source: 'Contacto de rede', status: 'interesse',
    lastContact: '2026-04-02', nextAction: 'Videoconferência 12/04',
    notes: 'Emigrada em Paris há 6 anos. Apartamento fechado. Irmã em Lisboa gere as chaves. Considera vender para comprar em França.',
    outreachHistory: [
      { id: 1, date: '2026-03-22', channel: 'whatsapp', content: 'Mensagem inicial via irmã. Apresentação da Agency Group.', response: 'positivo', nextDate: '2026-04-02' },
      { id: 2, date: '2026-04-02', channel: 'whatsapp', content: 'Proposta de avaliação online. Enviou fotos do apartamento.', response: 'positivo', nextDate: '2026-04-12' }
    ],
    createdAt: '2026-03-15'
  },
  {
    id: 7, type: 'preco_reduzido', address: 'Urbanização Vale do Lobo, Lote 34',
    zona: 'Algarve - Vale do Lobo', proprietario: 'David Thompson',
    contacto: 'david.thompson@gmail.com', avmEstimate: 1850000, probability: 65, priority: 'alta',
    source: 'OLX / Imovirtual', status: 'contactado',
    lastContact: '2026-04-01', nextAction: 'Proposta de exclusividade esta semana',
    notes: 'Britânico. Baixou preço 4x em 11 meses. €2.4M → €1.85M. Moroso pós-Brexit. Quer liquidez rápida.',
    outreachHistory: [
      { id: 1, date: '2026-03-28', channel: 'email', content: 'Email em inglês com análise de mercado Vale do Lobo e proposta de estratégia de venda acelerada.', response: 'positivo', nextDate: '2026-04-01' },
      { id: 2, date: '2026-04-01', channel: 'telefone', content: 'Call de 25 min. Muito receptivo. Pede proposta formal de exclusividade.', response: 'positivo', nextDate: '2026-04-07' }
    ],
    createdAt: '2026-03-20'
  },
  {
    id: 8, type: 'heranca', address: 'Rua Alexandre Herculano 78, 3º Esq',
    zona: 'Lisboa - Marquês', proprietario: null, contacto: null,
    avmEstimate: 1200000, probability: 75, priority: 'alta',
    source: 'Conservatória Lisboa 3', status: 'novo', lastContact: null,
    nextAction: 'Identificar herdeiros via Conservatória',
    notes: 'Óbito registado jan/26. Imóvel de 187m² sem transacção desde 2003. Prime location.',
    outreachHistory: [], createdAt: '2026-04-03'
  },
  {
    id: 9, type: 'obra_parada', address: 'Rua da Palma 145-149',
    zona: 'Lisboa - Intendente', proprietario: 'Construções Lisbonenses SA',
    contacto: '+351 213 456 789', avmEstimate: 3200000, probability: 40, priority: 'media',
    source: 'Câmara Municipal Lisboa', status: 'contactado',
    lastContact: '2026-03-10', nextAction: 'Novo contacto após silêncio 30 dias',
    notes: 'Prédio em reabilitação parado há 2 anos. Licença caducada. Empresa com dificuldades financeiras. Potencial de aquisição ou representação.',
    outreachHistory: [
      { id: 1, date: '2026-03-10', channel: 'carta', content: 'Carta formal para a administração com proposta de parceria ou mediação da venda.', response: 'sem_resposta', nextDate: '2026-04-10' }
    ],
    createdAt: '2026-03-05'
  },
  {
    id: 10, type: 'renda_antiga', address: 'Calçada da Estrela 22, 1º Dto',
    zona: 'Lisboa - Estrela', proprietario: 'José Maria Figueiredo',
    contacto: '+351 963 210 987', avmEstimate: 680000, probability: 35, priority: 'baixa',
    source: 'Base dados própria', status: 'contactado',
    lastContact: '2026-02-20', nextAction: 'Re-contactar em junho após NRAU',
    notes: 'Inquilino há 40 anos paga €180/mês. Proprietário (78 anos) considera vender. Filho aconselha manter. Timing delicado.',
    outreachHistory: [
      { id: 1, date: '2026-02-20', channel: 'visita_porta', content: 'Visita presencial. Conversa de 40 min com proprietário. Receptivo mas indeciso.', response: 'neutro', nextDate: '2026-06-01' }
    ],
    createdAt: '2026-02-01'
  },
  {
    id: 11, type: 'divorcio', address: 'Av. Marginal 5670, Apt 12',
    zona: 'Cascais - Estoril', proprietario: 'Paulo Saraiva',
    contacto: '+351 917 654 321', avmEstimate: 1450000, probability: 70, priority: 'alta',
    source: 'Referência advogado parceiro', status: 'reuniao',
    lastContact: '2026-04-03', nextAction: 'Reunião presencial 09/04 às 15h',
    notes: 'Referenciado pelo Dr. Miguel Costa. Separação amigável. Ambos querem liquidar. Apartamento na linha com vista mar.',
    outreachHistory: [
      { id: 1, date: '2026-03-25', channel: 'telefone', content: 'Primeiro contacto via referência. Muito aberto. Pediu reunião.', response: 'positivo', nextDate: '2026-04-03' },
      { id: 2, date: '2026-04-03', channel: 'whatsapp', content: 'Confirmação da reunião e envio de portfólio Agency Group.', response: 'positivo', nextDate: '2026-04-09' }
    ],
    createdAt: '2026-03-24'
  },
  {
    id: 12, type: 'tempo_mercado', address: 'Rua de Cedofeita 311, 4º Dto',
    zona: 'Porto - Cedofeita', proprietario: 'Ana Rita Costa',
    contacto: 'aritacosta@hotmail.com', avmEstimate: 385000, probability: 60, priority: 'media',
    source: 'Imovirtual scraping', status: 'novo', lastContact: null,
    nextAction: 'Email esta semana',
    notes: 'No mercado há 195 dias com a ERA. Anúncio sem fotos profissionais. Preço acima de mercado.',
    outreachHistory: [], createdAt: '2026-04-02'
  },
  {
    id: 13, type: 'emigrante', address: 'Rua Dom João IV 45, 2º',
    zona: 'Porto - Centro', proprietario: 'Família Oliveira',
    contacto: '+44 7700 900456', avmEstimate: 420000, probability: 55, priority: 'media',
    source: 'Facebook grupos emigrantes', status: 'contactado',
    lastContact: '2026-03-29', nextAction: 'Follow-up segunda semana de abril',
    notes: 'Família emigrou para Reino Unido em 2020. Apartamento vazio. Respondem bem por WhatsApp.',
    outreachHistory: [
      { id: 1, date: '2026-03-29', channel: 'whatsapp', content: 'Mensagem em português e inglês com oferta de avaliação gratuita.', response: 'neutro', nextDate: '2026-04-12' }
    ],
    createdAt: '2026-03-27'
  },
  {
    id: 14, type: 'insolvencia', address: 'Av. Dom João II 35, Parque das Nações',
    zona: 'Lisboa - Parque Nações', proprietario: 'TechStart Unipessoal Lda',
    contacto: '+351 215 678 901', avmEstimate: 890000, probability: 65, priority: 'alta',
    source: 'Citius', status: 'exclusividade',
    lastContact: '2026-04-04', nextAction: 'Assinar contrato mediação 07/04',
    notes: 'Startup insolvente. Administrador cooperante. Apartamento T4 escritório convertido. Contrato de mediação em negociação.',
    outreachHistory: [
      { id: 1, date: '2026-03-15', channel: 'email', content: 'Proposta ao administrador de insolvência.', response: 'positivo', nextDate: '2026-03-22' },
      { id: 2, date: '2026-03-22', channel: 'telefone', content: 'Call com administrador. Pediu proposta formal.', response: 'positivo', nextDate: '2026-04-04' },
      { id: 3, date: '2026-04-04', channel: 'visita_porta', content: 'Visita ao imóvel com administrador. Avaliação feita.', response: 'positivo', nextDate: '2026-04-07' }
    ],
    createdAt: '2026-03-10'
  },
  {
    id: 15, type: 'multiplos_imoveis', address: 'Tv. das Mercês 3, 1º',
    zona: 'Lisboa - Príncipe Real', proprietario: 'Beatriz Noronha',
    contacto: '+351 961 234 567', avmEstimate: 1100000, probability: 45, priority: 'media',
    source: 'Network notarial', status: 'interesse',
    lastContact: '2026-04-01', nextAction: 'Reunião informal café 10/04',
    notes: 'Herdou 4 imóveis da avó. Quer consolidar o portfólio, possivelmente vender 2. Advogada já trabalhou com a Agency.',
    outreachHistory: [
      { id: 1, date: '2026-03-18', channel: 'telefone', content: 'Contacto inicial via advogada parceira.', response: 'positivo', nextDate: '2026-04-01' },
      { id: 2, date: '2026-04-01', channel: 'whatsapp', content: 'Envio de análise do portfólio com valores actuais de mercado.', response: 'positivo', nextDate: '2026-04-10' }
    ],
    createdAt: '2026-03-15'
  },
  {
    id: 16, type: 'preco_reduzido', address: 'Estrada de Benfica 701, RC',
    zona: 'Lisboa - Benfica', proprietario: 'Sérgio Lameiras',
    contacto: null, avmEstimate: 310000, probability: 65, priority: 'media',
    source: 'OLX Monitor', status: 'novo', lastContact: null,
    nextAction: 'Identificar contacto e enviar carta',
    notes: 'Baixou de €380K para €310K em 8 meses. 5 reduções de preço. Anúncio muito pobre.',
    outreachHistory: [], createdAt: '2026-04-04'
  },
  {
    id: 17, type: 'obra_parada', address: 'Rua da Liberdade 88-90',
    zona: 'Algarve - Faro', proprietario: 'Algarve Invest SA',
    contacto: '+351 289 456 123', avmEstimate: 4500000, probability: 40, priority: 'alta',
    source: 'CCDR Algarve', status: 'arquivo',
    lastContact: '2026-02-01', nextAction: null,
    notes: 'Empresa respondeu negativamente. Têm financiamento assegurado para retomar obra. Arquivar por 6 meses.',
    outreachHistory: [
      { id: 1, date: '2026-01-15', channel: 'carta', content: 'Carta de apresentação.', response: 'negativo', nextDate: null }
    ],
    createdAt: '2026-01-10'
  },
  {
    id: 18, type: 'manual', address: 'Rua das Flores 55, 3º Dto',
    zona: 'Porto - Ribeira', proprietario: 'Francesco Benedetti',
    contacto: '+39 348 123 4567', avmEstimate: 750000, probability: 50, priority: 'media',
    source: 'Contacto directo networking', status: 'contactado',
    lastContact: '2026-04-03', nextAction: 'Proposta em italiano por email',
    notes: 'Italiano. Comprou em 2019, quer regressar a Milão. Falou comigo num jantar em Lisboa.',
    outreachHistory: [
      { id: 1, date: '2026-04-03', channel: 'whatsapp', content: 'WhatsApp pós-jantar. Pediu análise de valor actual.', response: 'positivo', nextDate: '2026-04-08' }
    ],
    createdAt: '2026-04-03'
  },
  {
    id: 19, type: 'heranca', address: 'Caminho do Monte 234, Funchal',
    zona: 'Madeira - Funchal', proprietario: 'Herdeiros Gouveia',
    contacto: '+351 291 234 567', avmEstimate: 480000, probability: 75, priority: 'alta',
    source: 'Notária parceira Funchal', status: 'interesse',
    lastContact: '2026-03-31', nextAction: 'Visita ao imóvel 11/04',
    notes: '3 herdeiros residentes no continente. Imóvel vazio há 18 meses. Querem vender rápido.',
    outreachHistory: [
      { id: 1, date: '2026-03-20', channel: 'carta', content: 'Carta com proposta e referência da notária.', response: 'positivo', nextDate: '2026-03-31' },
      { id: 2, date: '2026-03-31', channel: 'telefone', content: 'Call com herdeiro mais velho. Muito motivado. Agendou visita.', response: 'positivo', nextDate: '2026-04-11' }
    ],
    createdAt: '2026-03-18'
  },
  {
    id: 20, type: 'renda_antiga', address: 'Av. Almirante Reis 210, 5º Esq',
    zona: 'Lisboa - Arroios', proprietario: 'Filomena Antunes',
    contacto: '+351 967 890 123', avmEstimate: 420000, probability: 35, priority: 'baixa',
    source: 'Prospecção porta-a-porta', status: 'novo', lastContact: null,
    nextAction: 'Visita porta próxima semana',
    notes: 'Prédio antigo. 4 fracções, 3 com arrendamento antigo. Proprietária com 82 anos. Filha cooperante.',
    outreachHistory: [], createdAt: '2026-04-04'
  }
]

const DEFAULT_SEQUENCES: OutreachSequence[] = [
  {
    id: 1,
    name: 'Herança + Imóvel Parado',
    description: 'Sequência de 5 passos para herdeiros com imóveis devolutos. Abordagem sensível e profissional.',
    steps: [
      { day: 1, channel: 'carta', template: 'Carta de apresentação formal com proposta de avaliação gratuita e discreta.', condition: 'always' },
      { day: 8, channel: 'email', template: 'Follow-up com casos de sucesso em processos de herança. Valor do mercado actual.', condition: 'no_response_previous' },
      { day: 15, channel: 'telefone', template: 'Chamada directa. Apresentação como especialista em patrimónios familiares.', condition: 'no_response_previous' },
      { day: 22, channel: 'whatsapp', template: 'Mensagem curta e directa. Link para o nosso portfólio de vendas recentes na zona.', condition: 'no_response_previous' },
      { day: 30, channel: 'carta', template: 'Carta final de alta qualidade com análise de mercado personalizada para o imóvel.', condition: 'no_response_previous' }
    ],
    targetSignalTypes: ['heranca'],
    active: true,
    stats: { sent: 47, responded: 18, converted: 7 }
  },
  {
    id: 2,
    name: 'Tempo Longo no Mercado',
    description: 'Para imóveis há mais de 90 dias no mercado com outras agências. Foco na diferenciação e estratégia.',
    steps: [
      { day: 1, channel: 'email', template: 'Email com análise de porque o imóvel não está a vender. Proposta de nova estratégia.', condition: 'always' },
      { day: 7, channel: 'telefone', template: 'Chamada consultiva. Diagnóstico gratuito. Sem pitch agressivo.', condition: 'no_response_previous' },
      { day: 14, channel: 'carta', template: 'Carta com comparativo de vendas recentes na zona e timeline realista de venda.', condition: 'no_response_previous' },
      { day: 21, channel: 'whatsapp', template: 'Mensagem com caso de sucesso similar. Oferta de reunião sem compromisso.', condition: 'no_response_previous' }
    ],
    targetSignalTypes: ['tempo_mercado', 'preco_reduzido'],
    active: true,
    stats: { sent: 83, responded: 31, converted: 11 }
  },
  {
    id: 3,
    name: 'Proprietário Multi-Imóveis',
    description: 'Para proprietários com 3+ imóveis. Foco em gestão patrimonial e optimização fiscal.',
    steps: [
      { day: 1, channel: 'carta', template: 'Carta de apresentação como consultores de património imobiliário familiar.', condition: 'always' },
      { day: 10, channel: 'email', template: 'Análise fiscal: custos de manter vs. benefícios de vender. Contexto 2026.', condition: 'no_response_previous' },
      { day: 18, channel: 'telefone', template: 'Chamada para apresentação de consultoria gratuita de portfólio.', condition: 'no_response_previous' },
      { day: 25, channel: 'whatsapp', template: 'Mensagem com relatório de mercado da zona dos imóveis.', condition: 'no_response_previous' },
      { day: 35, channel: 'email', template: 'Case study de cliente com situação similar. ROI da venda vs manutenção.', condition: 'no_response_previous' },
      { day: 45, channel: 'carta', template: 'Carta final com proposta de reunião de consultoria patrimonial.', condition: 'no_response_previous' }
    ],
    targetSignalTypes: ['multiplos_imoveis'],
    active: true,
    stats: { sent: 29, responded: 9, converted: 3 }
  }
]

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<SignalType, string> = {
  heranca: 'Herança', divorcio: 'Divórcio', insolvencia: 'Insolvência',
  tempo_mercado: 'Tempo Mercado', multiplos_imoveis: 'Multi-Imóveis',
  emigrante: 'Emigrante', obra_parada: 'Obra Parada',
  renda_antiga: 'Renda Antiga', preco_reduzido: 'Preço Reduzido', manual: 'Manual'
}

const SIGNAL_COLORS: Record<SignalType, string> = {
  heranca: '#7c3aed', divorcio: '#dc2626', insolvencia: '#ea580c',
  tempo_mercado: '#0284c7', multiplos_imoveis: '#0891b2',
  emigrante: '#059669', obra_parada: '#92400e',
  renda_antiga: '#6b7280', preco_reduzido: '#d97706', manual: '#1c4a35'
}

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo', contactado: 'Contactado', interesse: 'Interesse',
  reuniao: 'Reunião', exclusividade: 'Exclusividade', arquivo: 'Arquivo'
}

const CHANNEL_ICONS: Record<string, string> = {
  carta: '✉', email: '📧', telefone: '📞', whatsapp: '💬', visita_porta: '🚪'
}

const RESPONSE_LABELS: Record<string, { label: string; color: string }> = {
  sem_resposta: { label: 'Sem Resposta', color: '#6b7280' },
  positivo: { label: 'Positivo', color: '#059669' },
  negativo: { label: 'Negativo', color: '#dc2626' },
  neutro: { label: 'Neutro', color: '#d97706' }
}

const PIPELINE_STAGES = [
  { key: 'novo', label: 'Novo Signal', color: '#6b7280' },
  { key: 'contactado', label: 'Contactado', color: '#0284c7' },
  { key: 'interesse', label: 'Interesse', color: '#d97706' },
  { key: 'reuniao', label: 'Reunião', color: '#7c3aed' },
  { key: 'exclusividade', label: 'Exclusividade', color: '#059669' },
  { key: 'arquivo', label: 'Arquivo', color: '#6b7280' }
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number | null) {
  if (v === null) return '—'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function daysSince(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  return Math.floor(diff / 86400000)
}

// ─── SUBCOMPONENTS ────────────────────────────────────────────────────────────

function ProbabilityBar({ value }: { value: number }) {
  const color = value >= 70 ? '#059669' : value >= 50 ? '#d97706' : '#dc2626'
  return (
    <div style={{ background: '#e5e0d5', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden' }}>
      <div style={{
        width: `${value}%`, height: '100%', background: color,
        borderRadius: 4, transition: 'width 0.4s ease'
      }} />
    </div>
  )
}

function SignalBadge({ type }: { type: SignalType }) {
  return (
    <span style={{
      background: SIGNAL_COLORS[type] + '22', color: SIGNAL_COLORS[type],
      border: `1px solid ${SIGNAL_COLORS[type]}44`,
      borderRadius: 4, padding: '2px 8px', fontSize: 11,
      fontFamily: "'DM Mono',monospace", fontWeight: 600, whiteSpace: 'nowrap'
    }}>
      {SIGNAL_LABELS[type].toUpperCase()}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    novo: '#6b7280', contactado: '#0284c7', interesse: '#d97706',
    reuniao: '#7c3aed', exclusividade: '#059669', arquivo: '#374151'
  }
  const c = colors[status] || '#6b7280'
  return (
    <span style={{
      background: c + '22', color: c, border: `1px solid ${c}44`,
      borderRadius: 4, padding: '2px 8px', fontSize: 11,
      fontFamily: "'DM Mono',monospace", fontWeight: 600
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

// ─── SIGNAL DRAWER ────────────────────────────────────────────────────────────

function SignalDrawer({
  signal, onClose, onUpdate
}: {
  signal: ProspectSignal
  onClose: () => void
  onUpdate: (s: ProspectSignal) => void
}) {
  const [tab, setTab] = useState<'detalhes' | 'outreach' | 'mensagem'>('detalhes')
  const [msgType, setMsgType] = useState<'carta' | 'email' | 'whatsapp'>('email')
  const [tone, setTone] = useState<'profissional' | 'caloroso' | 'directo'>('profissional')
  const [lang, setLang] = useState<'PT' | 'EN' | 'FR'>('PT')
  const [generating, setGenerating] = useState(false)
  const [generatedMsg, setGeneratedMsg] = useState<{ subject?: string; message: string } | null>(null)
  const [generateError, setGenerateError] = useState('')
  const [copied, setCopied] = useState(false)
  const [editNotes, setEditNotes] = useState(signal.notes)

  async function handleGenerate() {
    setGenerating(true)
    setGeneratedMsg(null)
    setGenerateError('')
    try {
      const res = await fetch('/api/outbound/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signalType: signal.type,
          messageType: msgType,
          ownerName: signal.proprietario,
          address: signal.address,
          avmEstimate: signal.avmEstimate,
          tone,
          language: lang
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || `Erro HTTP ${res.status}`)
      }
      setGeneratedMsg(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setGenerateError(`Erro ao gerar: ${msg}. A usar template de emergência.`)
      setGeneratedMsg({
        subject: 'Proposta de Avaliação Gratuita — Agency Group',
        message: `Exmo(a). Sr(a). ${signal.proprietario || 'Proprietário'},\n\nGostaríamos de apresentar os nossos serviços de mediação imobiliária para o imóvel localizado em ${signal.address}.\n\nCom base na nossa análise de mercado, estimamos um valor de mercado de ${fmtCurrency(signal.avmEstimate)} para a sua propriedade.\n\nEstamos disponíveis para uma avaliação gratuita e sem compromisso.\n\nCom os melhores cumprimentos,\nAgency Group — AMI 22506`
      })
    } finally {
      setGenerating(false)
    }
  }

  function handleCopy() {
    if (!generatedMsg) return
    const text = generatedMsg.subject
      ? `Assunto: ${generatedMsg.subject}\n\n${generatedMsg.message}`
      : generatedMsg.message
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      style={{
        padding: '8px 16px', border: 'none', cursor: 'pointer',
        borderBottom: tab === key ? '2px solid #1c4a35' : '2px solid transparent',
        background: 'transparent', color: tab === key ? '#1c4a35' : '#6b7280',
        fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: tab === key ? 700 : 400
      }}
    >{label}</button>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', justifyContent: 'flex-end'
    }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
      />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 600,
        background: '#f4f0e6', height: '100%', overflowY: 'auto',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', borderBottom: '1px solid #e5e0d5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <SignalBadge type={signal.type} />
              <h2 style={{ fontFamily: "'Cormorant',serif", fontSize: 22, color: '#0e0e0d', margin: '8px 0 4px' }}>
                {signal.address}
              </h2>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b7280', margin: 0 }}>
                {signal.zona} · AVM {fmtCurrency(signal.avmEstimate)}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: '#6b7280', padding: '4px 8px'
              }}
            >✕</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280' }}>PROBABILIDADE</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#1c4a35', fontWeight: 700 }}>{signal.probability}%</span>
              </div>
              <ProbabilityBar value={signal.probability} />
            </div>
            <StatusBadge status={signal.status} />
          </div>
          <div style={{ display: 'flex', gap: 0, marginTop: 8 }}>
            {tabBtn('detalhes', 'Detalhes')}
            {tabBtn('outreach', `Outreach (${signal.outreachHistory.length})`)}
            {tabBtn('mensagem', 'Gerar Mensagem')}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24 }}>
          {tab === 'detalhes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Proprietário', signal.proprietario || '—'],
                  ['Contacto', signal.contacto || '—'],
                  ['Zona', signal.zona],
                  ['Fonte', signal.source],
                  ['Prioridade', signal.priority.toUpperCase()],
                  ['Criado em', fmtDate(signal.createdAt)],
                  ['Último Contacto', fmtDate(signal.lastContact)],
                  ['Próxima Acção', signal.nextAction || '—']
                ].map(([label, value]) => (
                  <div key={label} style={{ background: '#ede9dc', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#0e0e0d', fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>NOTAS</label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  onBlur={() => onUpdate({ ...signal, notes: editNotes })}
                  rows={4}
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: '#ede9dc', border: '1px solid #d4cfc4',
                    borderRadius: 8, fontFamily: "'Jost',sans-serif", fontSize: 13,
                    color: '#0e0e0d', resize: 'vertical', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['novo', 'contactado', 'interesse', 'reuniao', 'exclusividade', 'arquivo'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => onUpdate({ ...signal, status: s })}
                    style={{
                      flex: 1, padding: '6px 4px', border: 'none', borderRadius: 6,
                      cursor: 'pointer', fontSize: 10, fontFamily: "'DM Mono',monospace",
                      background: signal.status === s ? '#1c4a35' : '#ede9dc',
                      color: signal.status === s ? '#f4f0e6' : '#6b7280',
                      fontWeight: signal.status === s ? 700 : 400, transition: 'all 0.2s'
                    }}
                  >{STATUS_LABELS[s].toUpperCase()}</button>
                ))}
              </div>
            </div>
          )}

          {tab === 'outreach' && (
            <div>
              {signal.nextAction && (
                <div style={{
                  background: '#1c4a3522', border: '1px solid #1c4a3544',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                  display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#1c4a35' }}>PRÓXIMA ACÇÃO</div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#0e0e0d', fontWeight: 600 }}>{signal.nextAction}</div>
                  </div>
                </div>
              )}
              {signal.outreachHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280', fontFamily: "'Jost',sans-serif", fontSize: 14 }}>
                  Sem histórico de outreach ainda.
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 20, top: 0, bottom: 0,
                    width: 2, background: '#e5e0d5'
                  }} />
                  {signal.outreachHistory.map((rec) => {
                    const resp = RESPONSE_LABELS[rec.response]
                    return (
                      <div key={rec.id} style={{ display: 'flex', gap: 16, marginBottom: 24, position: 'relative' }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: '#1c4a35', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 16, flexShrink: 0,
                          border: '3px solid #f4f0e6', zIndex: 1
                        }}>
                          {CHANNEL_ICONS[rec.channel]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#1c4a35', fontWeight: 700 }}>
                              {rec.channel.replace('_', ' ').toUpperCase()}
                            </span>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280' }}>{fmtDate(rec.date)}</span>
                          </div>
                          <p style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#0e0e0d', margin: '0 0 6px', lineHeight: 1.5 }}>
                            {rec.content}
                          </p>
                          <span style={{
                            fontFamily: "'DM Mono',monospace", fontSize: 10,
                            color: resp.color, fontWeight: 700
                          }}>
                            RESPOSTA: {resp.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'mensagem' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>CANAL</label>
                  <select
                    value={msgType}
                    onChange={e => setMsgType(e.target.value as typeof msgType)}
                    className="p-sel"
                    style={{ width: '100%' }}
                  >
                    <option value="email">Email</option>
                    <option value="carta">Carta</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>TOM</label>
                  <select
                    value={tone}
                    onChange={e => setTone(e.target.value as typeof tone)}
                    className="p-sel"
                    style={{ width: '100%' }}
                  >
                    <option value="profissional">Profissional</option>
                    <option value="caloroso">Caloroso</option>
                    <option value="directo">Directo</option>
                  </select>
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>IDIOMA</label>
                  <select
                    value={lang}
                    onChange={e => setLang(e.target.value as typeof lang)}
                    className="p-sel"
                    style={{ width: '100%' }}
                  >
                    <option value="PT">Português</option>
                    <option value="EN">English</option>
                    <option value="FR">Français</option>
                  </select>
                </div>
              </div>
              {generateError && (
                <div style={{
                  background: '#dc262215', border: '1px solid #dc262240',
                  borderRadius: 8, padding: '8px 12px',
                  fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#dc2626'
                }}>{generateError}</div>
              )}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="p-btn-gold"
                style={{ padding: '12px', fontSize: 14, opacity: generating ? 0.7 : 1 }}
              >
                {generating ? 'A gerar...' : '⚡ Gerar Mensagem por IA'}
              </button>

              {generatedMsg && (
                <div style={{ background: '#ede9dc', borderRadius: 10, padding: 20 }}>
                  {generatedMsg.subject && (
                    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #d4cfc4' }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280' }}>ASSUNTO: </span>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#0e0e0d', fontWeight: 600 }}>
                        {generatedMsg.subject}
                      </span>
                    </div>
                  )}
                  <pre style={{
                    fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#0e0e0d',
                    whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0
                  }}>
                    {generatedMsg.message}
                  </pre>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button
                      onClick={handleCopy}
                      className="p-btn"
                      style={{ flex: 1, padding: '8px' }}
                    >
                      {copied ? '✓ Copiado' : 'Copiar'}
                    </button>
                    <button
                      onClick={() => onUpdate({
                        ...signal,
                        outreachHistory: [...signal.outreachHistory, {
                          id: Date.now(),
                          date: new Date().toISOString().split('T')[0],
                          channel: msgType as 'email' | 'carta' | 'whatsapp',
                          content: generatedMsg.message.slice(0, 120) + '...',
                          response: 'sem_resposta',
                          nextDate: null
                        }]
                      })}
                      className="p-btn-gold"
                      style={{ flex: 1, padding: '8px' }}
                    >
                      Usar em Sinal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ADD SIGNAL MODAL ─────────────────────────────────────────────────────────

function AddSignalModal({ onClose, onAdd }: { onClose: () => void; onAdd: (s: ProspectSignal) => void }) {
  const [form, setForm] = useState({
    type: 'manual' as SignalType,
    address: '', zona: '', proprietario: '', contacto: '',
    avmEstimate: '', priority: 'media' as 'alta' | 'media' | 'baixa',
    source: 'Manual', notes: ''
  })

  function handleSubmit() {
    if (!form.address || !form.zona) return
    const avm = form.avmEstimate ? parseInt(form.avmEstimate.replace(/\D/g, '')) : null
    const newSignal: ProspectSignal = {
      id: Date.now(),
      type: form.type, address: form.address, zona: form.zona,
      proprietario: form.proprietario || null, contacto: form.contacto || null,
      avmEstimate: avm, probability: 50, priority: form.priority,
      source: form.source, status: 'novo', lastContact: null, nextAction: null,
      notes: form.notes, outreachHistory: [],
      createdAt: new Date().toISOString().split('T')[0]
    }
    newSignal.probability = calcSignalProbability(newSignal)
    onAdd(newSignal)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{
        position: 'relative', background: '#f4f0e6', borderRadius: 16, padding: 32,
        width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
      }}>
        <h2 style={{ fontFamily: "'Cormorant',serif", fontSize: 24, color: '#0e0e0d', margin: '0 0 24px' }}>
          Adicionar Sinal Manual
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>TIPO DE SINAL</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as SignalType }))} className="p-sel" style={{ width: '100%' }}>
                {Object.entries(SIGNAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>PRIORIDADE</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as 'alta' | 'media' | 'baixa' }))} className="p-sel" style={{ width: '100%' }}>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
          </div>
          {[
            { key: 'address', label: 'MORADA', placeholder: 'Rua, número, andar...' },
            { key: 'zona', label: 'ZONA', placeholder: 'Ex: Lisboa - Chiado' },
            { key: 'proprietario', label: 'PROPRIETÁRIO (opcional)', placeholder: 'Nome do proprietário' },
            { key: 'contacto', label: 'CONTACTO (opcional)', placeholder: '+351 9XX XXX XXX' },
            { key: 'avmEstimate', label: 'ESTIMATIVA AVM (€)', placeholder: 'Ex: 850000' },
            { key: 'source', label: 'FONTE', placeholder: 'Como identificou o sinal?' }
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
              <input
                type="text"
                placeholder={placeholder}
                value={(form as Record<string, string>)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="p-inp"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div>
            <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>NOTAS</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Contexto, detalhes, observações..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', background: '#ede9dc',
                border: '1px solid #d4cfc4', borderRadius: 8,
                fontFamily: "'Jost',sans-serif", fontSize: 13,
                color: '#0e0e0d', resize: 'vertical', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={onClose} className="p-btn" style={{ flex: 1, padding: '12px' }}>Cancelar</button>
            <button onClick={handleSubmit} className="p-btn-gold" style={{ flex: 2, padding: '12px' }}>Adicionar Sinal</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: SINAIS ──────────────────────────────────────────────────────────────

function TabSinais({ signals, onUpdateSignal, onAddSignal }: {
  signals: ProspectSignal[]
  onUpdateSignal: (s: ProspectSignal) => void
  onAddSignal: (s: ProspectSignal) => void
}) {
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterZona, setFilterZona] = useState<string>('all')
  const [selectedSignal, setSelectedSignal] = useState<ProspectSignal | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const zonas = useMemo(() => [...new Set(signals.map(s => s.zona))].sort(), [signals])

  const filtered = useMemo(() => signals.filter(s => {
    if (filterType !== 'all' && s.type !== filterType) return false
    if (filterStatus !== 'all' && s.status !== filterStatus) return false
    if (filterPriority !== 'all' && s.priority !== filterPriority) return false
    if (filterZona !== 'all' && s.zona !== filterZona) return false
    return true
  }), [signals, filterType, filterStatus, filterPriority, filterZona])

  const kpis = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000)
    return {
      total: signals.length,
      alta: signals.filter(s => s.priority === 'alta').length,
      contactadosSemana: signals.filter(s => s.lastContact && new Date(s.lastContact) >= weekAgo).length,
      taxa: signals.length > 0 ? Math.round((signals.filter(s => s.status === 'exclusividade').length / signals.length) * 100) : 0
    }
  }, [signals])

  // Zona heatmap
  const zonaStats = useMemo(() => {
    const map: Record<string, { total: number; alta: number; avm: number }> = {}
    signals.forEach(s => {
      if (!map[s.zona]) map[s.zona] = { total: 0, alta: 0, avm: 0 }
      map[s.zona].total++
      if (s.priority === 'alta') map[s.zona].alta++
      if (s.avmEstimate) map[s.zona].avm += s.avmEstimate
    })
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total).slice(0, 8)
  }, [signals])

  return (
    <>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'TOTAL SINAIS', value: kpis.total, icon: '🎯' },
          { label: 'ALTA PRIORIDADE', value: kpis.alta, icon: '🔥' },
          { label: 'CONTACTADOS SEMANA', value: kpis.contactadosSemana, icon: '📞' },
          { label: 'TAXA CONVERSÃO', value: `${kpis.taxa}%`, icon: '✅' }
        ].map(({ label, value, icon }) => (
          <div key={label} className="p-card" style={{ padding: '18px 20px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280', marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <span style={{ fontFamily: "'Cormorant',serif", fontSize: 32, color: '#1c4a35', fontWeight: 700, lineHeight: 1 }}>{value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Zone Heatmap */}
      <div className="p-card" style={{ padding: '20px', marginBottom: 24 }}>
        <h3 style={{ fontFamily: "'Cormorant',serif", fontSize: 18, color: '#0e0e0d', margin: '0 0 16px' }}>
          Mapa de Calor por Zona
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Jost',sans-serif", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #d4cfc4' }}>
                {['Zona', 'Sinais', 'Alta Prior.', 'AVM Total', 'Score'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left',
                    fontFamily: "'DM Mono',monospace", fontSize: 10,
                    color: '#6b7280', fontWeight: 600
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zonaStats.map(([zona, stats]) => {
                const score = Math.round((stats.alta / Math.max(stats.total, 1)) * 100)
                return (
                  <tr key={zona} style={{ borderBottom: '1px solid #ede9dc' }}>
                    <td style={{ padding: '10px 12px', color: '#0e0e0d', fontWeight: 500 }}>{zona}</td>
                    <td style={{ padding: '10px 12px', color: '#0e0e0d' }}>{stats.total}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: stats.alta > 0 ? '#dc262622' : '#f3f4f6',
                        color: stats.alta > 0 ? '#dc2626' : '#6b7280',
                        padding: '2px 8px', borderRadius: 4,
                        fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700
                      }}>{stats.alta}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#1c4a35', fontWeight: 600 }}>{fmtCurrency(stats.avm)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, background: '#e5e0d5', borderRadius: 4, height: 6 }}>
                          <div style={{
                            width: `${score}%`, height: '100%', borderRadius: 4,
                            background: score > 60 ? '#059669' : score > 30 ? '#d97706' : '#dc2626'
                          }} />
                        </div>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280', minWidth: 28 }}>{score}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filters + Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="p-sel">
          <option value="all">Todos os tipos</option>
          {Object.entries(SIGNAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="p-sel">
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="p-sel">
          <option value="all">Todas as prioridades</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <select value={filterZona} onChange={e => setFilterZona(e.target.value)} className="p-sel">
          <option value="all">Todas as zonas</option>
          {zonas.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b7280' }}>
          {filtered.length} sinais
        </span>
        <button onClick={() => setShowAdd(true)} className="p-btn-gold" style={{ padding: '8px 18px' }}>
          + Adicionar Sinal
        </button>
      </div>

      {/* Signal Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(signal => (
          <div
            key={signal.id}
            onClick={() => setSelectedSignal(signal)}
            className="p-card"
            style={{
              padding: '16px 20px', cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              borderLeft: `4px solid ${SIGNAL_COLORS[signal.type]}`
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <SignalBadge type={signal.type} />
                  <StatusBadge status={signal.status} />
                  {signal.priority === 'alta' && (
                    <span style={{
                      background: '#dc262622', color: '#dc2626',
                      border: '1px solid #dc262644', borderRadius: 4,
                      padding: '2px 8px', fontSize: 10,
                      fontFamily: "'DM Mono',monospace", fontWeight: 700
                    }}>ALTA PRIORIDADE</span>
                  )}
                </div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 15, color: '#0e0e0d', fontWeight: 600, marginBottom: 2 }}>
                  {signal.address}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b7280' }}>
                  {signal.zona} · {signal.proprietario || 'Proprietário desconhecido'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: 20, color: '#1c4a35', fontWeight: 700, lineHeight: 1 }}>
                  {fmtCurrency(signal.avmEstimate)}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280', marginTop: 2 }}>AVM ESTIMATE</div>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280' }}>PROBABILIDADE CONVERSÃO</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#1c4a35', fontWeight: 700 }}>{signal.probability}%</span>
                </div>
                <ProbabilityBar value={signal.probability} />
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280', textAlign: 'right' }}>
                {signal.lastContact ? `Contacto ${fmtDate(signal.lastContact)}` : 'Sem contacto'}<br />
                {signal.outreachHistory.length} interacções
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280', fontFamily: "'Jost',sans-serif", fontSize: 15 }}>
            Nenhum sinal encontrado com os filtros seleccionados.
          </div>
        )}
      </div>

      {selectedSignal && (
        <SignalDrawer
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
          onUpdate={s => { onUpdateSignal(s); setSelectedSignal(s) }}
        />
      )}
      {showAdd && (
        <AddSignalModal onClose={() => setShowAdd(false)} onAdd={onAddSignal} />
      )}
    </>
  )
}

// ─── TAB: SEQUÊNCIAS ──────────────────────────────────────────────────────────

function TabSequencias({ sequences, onToggle }: {
  sequences: OutreachSequence[]
  onToggle: (id: number) => void
}) {
  const [expanded, setExpanded] = useState<number | null>(1)

  const channelIcon: Record<string, string> = { carta: '✉', email: '📧', telefone: '📞', whatsapp: '💬' }
  const channelColor: Record<string, string> = { carta: '#7c3aed', email: '#0284c7', telefone: '#059669', whatsapp: '#25D366' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sequences.map(seq => {
        const responseRate = seq.stats.sent > 0 ? Math.round((seq.stats.responded / seq.stats.sent) * 100) : 0
        const convRate = seq.stats.sent > 0 ? Math.round((seq.stats.converted / seq.stats.sent) * 100) : 0
        const isOpen = expanded === seq.id

        return (
          <div key={seq.id} className="p-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '20px 24px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', cursor: 'pointer'
              }}
              onClick={() => setExpanded(isOpen ? null : seq.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <h3 style={{ fontFamily: "'Cormorant',serif", fontSize: 20, color: '#0e0e0d', margin: 0 }}>{seq.name}</h3>
                  <span style={{
                    background: seq.active ? '#05996922' : '#6b728022',
                    color: seq.active ? '#059669' : '#6b7280',
                    border: `1px solid ${seq.active ? '#05996944' : '#6b728044'}`,
                    borderRadius: 4, padding: '2px 8px',
                    fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700
                  }}>{seq.active ? 'ACTIVA' : 'INACTIVA'}</span>
                </div>
                <p style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>{seq.description}</p>
                <div style={{ display: 'flex', gap: 16 }}>
                  {[
                    { label: 'ENVIADOS', value: seq.stats.sent },
                    { label: 'RESPONDIDOS', value: `${seq.stats.responded} (${responseRate}%)` },
                    { label: 'CONVERTIDOS', value: `${seq.stats.converted} (${convRate}%)` },
                    { label: 'STEPS', value: seq.steps.length },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b7280' }}>{label}</div>
                      <div style={{ fontFamily: "'Cormorant',serif", fontSize: 20, color: '#1c4a35', fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 16 }}>
                <button
                  onClick={e => { e.stopPropagation(); onToggle(seq.id) }}
                  style={{
                    background: seq.active ? '#1c4a35' : '#e5e0d5',
                    border: 'none', borderRadius: 20, width: 44, height: 24,
                    cursor: 'pointer', position: 'relative', transition: 'background 0.3s'
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: seq.active ? 22 : 3,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#f4f0e6', transition: 'left 0.3s'
                  }} />
                </button>
                <span style={{ fontSize: 16, color: '#6b7280', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : '' }}>▼</span>
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid #e5e0d5', padding: '20px 24px' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {seq.targetSignalTypes.map(t => <SignalBadge key={t} type={t} />)}
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 20, top: 20, bottom: 20,
                    width: 2, background: '#e5e0d5'
                  }} />
                  {seq.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16, position: 'relative' }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: channelColor[step.channel] + '22',
                        border: `2px solid ${channelColor[step.channel]}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, flexShrink: 0, zIndex: 1
                      }}>
                        {channelIcon[step.channel]}
                      </div>
                      <div style={{ flex: 1, background: '#ede9dc', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: channelColor[step.channel], fontWeight: 700 }}>
                            DIA {step.day} · {step.channel.toUpperCase()}
                          </span>
                          {step.condition === 'no_response_previous' && (
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b7280' }}>SE SEM RESPOSTA</span>
                          )}
                        </div>
                        <p style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#0e0e0d', margin: 0 }}>{step.template}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── TAB: GERADOR IA ──────────────────────────────────────────────────────────

function TabGerador() {
  const [signalType, setSignalType] = useState<SignalType>('heranca')
  const [msgType, setMsgType] = useState<'carta' | 'email' | 'whatsapp'>('email')
  const [ownerName, setOwnerName] = useState('')
  const [address, setAddress] = useState('')
  const [avm, setAvm] = useState('')
  const [tone, setTone] = useState<'profissional' | 'caloroso' | 'directo'>('profissional')
  const [lang, setLang] = useState<'PT' | 'EN' | 'FR'>('PT')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ subject?: string; message: string; messageType: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!address) { setError('Morada obrigatória'); return }
    setError('')
    setGenerating(true)
    setResult(null)
    try {
      const res = await fetch('/api/outbound/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signalType, messageType: msgType,
          ownerName: ownerName || undefined,
          address,
          avmEstimate: avm ? parseInt(avm.replace(/\D/g, '')) : undefined,
          tone, language: lang
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Erro HTTP ${res.status}`)
      setResult(data)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(`Erro ao gerar via IA: ${errMsg}. A usar template de base.`)
      // Fallback template
      const greet = lang === 'EN' ? 'Dear' : lang === 'FR' ? 'Cher(e)' : 'Exmo(a). Sr(a).'
      const closing = lang === 'EN' ? 'Kind regards' : lang === 'FR' ? 'Cordialement' : 'Com os melhores cumprimentos'
      setResult({
        subject: lang === 'EN' ? 'Free Property Valuation — Agency Group' : lang === 'FR' ? 'Évaluation gratuite — Agency Group' : 'Avaliação Gratuita — Agency Group',
        message: `${greet} ${ownerName || (lang === 'EN' ? 'Property Owner' : lang === 'FR' ? 'Propriétaire' : 'Proprietário')},\n\nPermita-nos apresentar os nossos serviços especializados para o imóvel em ${address}.\n\n${avm ? `A nossa análise de mercado indica um valor estimado de ${fmtCurrency(parseInt(avm.replace(/\D/g, '')))}, reflectindo a forte procura actual na zona.` : 'Temos compradores qualificados à procura de imóveis na sua zona.'}\n\nEstamos disponíveis para uma avaliação gratuita e sem compromisso, com total discrição.\n\n${closing},\nAgency Group — AMI 22506\n+351 _ _ _ _ _ _ _ _ _`,
        messageType: msgType
      })
    } finally {
      setGenerating(false)
    }
  }

  function handleCopy() {
    if (!result) return
    const text = result.subject ? `Assunto: ${result.subject}\n\n${result.message}` : result.message
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      {/* Config Panel */}
      <div className="p-card" style={{ padding: 24 }}>
        <h3 style={{ fontFamily: "'Cormorant',serif", fontSize: 22, color: '#0e0e0d', margin: '0 0 20px' }}>
          Parâmetros
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>CANAL</label>
              <select value={msgType} onChange={e => setMsgType(e.target.value as typeof msgType)} className="p-sel" style={{ width: '100%' }}>
                <option value="email">Email</option>
                <option value="carta">Carta Física</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>TIPO SINAL</label>
              <select value={signalType} onChange={e => setSignalType(e.target.value as SignalType)} className="p-sel" style={{ width: '100%' }}>
                {Object.entries(SIGNAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>MORADA *</label>
            <input
              type="text" value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Ex: Rua do Século 45, 3º Dto, Lisboa"
              className="p-inp" style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>NOME PROPRIETÁRIO (opcional)</label>
            <input
              type="text" value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="Ex: João Silva"
              className="p-inp" style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>ESTIMATIVA AVM (€)</label>
            <input
              type="text" value={avm}
              onChange={e => setAvm(e.target.value)}
              placeholder="Ex: 850000"
              className="p-inp" style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>TOM</label>
              <select value={tone} onChange={e => setTone(e.target.value as typeof tone)} className="p-sel" style={{ width: '100%' }}>
                <option value="profissional">Profissional</option>
                <option value="caloroso">Caloroso</option>
                <option value="directo">Directo</option>
              </select>
            </div>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: 6 }}>IDIOMA</label>
              <select value={lang} onChange={e => setLang(e.target.value as typeof lang)} className="p-sel" style={{ width: '100%' }}>
                <option value="PT">Português</option>
                <option value="EN">English</option>
                <option value="FR">Français</option>
              </select>
            </div>
          </div>
          {error && (
            <div style={{
              background: '#dc262222', border: '1px solid #dc262244',
              borderRadius: 8, padding: '8px 12px',
              fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#dc2626'
            }}>{error}</div>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="p-btn-gold"
            style={{ padding: '14px', fontSize: 15, opacity: generating ? 0.7 : 1 }}
          >
            {generating ? '⏳ A gerar mensagem...' : '⚡ Gerar por IA'}
          </button>
        </div>
      </div>

      {/* Output Panel */}
      <div>
        {!result && !generating && (
          <div className="p-card" style={{
            padding: '60px 32px', textAlign: 'center',
            borderStyle: 'dashed', borderColor: '#c9a96e66'
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉</div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: 20, color: '#0e0e0d', marginBottom: 8 }}>
              Configure e gere
            </div>
            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#6b7280' }}>
              A IA criará uma mensagem personalizada para cada tipo de sinal e proprietário.
            </div>
          </div>
        )}
        {generating && (
          <div className="p-card" style={{ padding: '60px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⚙</div>
            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 14, color: '#6b7280' }}>
              A IA está a redigir a mensagem...
            </div>
          </div>
        )}
        {result && (
          <div className="p-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Cormorant',serif", fontSize: 20, color: '#0e0e0d', margin: 0 }}>
                Mensagem Gerada
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <SignalBadge type={signalType} />
                <span style={{
                  background: '#c9a96e22', color: '#c9a96e',
                  border: '1px solid #c9a96e44', borderRadius: 4,
                  padding: '2px 8px', fontSize: 10,
                  fontFamily: "'DM Mono',monospace", fontWeight: 700
                }}>{msgType.toUpperCase()}</span>
              </div>
            </div>

            {/* Carta header */}
            {result.messageType === 'carta' && (
              <div style={{
                background: '#1c4a35', color: '#f4f0e6',
                borderRadius: '8px 8px 0 0', padding: '14px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: 18, fontWeight: 700 }}>Agency Group</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, opacity: 0.7 }}>AMI 22506 · Lisboa · Porto · Algarve</div>
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, opacity: 0.7, textAlign: 'right' }}>
                  Lisboa, {new Date().toLocaleDateString('pt-PT')}<br />
                  Confidencial
                </div>
              </div>
            )}

            {/* Subject line for email */}
            {result.subject && result.messageType !== 'carta' && (
              <div style={{
                background: '#ede9dc', borderRadius: '8px 8px 0 0',
                padding: '10px 16px', borderBottom: '1px solid #d4cfc4'
              }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280' }}>ASSUNTO: </span>
                <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#0e0e0d', fontWeight: 600 }}>
                  {result.subject}
                </span>
              </div>
            )}

            <div style={{
              background: '#ede9dc',
              borderRadius: result.messageType === 'carta' ? '0 0 8px 8px' : result.subject ? '0 0 8px 8px' : 8,
              padding: 20
            }}>
              <pre style={{
                fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#0e0e0d',
                whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0
              }}>
                {result.message}
              </pre>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleCopy} className="p-btn" style={{ flex: 1, padding: '10px' }}>
                {copied ? '✓ Copiado!' : 'Copiar Mensagem'}
              </button>
              <button
                onClick={() => { setResult(null); setAddress(''); setOwnerName(''); setAvm('') }}
                className="p-btn"
                style={{ padding: '10px 16px' }}
              >
                Nova
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB: PIPELINE ────────────────────────────────────────────────────────────

function TabPipeline({ signals, onUpdateSignal }: {
  signals: ProspectSignal[]
  onUpdateSignal: (s: ProspectSignal) => void
}) {
  const [dragging, setDragging] = useState<number | null>(null)

  const byStage = useMemo(() => {
    const map: Record<string, ProspectSignal[]> = {}
    PIPELINE_STAGES.forEach(s => { map[s.key] = [] })
    signals.forEach(sig => { map[sig.status]?.push(sig) })
    return map
  }, [signals])

  const stageAvm = (stage: string) =>
    byStage[stage].reduce((sum, s) => sum + (s.avmEstimate || 0), 0)

  function handleMoveSignal(signalId: number, targetStatus: string) {
    const sig = signals.find(s => s.id === signalId)
    if (!sig) return
    onUpdateSignal({ ...sig, status: targetStatus as ProspectSignal['status'] })
    setDragging(null)
  }

  return (
    <div>
      {/* Pipeline summary */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
        {PIPELINE_STAGES.map(stage => (
          <div key={stage.key} style={{
            background: stage.color + '15', border: `1px solid ${stage.color}33`,
            borderRadius: 8, padding: '10px 12px', textAlign: 'center'
          }}>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: 24, color: stage.color, fontWeight: 700 }}>
              {byStage[stage.key]?.length || 0}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b7280', marginTop: 2 }}>
              {stage.label.toUpperCase()}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: stage.color, marginTop: 4, fontWeight: 700 }}>
              {fmtCurrency(stageAvm(stage.key))}
            </div>
          </div>
        ))}
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12 }}>
        {PIPELINE_STAGES.map(stage => (
          <div
            key={stage.key}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const id = parseInt(e.dataTransfer.getData('signalId'))
              handleMoveSignal(id, stage.key)
            }}
            style={{
              minWidth: 220, maxWidth: 240, flexShrink: 0,
              background: '#ede9dc', borderRadius: 12, padding: '14px 12px'
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12, paddingBottom: 10, borderBottom: `2px solid ${stage.color}`
            }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: stage.color, fontWeight: 700 }}>
                {stage.label.toUpperCase()}
              </span>
              <span style={{
                background: stage.color, color: '#fff',
                borderRadius: '50%', width: 20, height: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700
              }}>
                {byStage[stage.key]?.length || 0}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 80 }}>
              {byStage[stage.key]?.map(sig => (
                <div
                  key={sig.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('signalId', String(sig.id))
                    setDragging(sig.id)
                  }}
                  onDragEnd={() => setDragging(null)}
                  style={{
                    background: '#f4f0e6', borderRadius: 8, padding: '12px',
                    cursor: 'grab', borderLeft: `3px solid ${SIGNAL_COLORS[sig.type]}`,
                    opacity: dragging === sig.id ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
                  }}
                >
                  <div style={{ marginBottom: 4 }}>
                    <SignalBadge type={sig.type} />
                  </div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 12, color: '#0e0e0d', fontWeight: 600, marginBottom: 2, lineHeight: 1.3 }}>
                    {sig.address.length > 30 ? sig.address.slice(0, 30) + '...' : sig.address}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280', marginBottom: 6 }}>
                    {sig.zona.split(' - ')[1] || sig.zona}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'Cormorant',serif", fontSize: 14, color: '#1c4a35', fontWeight: 700 }}>
                      {fmtCurrency(sig.avmEstimate)}
                    </span>
                    <span style={{
                      fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b7280',
                      background: '#ede9dc', padding: '2px 6px', borderRadius: 4
                    }}>
                      {daysSince(sig.createdAt)}d
                    </span>
                  </div>
                  {/* Move buttons */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {PIPELINE_STAGES.filter(s => s.key !== stage.key).slice(0, 3).map(s => (
                      <button
                        key={s.key}
                        onClick={() => handleMoveSignal(sig.id, s.key)}
                        title={`Mover para ${s.label}`}
                        style={{
                          flex: 1, border: 'none', borderRadius: 4, padding: '3px 0',
                          background: s.color + '22', color: s.color,
                          fontFamily: "'DM Mono',monospace", fontSize: 8, cursor: 'pointer',
                          fontWeight: 700
                        }}
                      >
                        {s.label.slice(0, 4).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {byStage[stage.key]?.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '20px 0',
                  fontFamily: "'DM Mono',monospace", fontSize: 10,
                  color: '#c4bfb4', border: '2px dashed #d4cfc4',
                  borderRadius: 8
                }}>VAZIO</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function PortalOutbound() {
  const [activeTab, setActiveTab] = useState<'sinais' | 'sequencias' | 'gerador' | 'pipeline'>('sinais')
  const [signals, setSignals] = useState<ProspectSignal[]>(() => {
    if (typeof window === 'undefined') return INITIAL_SIGNALS
    try {
      const stored = localStorage.getItem('ag_outbound_signals')
      return stored ? JSON.parse(stored) : INITIAL_SIGNALS
    } catch { return INITIAL_SIGNALS }
  })
  const [sequences, setSequences] = useState<OutreachSequence[]>(DEFAULT_SEQUENCES)
  const [liveSource, setLiveSource] = useState<'live' | 'demo'>('demo')

  // ── Live contacts/signals fetch ────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/signals')
      .then(r => { if (!r.ok) throw new Error('not ok'); return r.json() })
      .then((data: { signals?: ProspectSignal[] }) => {
        if (Array.isArray(data.signals) && data.signals.length > 0) {
          setSignals(data.signals)
        }
        setLiveSource('live')
      })
      .catch(() => setLiveSource('demo'))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('ag_outbound_signals', JSON.stringify(signals))
    } catch { /* quota */ }
  }, [signals])

  function handleUpdateSignal(updated: ProspectSignal) {
    const recalc = { ...updated, probability: calcSignalProbability(updated) }
    setSignals(prev => prev.map(s => s.id === recalc.id ? recalc : s))
  }

  function handleAddSignal(sig: ProspectSignal) {
    setSignals(prev => [sig, ...prev])
  }

  function handleToggleSequence(id: number) {
    setSequences(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s))
  }

  const tabs = [
    { key: 'sinais', label: 'Sinais', count: signals.filter(s => s.status !== 'arquivo').length },
    { key: 'sequencias', label: 'Sequências', count: sequences.filter(s => s.active).length },
    { key: 'gerador', label: 'Gerador IA', count: null },
    { key: 'pipeline', label: 'Pipeline', count: null }
  ] as const

  const totalAvm = signals.reduce((sum, s) => sum + (s.avmEstimate || 0), 0)
  const activeSignals = signals.filter(s => s.status !== 'arquivo')
  const avgProb = activeSignals.length > 0
    ? Math.round(activeSignals.reduce((sum, s) => sum + s.probability, 0) / activeSignals.length)
    : 0

  return (
    <div style={{ background: '#f4f0e6', minHeight: '100vh', padding: '32px 24px', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .p-card { background: #fff; border: 1px solid #e5e0d5; border-radius: 12px; }
        .p-btn {
          background: #1c4a35; color: #f4f0e6; border: none; border-radius: 8px;
          font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: opacity 0.2s; letter-spacing: 0.04em;
        }
        .p-btn:hover { opacity: 0.85; }
        .p-btn-gold {
          background: #c9a96e; color: #0e0e0d; border: none; border-radius: 8px;
          font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 700;
          cursor: pointer; transition: opacity 0.2s; letter-spacing: 0.04em;
        }
        .p-btn-gold:hover { opacity: 0.88; }
        .p-inp {
          background: #ede9dc; border: 1px solid #d4cfc4; border-radius: 8px;
          padding: 10px 12px; font-family: 'Jost', sans-serif; font-size: 13px;
          color: #0e0e0d; outline: none; transition: border-color 0.2s;
        }
        .p-inp:focus { border-color: #1c4a35; }
        .p-sel {
          background: #ede9dc; border: 1px solid #d4cfc4; border-radius: 8px;
          padding: 8px 12px; font-family: 'DM Mono', monospace; font-size: 11px;
          color: #0e0e0d; outline: none; cursor: pointer;
        }
        .p-label {
          font-family: 'DM Mono', monospace; font-size: 10px;
          color: #6b7280; font-weight: 600; letter-spacing: 0.06em;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#c9a96e', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>
              AGENCY GROUP · AMI 22506
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontFamily: "'Cormorant',serif", fontSize: 38, color: '#0e0e0d', margin: 0, lineHeight: 1.1 }}>
                Outbound Off-Market
              </h1>
              {/* LIVE / DEMO badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 999,
                background: liveSource === 'live' ? 'rgba(34,197,94,.1)' : 'rgba(251,191,36,.1)',
                border: `1px solid ${liveSource === 'live' ? 'rgba(34,197,94,.35)' : 'rgba(251,191,36,.35)'}`,
              }}>
                <span style={{
                  display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                  background: liveSource === 'live' ? '#22c55e' : '#fbbf24',
                  boxShadow: liveSource === 'live' ? '0 0 0 2px rgba(34,197,94,.25)' : 'none',
                }} />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: liveSource === 'live' ? '#16a34a' : '#d97706' }}>
                  {liveSource === 'live' ? 'LIVE' : 'DEMO'}
                </span>
              </div>
            </div>
            <p style={{ fontFamily: "'Jost',sans-serif", fontSize: 14, color: '#6b7280', margin: '8px 0 0' }}>
              Motor de prospecção e captação off-market — o mais avançado de Portugal
            </p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280' }}>PORTFÓLIO PROSPECTADO</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: 26, color: '#1c4a35', fontWeight: 700 }}>{fmtCurrency(totalAvm)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b7280' }}>PROB. MÉDIA</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: 26, color: '#c9a96e', fontWeight: 700 }}>{avgProb}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 28,
        background: '#ede9dc', borderRadius: 10, padding: 4,
        width: 'fit-content'
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: activeTab === t.key ? '#1c4a35' : 'transparent',
              color: activeTab === t.key ? '#f4f0e6' : '#6b7280',
              fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700,
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            {t.label}
            {t.count !== null && (
              <span style={{
                background: activeTab === t.key ? '#c9a96e' : '#d4cfc4',
                color: activeTab === t.key ? '#0e0e0d' : '#6b7280',
                borderRadius: '50%', width: 18, height: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'sinais' && (
        <TabSinais signals={signals} onUpdateSignal={handleUpdateSignal} onAddSignal={handleAddSignal} />
      )}
      {activeTab === 'sequencias' && (
        <TabSequencias sequences={sequences} onToggle={handleToggleSequence} />
      )}
      {activeTab === 'gerador' && <TabGerador />}
      {activeTab === 'pipeline' && (
        <TabPipeline signals={signals} onUpdateSignal={handleUpdateSignal} />
      )}
    </div>
  )
}
