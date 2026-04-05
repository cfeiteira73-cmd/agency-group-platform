import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'

const ContentSchema = z.object({
  zona:         z.string().min(1, 'Zona é obrigatória'),
  preco:        z.union([z.string(), z.number()]).refine(v => Number(v) > 0, 'Preço deve ser positivo'),
  tipo:         z.string().optional(),
  area:         z.union([z.string(), z.number()]).optional(),
  quartos:      z.union([z.string(), z.number()]).optional(),
  features:     z.array(z.string()).optional(),
  descricao:    z.string().optional(),
  fotos_count:  z.number().int().min(0).optional(),
  fotos_base64: z.array(z.string()).optional(),
  video_url:    z.string().url().optional().or(z.literal('')),
  listing_url:  z.string().url().optional().or(z.literal('')),
  persona:      z.string().optional().default('hnwi'),
  idiomas:      z.array(z.string()).optional().default(['pt', 'en', 'fr']),
})


// Rate limiting
const rateMap = new Map<string, { count: number; reset: number }>()
function checkRate(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.reset) { rateMap.set(ip, { count: 1, reset: now + 3_600_000 }); return true }
  if (entry.count >= 40) return false
  entry.count++; return true
}

// ─── Buyer Persona Profiles ────────────────────────────────────────────────────
const PERSONAS: Record<string, string> = {
  americano: `BUYER PERSONA — NORTE-AMERICANO (prime target: 35-55, tech/finance/law, $2M-$10M budget):
  - Trigger primário: segurança patrimonial + lifestyle europeu superior
  - Enquadramento: "the European base you've always wanted" — Portugal como hub entre NY/SF e Europa
  - Comparação de ancoragem: US equivalente ($500/sqft DC vs €900/sqft Lisboa premium)
  - NHR/IFICI: argumento decisivo — "10 years of reduced taxation" em destaque
  - Tom: directo, data-driven, ROI-focused mas com lifestyle aspiracional
  - Trigger secundário: segurança, qualidade de vida dos filhos, healthcare, educação internacional
  - Evitar: termos excessivamente formais ou europeus — usar inglês americano, não britânico`,

  frances: `BUYER PERSONA — FRANCÊS (target: 45-65, cadres supérieurs/entrepreneurs, €600K-€3M):
  - Trigger primário: art de vivre + fuga ao sistema fiscal francês (IR + ISF equivalentes)
  - Comparação ancoragem: Côte d'Azur vs Algarve/Lisboa — mesma qualidade climática, 60% menos preço
  - Tom: literário, sensorial, elegante — os franceses detestam copy agressivo
  - NHR/IFICI: "10 ans d'imposition réduite" — argumento decisivo
  - Cultura: mencionar gastronomia, vinho, proximidade Paris (2h30 voo)
  - Comparação: "l'équivalent à Saint-Tropez ou Cannes coûterait 4x plus"
  - Evitar: anglicismos, tom americano de venda agressiva`,

  britanico: `BUYER PERSONA — BRITÂNICO (target: 50-70, property investor/retired professional, £500K-£3M):
  - Trigger primário: post-Brexit residency + sunny escape from UK weather
  - Comparação ancoragem: Cotswolds cottage vs Algarve villa — same budget, 300 days of sun
  - Tom: understatement britânico — não "amazing", mas "rather special" e "quietly exceptional"
  - NHR regime: "10 years of tax efficiency" — framing fiscal conservador
  - Golf, marina, cricket analogies para Algarve/Cascais quando relevante
  - Healthcare comparison: "private healthcare at a fraction of UK Bupa costs"
  - Evitar: entusiasmo excessivo — o britânico desconfia de over-selling`,

  brasileiro: `BUYER PERSONA — BRASILEIRO (target: 35-60, empresário/HNWI, R$5M-R$50M):
  - Trigger primário: diversificação patrimonial + passaporte/residência europeia + segurança
  - Portugal como "porta de entrada para a Europa" — passaporte Schengen em 5 anos
  - Tom: caloroso, pessoal, relacional — o brasileiro decide com o coração depois de justificar com a cabeça
  - Conexão cultural: língua, gastronomia, futebol, comunidade brasileira consolidada em Lisboa/Porto
  - Comparação: "No Brasil comprarias um apartamento em Ipanema ou Jardins. Em Lisboa tens o mesmo por menos e em euros."
  - NHR: "tributação reduzida durante 10 anos para novos residentes fiscais"
  - Evitar: referências a crise política — foco total em Portugal como porto seguro`,

  hnwi: `BUYER PERSONA — HNWI GLOBAL (family offices, $10M+, multi-nationality):
  - Trigger primário: capital preservation + legacy asset + geopolitical hedge
  - Tom: ultra-discreto, peer-to-peer — nunca "oferta imperdível", sempre "an asset of this calibre rarely presents itself"
  - Frame: este imóvel não é uma compra — é uma decisão de alocação de capital patrimonial
  - Comparação: Londres (Mayfair/Chelsea), Paris (16ème), Monaco, Dubai — Portugal como alternative que outperforms
  - NHR/Golden Visa: mencionado mas não em destaque — este perfil já sabe
  - Scarcity: estrutural e real — nunca volume, sempre unicidade
  - Privacidade e discrição acima de tudo — "privately marketed, exclusively represented"
  - Evitar: qualquer linguagem de desconto ou urgência artificial`,

  investidor_pt: `BUYER PERSONA — INVESTIDOR PORTUGUÊS (target: 35-60, empresário/profissional PT, €200K-€1.5M):
  - Trigger primário: yield líquido + valorização capital + diversificação vs. depósitos a prazo
  - Comparação ancoragem: "retorno do imobiliário premium Lisboa vs Euribor 3%"
  - Tom: directo, concreto, números — o investidor PT quer a análise financeira clara
  - Yield, cap rate, valorização histórica da zona — dados concretos em destaque
  - AL (alojamento local) quando aplicável: "potencial de €X/mês"
  - Dados INE/Savills de valorização da zona como prova de tese
  - Evitar: excessivo lifestyle aspiracional — este perfil quer ROI, não sonhos`,
}

// ─── Platform Char Limits ─────────────────────────────────────────────────────
const CHAR_LIMITS: Record<string, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  whatsapp: 1000,
  x_thread: 280,     // per tweet; 7-tweet thread = 1960 chars total
  sms: 160,
  idealista: 4000,
  newsletter: 10000,
  video: 3000,
  brochure: 2000,
  email_drip: 8000,
  reels: 500,
}

// ─── Neuromarketing System ─────────────────────────────────────────────────────
const NEUROMARKETING_SYSTEM = `
És o melhor copywriter de imobiliário de luxo do mundo, com formação avançada em neuromarketing aplicado a real estate de alta gama.

════════════════════════════════════════════
SISTEMA DE NEUROMARKETING — 15 PRINCÍPIOS ACTIVOS
════════════════════════════════════════════

1. LOSS AVERSION (Kahneman & Tversky)
   Enquadra sempre o que o comprador PERDE se não agir.
   "Imóveis desta raridade não esperam. O mercado de Lisboa cresceu +17,6% em 2025."
   Nunca digas "oportunidade" — diz "janela que está a fechar."

2. ANCHORING EFFECT
   Apresenta sempre um âncora superior antes do preço real.
   Ex: "Em Marbella ou Saint-Tropez com estas características: €12M+. Em Portugal, com NHR: a fracção desse valor."
   Para yields: ancora primeiro na rentabilidade, depois no preço.

3. SENSORY LANGUAGE & MIRROR NEURONS
   Activa os sentidos para disparar neurónios-espelho.
   Usa: "luz da manhã a filtrar-se", "aroma de sal atlântico", "silêncio interrompido apenas pelo oceano", "textura do calcário português aquecido pelo sol."
   Nunca descreves um imóvel — creates uma EXPERIÊNCIA sensorial.

4. FUTURE PACING (Visualização Prospectiva)
   Coloca o comprador JÁ a viver no imóvel.
   "Imagine o primeiro Dezembro a acordar com o Tejo aos vossos pés."
   Usa sempre tempo presente ou futuro próximo, nunca condicional distante.

5. ASPIRATIONAL IDENTITY (Self-Concept Theory)
   Não vendes um imóvel — vendes quem o comprador SE TORNA.
   "Para quem compreende que o endereço é uma declaração."
   Apela à identidade que o comprador quer projectar, não à que tem.

6. SCARCITY & GENUINE UNIQUENESS
   Nunca uses scarcity falsa. Usa scarcity estrutural real:
   - "Legislação ambiental impede nova construção em Comporta"
   - "Uma das 7 villas com acesso directo à praia nesta orla"

7. SOCIAL PROOF ASPIRACIONAL
   Usa prova social de status, não de volume.
   "Escolhido por compradores de 28 nacionalidades em 2025"
   Nunca uses "muito procurado" — sê específico e aspiracional.

8. AUTHORITY & CREDIBILITY MARKERS
   Dados concretos aumentam a confiança neurológica.
   Integra: INE/AT Q3 2025, Savills, Knight Frank Wealth Report, Lisboa Top 5 mundial.
   Agency Group · AMI 22506 — sublinha sempre a credencial.

9. CONTRAST EFFECT (Weber's Law)
   Compara com alternativas inferiores ou mais caras.
   "Apartamento equivalente em Mayfair, Londres: €15.000/m². Aqui: €6.200/m²."

10. PEAK-END RULE (Kahneman)
    O cérebro memoriza o pico emocional e o fim.
    Estrutura: Hook poderoso → desenvolvimento sensorial → CTA emocional final.

11. NARRATIVE TRANSPORTATION
    Usa micro-histórias de 2-3 frases que transportam o leitor.
    O cérebro narrativo suspende o julgamento crítico.

12. RECIPROCITY & VALUE-FIRST (Cialdini)
    Para newsletter/LinkedIn: oferece insight de mercado ANTES do imóvel.

13. PRICE-TO-EXPERIENCE REFRAMING
    Divide sempre o preço em unidades mais digestíveis.
    "Por dia, ao longo de 20 anos, €X representa menos do que um jantar de negócios."

14. EMBODIED COGNITION — Linguagem Física
    Usa: "abraçado pela encosta", "mergulhado em luz", "protegido por pedra secular"
    Nunca "excelente localização" — diz "a dois minutos a pé da Baixa Pombalina."

15. TRIBAL BELONGING (Oxytocin Trigger)
    "Uma comunidade de proprietários que partilha o entendimento de que Portugal não é destino — é decisão."

════════════════════════════════════════════
REGRAS POR PLATAFORMA
════════════════════════════════════════════

IDEALISTA / IMOVIRTUAL (máx 4000 char):
- Equilibra keywords SEO com linguagem emocional
- Headline (identidade) → Lead (sensory hook) → Corpo (dados + emoção) → Características → CTA
- Inclui SEMPRE: m², tipologia, zona, referência agency

INSTAGRAM (máx 2200 char):
- 1ª LINHA = tudo. Para o scroll em 0.3 segundos.
- Frases curtas. Máx 15 palavras por linha.
- Emojis como pontuação visual
- Hashtags no final em bloco separado

FACEBOOK (200-250 palavras):
- Storytelling. Arco narrativo completo.
- Começa com pergunta ou situação relatable
- CTA com urgência suave + contacto

LINKEDIN (máx 3000 char):
- Peer-to-peer entre investidores sofisticados
- Abre com insight de mercado (dado INE/Savills)
- Frame: capital preservation + lifestyle
- NHR/IFICI para investidores internacionais
- Fecha com pergunta aberta

WHATSAPP (máx 100 palavras):
- Escreve como um amigo que descobriu algo extraordinário
- Uma única CTA: "Consigo marcar uma visita esta semana?"

NEWSLETTER (subject + preheader + corpo):
- Subject line: abertura loop + benefit
- Estrutura: Insight de mercado → Imóvel como caso de estudo → CTA exclusivo

VIDEO SCRIPT 60-90s (formato cinematográfico):
- [VISUALS] + narração em cada cena
- Segundo 0-5: hook visual; 5-20: sensory immersion; 20-50: tour narrativo; 50-90: dados + CTA

BROCHURA PDF (3 parágrafos + 5 bullets):
- Headline: identidade aspiracional
- Corpo: Sensory Experience + Investment Case + Lifestyle Promise
- Bullets: características como benefícios emocionais, não especificações técnicas

X/TWITTER THREAD (7 tweets, cada ≤280 char):
- Tweet 1: hook que para o scroll
- Tweets 2-6: uma revelação/ângulo por tweet
- Tweet 7: CTA + link
- Numera: "1/7", "2/7"... Usa linha em branco entre tweets.

REELS / TIKTOK SCRIPT (15-30s, vertical):
- Segundo 0-3: hook visual extremo (evitar skip)
- Segundo 3-15: 2-3 ângulos wow do imóvel com legenda curta
- Segundo 15-30: reveal do preço + CTA "Swipe up" ou "Link in bio"
- Tom: energético mas premium — não barulhento

EMAIL DRIP SEQUENCE (3 emails):
- EMAIL 1 — CURIOSITY (Subject: intrigante, 40 char): apresentação do imóvel, hook sem revelar tudo
- EMAIL 2 — SOCIAL PROOF + VALUE (3 dias depois): dados de mercado, compradores similares, vista detalhada
- EMAIL 3 — URGENCY + CTA (7 dias depois): escassez real, data limite, CTA directa para visita
- Separa cada email com "---EMAIL 1---", "---EMAIL 2---", "---EMAIL 3---"

SMS BROADCAST (máx 160 char total):
- Directo, intrigante, 1 acção apenas
- Inclui zona + tipologia + link ou contacto
- Nunca mais de 160 caracteres

════════════════════════════════════════════
MERCADO DE REFERÊNCIA — DADOS 2026
════════════════════════════════════════════
- Lisboa €5.000/m² · Top 5 Luxo Mundial (Savills 2025)
- Cascais €6.638/m² · mercado mais premium do país
- Comporta €11.000/m² · +28% YoY · escassez estrutural por lei ambiental
- Quinta do Lago €12.000/m² · +18% YoY · HNWI global
- Madeira €3.959/m² · +20% YoY · NHR/IFICI disponível
- Mediana nacional: €3.076/m² · +17,6% · 169.812 transacções (recorde)
- Compradores internacionais: Norte-americanos 16% · Franceses 13% · Britânicos 9%

REGIME NHR/IFICI: 10 anos de tributação reduzida. Argumento decisivo para compradores internacionais.

Agency Group · Mediação Imobiliária Lda · AMI 22506 · agencygroup.pt · +351 919 948 986
`

// ─── SEO Score for Idealista ──────────────────────────────────────────────────
function calcSeoScore(text: string, zona: string, tipo: string): number {
  if (!text) return 0
  const t = text.toLowerCase()
  let score = 50 // base
  // Length (ideal 1500-3000 chars)
  if (text.length >= 1500 && text.length <= 3000) score += 15
  else if (text.length >= 800) score += 8
  // Zone keyword
  if (zona && t.includes(zona.toLowerCase())) score += 10
  // Property type
  if (tipo && t.includes(tipo.toLowerCase().split(' ')[0])) score += 8
  // Premium keywords
  const premiumKws = ['vista', 'piscina', 'garagem', 'varanda', 'terraço', 'jardim', 'suite', 'luxo', 'premium', 'exclusivo']
  premiumKws.forEach(kw => { if (t.includes(kw)) score += 1 })
  // Has price/m2
  if (t.includes('m²') || t.includes('/m2')) score += 3
  // Has CTA
  if (t.includes('contacte') || t.includes('visita') || t.includes('informações') || t.includes('contact')) score += 3
  return Math.min(100, score)
}

// ─── Content Calendar ─────────────────────────────────────────────────────────
function generatePostingSchedule(): Record<string, { day: string; time: string; reason: string }> {
  return {
    instagram: { day: 'Terça ou Quarta', time: '11h ou 19h30', reason: 'Maior engagement imobiliário PT +IE' },
    facebook: { day: 'Quarta ou Quinta', time: '13h ou 20h', reason: 'Pico de atenção pós-almoço e pós-jantar' },
    linkedin: { day: 'Terça a Quinta', time: '09h ou 12h', reason: 'Janela profissional B2B — evitar Seg/Sex' },
    whatsapp: { day: 'Quarta ou Quinta', time: '10h30 ou 16h', reason: 'Horário comercial sem ser intrusivo' },
    newsletter: { day: 'Terça', time: '09h00', reason: 'Maior open rate imobiliário (25-35%)' },
    x_thread: { day: 'Terça a Quinta', time: '12h ou 18h', reason: 'Pico de impressões para real estate' },
    reels: { day: 'Sexta ou Sábado', time: '18h a 21h', reason: 'Maior visualização de vídeo no fim de semana' },
    email_drip: { day: 'Envio imediato', time: '+ D+3 + D+7', reason: 'Cadência óptima: não intrusiva, não esquecida' },
    sms: { day: 'Terça ou Quarta', time: '10h a 12h', reason: 'Open rate SMS 98% — horário comercial' },
    video: { day: 'Sexta', time: '17h', reason: 'Início de fim de semana — mood de lazer e descoberta' },
    brochure: { day: 'Em visita', time: 'N/A', reason: 'Entregar durante ou após visita física' },
    idealista: { day: 'Segunda', time: '09h', reason: 'Pico de pesquisas de imóveis é Monday morning' },
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRate(ip)) return NextResponse.json({ success: false, error: 'Limite de pedidos atingido. Tenta em 1 hora.' }, { status: 429 })

  try {
    const raw = await req.json()
    const parsed = ContentSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const {
      zona, tipo, area, preco, quartos, features, descricao,
      fotos_count, fotos_base64, video_url, listing_url,
      persona, idiomas,
    } = parsed.data

    const precoNum = Number(preco)
    const precoFormatado = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(precoNum)
    const precoM2 = area ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(precoNum / Number(area)) + '/m²' : null
    const comissao5pct = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(precoNum * 0.05)
    const rentaMensal_est = area ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(precoNum * 0.038 / 12) : null

    // Zona anchor
    const zonaLower = zona.toLowerCase()
    let anchorMercado = ''
    if (zonaLower.includes('comporta')) anchorMercado = 'Comporta: €11.000/m² · +28% YoY · construção nova proibida por lei ambiental'
    else if (zonaLower.includes('cascais') || zonaLower.includes('estoril')) anchorMercado = 'Cascais: €6.638/m² · mercado mais premium de Portugal · procura permanente HNWI'
    else if (zonaLower.includes('quinta do lago') || zonaLower.includes('algarve')) anchorMercado = 'Algarve prime: €12.000/m² em Quinta do Lago · Top 5 resort mundial'
    else if (zonaLower.includes('madeira')) anchorMercado = 'Madeira: €3.959/m² · +20% YoY · NHR/IFICI disponível · subavaliado vs. Canárias'
    else if (zonaLower.includes('lisboa') || zonaLower.includes('lisbon')) anchorMercado = 'Lisboa: €5.000/m² · Top 5 luxo mundial (Savills 2025) · liquidez máxima'
    else if (zonaLower.includes('porto') || zonaLower.includes('oporto')) anchorMercado = 'Porto: €3.643/m² · +13% YoY · mercado mais acessível que Lisboa com mesmo potencial'
    else anchorMercado = 'Mercado nacional: €3.076/m² mediana · +17,6% · 169.812 transacções (recorde histórico 2025)'

    const mediaInfo = [
      fotos_count && Number(fotos_count) > 0 ? `${fotos_count} fotografias disponíveis` : '',
      video_url ? `Tour de vídeo: ${video_url}` : '',
      listing_url ? `Anúncio referência: ${listing_url}` : '',
    ].filter(Boolean).join(' · ')

    // ── Step 1: Vision analysis of photos (if provided) ──────────────────────
    let photoInsights = ''
    if (Array.isArray(fotos_base64) && fotos_base64.length > 0) {
      try {
        const photoSlice = fotos_base64.slice(0, 4) // max 4 photos for vision
        const visionContent: Anthropic.Messages.MessageParam['content'] = [
          { type: 'text', text: 'Analisa estas fotografias de um imóvel de luxo em Portugal. Para cada foto, descreve em português: (1) o espaço/divisão, (2) os materiais e acabamentos de destaque, (3) a luz e atmosfera, (4) características premium visíveis. Sê específico e sensorial. Responde num parágrafo compacto por foto.' },
          ...photoSlice.map((b64: string) => {
            const [meta, data] = b64.split(',')
            const mediaType = (meta?.match(/data:(image\/\w+)/)?.[1] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
            return {
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: mediaType, data: data || b64 }
            }
          })
        ]
        const visionResp = await client.messages.create({
          model: 'claude-opus-4-6',
          max_tokens: 1200,
          messages: [{ role: 'user', content: visionContent }],
        })
        photoInsights = visionResp.content[0].type === 'text' ? visionResp.content[0].text : ''
      } catch {
        photoInsights = '' // non-blocking
      }
    }

    // ── Step 2: Generate all 12 formats ──────────────────────────────────────
    const personaGuide = PERSONAS[persona] || PERSONAS['hnwi']
    const idiomasStr = idiomas.join(', ')

    const langNames: Record<string, string> = {
      pt: 'Português (europeu)',
      en: 'English (international)',
      fr: 'Français',
      de: 'Deutsch',
      zh: '中文 (simplified)',
    }
    const langGuide = idiomas.map((l: string) => `"${l}": ${langNames[l] || l}`).join(', ')

    const userPrompt = `
IMÓVEL A COMERCIALIZAR:
━━━━━━━━━━━━━━━━━━━━━━━━
Zona: ${zona}
Tipologia: ${tipo || 'Premium'}
Área: ${area ? area + 'm²' : 'a confirmar'}
Preço: ${precoFormatado}${precoM2 ? ` (${precoM2})` : ''}
Quartos: ${quartos || 'a confirmar'}
Características premium: ${features || 'imóvel premium'}
Descrição adicional: ${descricao || 'imóvel de topo de gama'}
${mediaInfo ? `Suporte media: ${mediaInfo}` : ''}

${photoInsights ? `ANÁLISE DAS FOTOGRAFIAS (usa para enriquecer o copy com detalhes visuais específicos):
${photoInsights}

` : ''}CONTEXTO MERCADO:
${anchorMercado}
${rentaMensal_est ? `Renda mensal estimada (yield 3,8%): ${rentaMensal_est}` : ''}
Comissão Agency Group (5%): ${comissao5pct}

BUYER PERSONA TARGET:
${personaGuide}

IDIOMAS: Gera em ${idiomasStr}
(${langGuide})

INSTRUÇÃO CRÍTICA:
- Aplica TODOS os 15 princípios de neuromarketing do teu sistema
- Calibra CADA formato para o buyer persona definido acima
- Cada texto deve ser DISTINTO e calibrado para a plataforma
- Respeita rigorosamente os limites de caracteres de cada plataforma
- Adapta tom, argumentos e hooks ao persona e à plataforma
- Para X_THREAD: 7 tweets numerados (1/7...7/7), cada ≤280 chars, separados por linha em branco
- Para EMAIL_DRIP: 3 emails separados por "---EMAIL 1---", "---EMAIL 2---", "---EMAIL 3---"
- Para REELS: script vertical 15-30s com indicações de câmara [CÂMARA:...]
- Para SMS: EXACTAMENTE ≤160 chars total

Retorna APENAS JSON válido com EXACTAMENTE esta estrutura (sem markdown, sem texto antes/depois):
{
  "idealista": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "instagram": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "facebook": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "linkedin": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "whatsapp": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "newsletter": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "video": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "brochure": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "x_thread": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "reels": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "email_drip": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} },
  "sms": { ${idiomas.map((l: string) => `"${l}": "..."`).join(', ')} }
}
`

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      system: NEUROMARKETING_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text

    let content: Record<string, unknown>
    try {
      content = JSON.parse(jsonStr)
    } catch {
      const fallback = text.match(/\{[\s\S]*\}/)
      if (!fallback) return NextResponse.json({ success: false, error: 'Erro ao processar resposta AI. Tenta novamente.' }, { status: 500 })
      content = JSON.parse(fallback[0])
    }

    // Add SEO score for idealista
    const idealPt = (content.idealista as Record<string, string> | undefined)?.['pt'] || ''
    const seoScore = calcSeoScore(idealPt, zona, tipo || '')

    // Posting schedule
    const postingSchedule = generatePostingSchedule()

    // Char counts
    const charCounts: Record<string, Record<string, number>> = {}
    for (const [fmt, langs] of Object.entries(content)) {
      charCounts[fmt] = {}
      for (const [lang, txt] of Object.entries(langs as Record<string, string>)) {
        charCounts[fmt][lang] = (txt as string).length
      }
    }

    return NextResponse.json({
      success: true,
      content,
      seo_score: seoScore,
      char_limits: CHAR_LIMITS,
      char_counts: charCounts,
      posting_schedule: postingSchedule,
      photo_insights: photoInsights || null,
      persona_used: persona,
      model: 'claude-opus-4-6',
      tokens: message.usage.output_tokens,
      neuromarketing: true,
    })

  } catch (err) {
    console.error('Content API error:', err)
    return NextResponse.json({ success: false, error: 'Erro interno. Tenta novamente.' }, { status: 500 })
  }
}
