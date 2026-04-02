import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

// All properties summary for AI matching
const PROPERTIES_SUMMARY = [
  { id:'AG-2026-010', nome:'Penthouse Príncipe Real', zona:'Lisboa', tipo:'Apartamento', preco:2850000, area:220, quartos:3, piscina:true, terraco:true, vista:'Cidade', badge:'Exclusivo', features:['Última Cave Penthouse','Rooftop privativo','Vistas 360°'] },
  { id:'AG-2026-011', nome:'Apartamento Chiado', zona:'Lisboa', tipo:'Apartamento', preco:1450000, area:145, quartos:2, vista:'Rio Tejo', features:['Vista Tejo','Edifício histórico recuperado'] },
  { id:'AG-2026-012', nome:'Moradia Belém', zona:'Lisboa', tipo:'Moradia', preco:3200000, area:380, quartos:5, piscina:true, jardim:true, features:['Jardim privativo 800m²','Piscina aquecida'] },
  { id:'AG-2026-013', nome:'T3 Campo de Ourique', zona:'Lisboa', tipo:'Apartamento', preco:890000, area:165, quartos:3, features:['Bairro residencial premium','Remodelado 2025'] },
  { id:'AG-2026-020', nome:'Villa Quinta da Marinha', zona:'Cascais', tipo:'Villa', preco:3800000, area:450, quartos:5, piscina:true, garagem:true, vista:'Golf', badge:'Exclusivo', features:['Condomínio privado','Vista campo de golfe','Próximo praia'] },
  { id:'AG-2026-021', nome:'Moradia Estoril Frente Mar', zona:'Cascais', tipo:'Moradia', preco:2100000, area:280, quartos:4, piscina:true, vista:'Mar', features:['50m da praia','Piscina aquecida','Vista mar frontal'] },
  { id:'AG-2026-022', nome:'Apartamento Centro Cascais', zona:'Cascais', tipo:'Apartamento', preco:1350000, area:185, quartos:3, terraco:true, vista:'Mar', features:['Centro histórico','Terraço com vista mar'] },
  { id:'AG-2026-030', nome:'Herdade Comporta Exclusiva', zona:'Comporta', tipo:'Herdade', preco:6500000, area:850, quartos:6, piscina:true, jardim:true, badge:'Off-Market', features:['5 hectares','Privacidade total','Natureza intacta'] },
  { id:'AG-2026-031', nome:'Villa Carvalhal', zona:'Comporta', tipo:'Villa', preco:2800000, area:320, quartos:4, piscina:true, features:['Vista arrozais','Design contemporâneo'] },
  { id:'AG-2026-040', nome:'Apartamento Foz do Douro', zona:'Porto', tipo:'Apartamento', preco:980000, area:180, quartos:3, vista:'Rio', features:['Vista Rio Douro','Zona premium Porto'] },
  { id:'AG-2026-041', nome:'Moradia Boavista', zona:'Porto', tipo:'Moradia', preco:1250000, area:240, quartos:4, jardim:true, features:['Jardim privativo','Zona residencial nobre'] },
  { id:'AG-2026-042', nome:'T2 Cedofeita', zona:'Porto', tipo:'Apartamento', preco:520000, area:110, quartos:2, features:['Remodelado 2025','Centro Porto'] },
  { id:'AG-2026-050', nome:'Villa Vale do Lobo Golf', zona:'Algarve', tipo:'Villa', preco:4200000, area:480, quartos:5, piscina:true, garagem:true, features:['Resort premium','Campo de golfe','Piscina aquecida'] },
  { id:'AG-2026-051', nome:'Apartamento Vilamoura Marina', zona:'Algarve', tipo:'Apartamento', preco:1100000, area:175, quartos:3, vista:'Marina', features:['Vista marina','Condomínio com piscina'] },
  { id:'AG-2026-060', nome:'Apartamento Funchal Prime', zona:'Madeira', tipo:'Apartamento', preco:980000, area:165, quartos:3, vista:'Oceano', badge:'Destaque', features:['Vista oceano 180°','IFICI elegível','Madeira prime'] },
  { id:'AG-2026-061', nome:'Villa Câmara de Lobos', zona:'Madeira', tipo:'Villa', preco:1450000, area:290, quartos:4, vista:'Atlântico', features:['Falésias atlânticas','Churchill pintou aqui'] },
  { id:'AG-2026-070', nome:'Quinta Histórica Sintra', zona:'Sintra', tipo:'Quinta', preco:2800000, area:650, quartos:6, jardim:true, features:['Zona UNESCO','Quinta do séc. XIX','Jardim 2000m²'] },
  { id:'AG-2026-071', nome:'Moradia Colares Serra', zona:'Sintra', tipo:'Moradia', preco:1200000, area:280, quartos:4, jardim:true, features:['Vista Serra Sintra','Jardim orgânico'] },
  { id:'AG-2026-080', nome:'Apartamento Ericeira Vista Mar', zona:'Ericeira', tipo:'Apartamento', preco:650000, area:120, quartos:2, vista:'Mar', features:['Reserva mundial de surf','100m das ondas'] },
  { id:'AG-2026-081', nome:'Moradia Mafra', zona:'Ericeira', tipo:'Moradia', preco:1100000, area:240, quartos:4, jardim:true, features:['15min Ericeira','Jardim privativo'] },
]

export async function POST(req: NextRequest) {
  try {
    const { query, lang } = await req.json()

    if (!query || query.length < 3) {
      return NextResponse.json({ error: 'Query too short' }, { status: 400 })
    }

    const prompt = `Analyze this property search query and find the best matching properties from the list.

SEARCH QUERY: "${query}"
LANGUAGE: ${lang || 'pt'}

AVAILABLE PROPERTIES:
${JSON.stringify(PROPERTIES_SUMMARY, null, 2)}

Match the query to the most relevant properties. Consider: price range mentioned, zone preferences, property type, features (pool, garden, sea view, etc), lifestyle cues ("family", "investment", "retire").

Respond ONLY with valid JSON:
{
  "matches": [
    {
      "id": "property id",
      "relevanceScore": number 0-100,
      "matchReason": "Why this matches in 1-2 sentences in ${lang || 'pt'}",
      "highlights": ["3 key matching features"]
    }
  ],
  "searchSummary": "Brief summary of what was searched and found in ${lang || 'pt'}",
  "suggestedFilters": {
    "zonas": ["zone1", "zone2"],
    "maxPreco": number or null,
    "minPreco": number or null,
    "tipo": "Apartamento|Villa|Moradia|etc or null"
  }
}

Return maximum 5 matches, ordered by relevance. Only include properties with relevanceScore >= 40.`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const result = JSON.parse(clean)
      return NextResponse.json(result)
    } catch {
      return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
    }
  } catch (error) {
    console.error('natural-search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
