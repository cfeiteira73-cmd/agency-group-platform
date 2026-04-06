import { NextRequest, NextResponse } from 'next/server'

interface NeighborhoodData {
  zone: string
  area: string
  scores: {
    overall: number
    walkability: number
    transport: number
    schools: number
    restaurants: number
    safety: number
    greenSpaces: number
    nightlife: number
    beach: number
  }
  highlights: string[]
  schools: Array<{ name: string; type: string; rating: string; distance: string }>
  restaurants: Array<{ name: string; cuisine: string; michelin?: boolean; distance: string }>
  transport: Array<{ type: string; name: string; walkTime: string }>
  safetyIndex: string
  walkTime: Record<string, string>
  bestFor: string[]
  notIdealFor: string[]
}

const NEIGHBORHOODS: Record<string, NeighborhoodData> = {
  'chiado': {
    zone: 'Lisboa',
    area: 'Chiado',
    scores: { overall: 96, walkability: 98, transport: 95, schools: 82, restaurants: 99, safety: 88, greenSpaces: 72, nightlife: 95, beach: 45 },
    highlights: ['Coração cultural de Lisboa', 'Bertrand — livraria mais antiga do mundo', 'Elétrico 28 à porta', 'Restaurantes Michelin a 5 min'],
    schools: [
      { name: 'Colégio São João de Brito', type: 'Privado Internacional', rating: '★★★★★', distance: '1.2km' },
      { name: 'Escola Secundária de Camões', type: 'Público', rating: '★★★★', distance: '0.8km' },
    ],
    restaurants: [
      { name: 'Belcanto', cuisine: 'Portuguese Fine Dining', michelin: true, distance: '3min' },
      { name: 'Solar dos Presuntos', cuisine: 'Portuguesa Tradicional', distance: '5min' },
      { name: 'Taberna da Rua das Flores', cuisine: 'Petiscos', distance: '2min' },
    ],
    transport: [
      { type: 'Metro', name: 'Baixa-Chiado (Azul+Verde)', walkTime: '2min' },
      { type: 'Elétrico', name: 'Linha 28 — Santa Apolónia/Campo Ourique', walkTime: '1min' },
      { type: 'Autobus', name: 'Múltiplas linhas Carris', walkTime: '1min' },
    ],
    safetyIndex: 'Muito Seguro',
    walkTime: { 'Mercado Time Out': '5min', 'Av. da Liberdade': '10min', 'Torre de Belém': '25min carro', 'Aeroporto': '20min carro' },
    bestFor: ['Profissionais urbanos', 'Compradores internacionais', 'Investimento AL premium'],
    notIdealFor: ['Famílias com crianças pequenas (sem espaço verde próximo)', 'Quem prefere calma e silêncio'],
  },
  'principe-real': {
    zone: 'Lisboa',
    area: 'Príncipe Real',
    scores: { overall: 94, walkability: 95, transport: 88, schools: 85, restaurants: 96, safety: 90, greenSpaces: 82, nightlife: 85, beach: 42 },
    highlights: ['Bairro mais trendy de Lisboa 2026', 'Jardim do Príncipe Real', 'Design stores e galerias de arte', 'Comunidade internacional consolidada'],
    schools: [
      { name: 'Lycée Français Charles Lepierre', type: 'Francês Internacional', rating: '★★★★★', distance: '1.5km' },
      { name: 'Deutsche Schule Lissabon', type: 'Alemão Internacional', rating: '★★★★★', distance: '2km' },
    ],
    restaurants: [
      { name: 'Alma', cuisine: 'Fine Dining', michelin: true, distance: '8min' },
      { name: 'Tasca do Chico', cuisine: 'Fado & Petiscos', distance: '5min' },
    ],
    transport: [
      { type: 'Metro', name: 'Rato (Amarela)', walkTime: '5min' },
      { type: 'Autobus', name: 'Linhas 758, 773', walkTime: '2min' },
    ],
    safetyIndex: 'Muito Seguro',
    walkTime: { 'Chiado': '10min', 'Avenida da Liberdade': '8min', 'Jardim Botânico': '3min', 'Aeroporto': '22min carro' },
    bestFor: ['HNWI', 'Profissionais criativos', 'Expats franceses e alemães'],
    notIdealFor: ['Quem precisa de estacionamento fácil', 'Budget compradores'],
  },
  'cascais-centro': {
    zone: 'Cascais',
    area: 'Cascais Centro',
    scores: { overall: 91, walkability: 88, transport: 78, schools: 90, restaurants: 88, safety: 96, greenSpaces: 92, nightlife: 72, beach: 98 },
    highlights: ['Praia da Rainha a 3 min a pé', 'Marina de Cascais', 'Escola Internacional St. Julian\'s', 'Linha de comboio directa a Lisboa (40min)'],
    schools: [
      { name: 'St. Julian\'s School', type: 'Britânico Internacional', rating: '★★★★★', distance: '2km' },
      { name: 'Cascais International School', type: 'Internacional IB', rating: '★★★★', distance: '3km' },
      { name: 'Colégio Nossa Senhora do Rosário', type: 'Privado PT', rating: '★★★★', distance: '1km' },
    ],
    restaurants: [
      { name: 'Casa da Guia', cuisine: 'Seafood & Views', distance: '8min carro' },
      { name: 'Dom Rodrigo', cuisine: 'Portuguesa Premium', distance: '5min' },
      { name: 'Furnas do Guincho', cuisine: 'Seafood Michelin', michelin: true, distance: '15min carro' },
    ],
    transport: [
      { type: 'Comboio', name: 'Linha de Cascais → Lisboa Cais do Sodré (40min)', walkTime: '8min' },
      { type: 'Autobus', name: 'Scotturb para Sintra e Estoril', walkTime: '5min' },
    ],
    safetyIndex: 'Extremamente Seguro',
    walkTime: { 'Praia': '3min', 'Marina': '5min', 'Supermercados': '5min', 'Lisboa': '35min comboio', 'Aeroporto': '40min carro' },
    bestFor: ['Famílias expatriadas', 'Compradores britânicos/americanos', 'Reforma de qualidade', 'Work from home'],
    notIdealFor: ['Quem trabalha em Lisboa todos os dias (pendular cansativo)', 'Nightlife enthusiasts'],
  },
  'foz-do-douro': {
    zone: 'Porto',
    area: 'Foz do Douro',
    scores: { overall: 90, walkability: 84, transport: 72, schools: 88, restaurants: 90, safety: 94, greenSpaces: 88, nightlife: 65, beach: 95 },
    highlights: ['A zona mais premium do Porto', 'Praia do Molhe a 5 min', 'Palacetes históricos renovados', 'Rio Douro + Oceano Atlântico'],
    schools: [
      { name: 'Colégio EFANOR', type: 'Privado Internacional', rating: '★★★★★', distance: '3km' },
      { name: 'Escola Alemã do Porto', type: 'Alemão Internacional', rating: '★★★★', distance: '4km' },
    ],
    restaurants: [
      { name: 'The Yeatman', cuisine: 'Fine Dining com vista Douro', michelin: true, distance: '8min carro' },
      { name: 'Pedro Lemos', cuisine: 'Michelin Foz', michelin: true, distance: '5min' },
    ],
    transport: [
      { type: 'Metro', name: 'Estação Foz (linha A/B/C/E/F) — ligação ao aeroporto', walkTime: '15min' },
      { type: 'Autobus', name: 'STCP linhas 200, 201', walkTime: '5min' },
    ],
    safetyIndex: 'Muito Seguro',
    walkTime: { 'Praia': '5min', 'Centro Porto': '20min carro', 'Aeroporto': '25min', 'V.N. Gaia': '15min carro' },
    bestFor: ['HNWI que preferem Porto a Lisboa', 'Famílias', 'Investimento rendimento (5.3% yield)'],
    notIdealFor: ['Quem quer nightlife intenso', 'Mobilidade pedestre diária (necessita carro)'],
  },
  'comporta': {
    zone: 'Comporta',
    area: 'Comporta',
    scores: { overall: 88, walkability: 45, transport: 30, schools: 35, restaurants: 78, safety: 99, greenSpaces: 99, nightlife: 55, beach: 100 },
    highlights: ['Praias selvagens intocadas', 'Zero desenvolvimento excessivo', 'Privacidade absoluta', 'Destino de eleição da elite europeia'],
    schools: [
      { name: 'Colégio São Tomás (Setúbal, 40min)', type: 'Privado', rating: '★★★★', distance: '40min carro' },
    ],
    restaurants: [
      { name: 'Sublime Comporta', cuisine: 'Farm-to-table luxury', distance: '10min' },
      { name: 'Museu do Arroz', cuisine: 'Seafood local', distance: '5min' },
      { name: 'The Crow Bar', cuisine: 'Beach bar gourmet', distance: '15min' },
    ],
    transport: [
      { type: 'Carro', name: 'Único meio prático de transporte', walkTime: 'Necessário' },
      { type: 'Ferry', name: 'Tróia-Setúbal (sazonal)', walkTime: '20min' },
    ],
    safetyIndex: 'Paradisíaco — Crime zero',
    walkTime: { 'Praia': '10min', 'Lisboa': '1h30 carro', 'Supermercado': '15min', 'Aeroporto': '1h45 carro' },
    bestFor: ['UHNWI buscando exclusividade total', 'Second home de luxo', 'Retiro de privacy'],
    notIdealFor: ['Residência principal com crianças em idade escolar', 'Sem carro', 'Quem trabalha diariamente em cidade'],
  },
  'funchal': {
    zone: 'Madeira',
    area: 'Funchal',
    scores: { overall: 87, walkability: 80, transport: 75, schools: 82, restaurants: 86, safety: 95, greenSpaces: 94, nightlife: 68, beach: 78 },
    highlights: ['Clima perfeito 22°C média anual', 'IFICI+ elegível', 'Voos directos Europa 3h', 'Crescimento +28% YoY'],
    schools: [
      { name: 'Colégio Infante D. Henrique', type: 'Internacional', rating: '★★★★', distance: '2km' },
      { name: 'Deutsche Schule Funchal', type: 'Alemão', rating: '★★★★', distance: '3km' },
    ],
    restaurants: [
      { name: 'William (Belmond)', cuisine: 'Fine Dining com vista oceano', michelin: true, distance: '10min' },
      { name: 'Armazém do Sal', cuisine: 'Madeirense Premium', distance: '8min' },
    ],
    transport: [
      { type: 'Aeroporto', name: 'Voos directos: Lisboa 1h30, Londres 3h, Frankfurt 3h', walkTime: '20min carro' },
      { type: 'Autobus', name: 'Rede Horários do Funchal', walkTime: '5min' },
    ],
    safetyIndex: 'Muito Seguro',
    walkTime: { 'Centro Funchal': '10min', 'Monte': '20min teleférico', 'Praias naturais': '20min carro', 'Aeroporto': '20min carro' },
    bestFor: ['Nómadas digitais', 'Reforma europeia de luxo', 'IFICI+ beneficiários', 'Compradores alemães/britânicos'],
    notIdealFor: ['Quem precisa de trânsito directo por terra para Europa', 'Famílias que preferem ambiente cosmopolita intenso'],
  },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const area = searchParams.get('area') || ''
  const zone = searchParams.get('zone') || ''

  // Find best match
  const key = Object.keys(NEIGHBORHOODS).find(k => {
    const n = NEIGHBORHOODS[k]
    return n.area.toLowerCase().includes(area.toLowerCase()) ||
           n.zone.toLowerCase().includes(zone.toLowerCase()) ||
           area.toLowerCase().includes(k.toLowerCase()) ||
           zone.toLowerCase().includes(k.toLowerCase())
  }) || 'chiado'

  const data = NEIGHBORHOODS[key]

  return NextResponse.json({
    ...data,
    source: 'Agency Group Intelligence Q1 2026',
    agency: 'Agency Group · AMI 22506 · www.agencygroup.pt · +351 919 948 986',
  })
}
