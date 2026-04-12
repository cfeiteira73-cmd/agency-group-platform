// ─── Shared data for /imoveis listings and /imoveis/[id] detail ──────────────

export interface Property {
  id: string
  ref: string
  nome: string
  zona: string
  bairro: string
  tipo: string
  preco: number
  area: number
  quartos: number
  casasBanho: number
  andar: string
  energia: string
  vista: string
  piscina: boolean
  garagem: boolean
  jardim: boolean
  terraco: boolean
  condominio: boolean
  badge: string | null
  status: string
  desc: string
  features: string[]
  tourUrl: string | null
  grad: string
  lat: number
  lng: number
  lifestyle: string[]
  videoUrl: string | null
  virtualTourEmbed: string | null
  availability_note?: string  // optional scarcity signal — only set when genuinely applicable
}

// ─── Price range constants — applied globally to all listing surfaces ─────────
export const PRICE_FLOOR   = 400_000        // €400K — minimum for AG Elite Activo
export const PRICE_CEILING = 100_000_000    // €100M — HNWI / family office ceiling

/** Safety net: strips properties outside the AG product range */
export function filterByPriceRange<T extends { preco: number }>(items: T[]): T[] {
  return items.filter(p => p.preco >= PRICE_FLOOR && p.preco <= PRICE_CEILING)
}

export const PROPERTIES: Property[] = [
  // LISBOA
  { id:'AG-2026-010', ref:'AG-2026-010', nome:'Penthouse Príncipe Real', zona:'Lisboa', bairro:'Príncipe Real', tipo:'Apartamento', preco:2850000, area:220, quartos:3, casasBanho:3, andar:'6º', energia:'A+', vista:'cidade', piscina:true, garagem:true, jardim:false, terraco:true, condominio:true, badge:'Destaque', status:'Ativo', desc:'Penthouse de luxo no coração de Lisboa com terraço privado panorâmico e piscina de água salgada. Acabamentos Boffi e Miele. Vista 360° sobre a cidade histórica.', features:['Terraço panorâmico 60m²','Piscina privada aquecida','Cozinha Boffi','Eletrodomésticos Miele','Domótica KNX','Parqueamento duplo'], tourUrl:'https://my.matterport.com/show/?m=SFR2tst4qnM', grad:'135deg, #1c3a5e, #0c1f15', lat:38.7172, lng:-9.1491, lifestyle:['city','historic'], videoUrl:null, virtualTourEmbed:'https://my.matterport.com/show/?m=SFR2tst4qnM&play=1' },
  { id:'AG-2026-011', ref:'AG-2026-011', nome:'Apartamento Chiado Premium', zona:'Lisboa', bairro:'Chiado', tipo:'Apartamento', preco:1450000, area:145, quartos:2, casasBanho:2, andar:'3º', energia:'A', vista:'Tejo', piscina:false, garagem:true, jardim:false, terraco:false, condominio:true, badge:'Novo', status:'Ativo', desc:'Apartamento contemporâneo no Chiado com vistas sobre o Tejo e o Castelo. Renovação integral 2025 com materiais premium. A 5 minutos do elevador de Santa Justa.', features:['Vista Tejo e Castelo','Renovação 2025','Pavimento mármore Estremoz','Ar-condicionado centralizado','Parqueamento incluído','Arrecadação'], tourUrl:null, grad:'135deg, #2d1a0e, #1a0a00', lat:38.7106, lng:-9.1404, lifestyle:['city','historic'], videoUrl:null, virtualTourEmbed:null },
  { id:'AG-2026-012', ref:'AG-2026-012', nome:'Moradia Belém com Jardim', zona:'Lisboa', bairro:'Belém', tipo:'Moradia', preco:3200000, area:380, quartos:5, casasBanho:4, andar:'r/c', energia:'B', vista:'jardim', piscina:true, garagem:true, jardim:true, terraco:true, condominio:false, badge:'Off-Market', status:'Ativo', desc:'Moradia unifamiliar em Belém com jardim privado de 500m² e piscina aquecida. Localização única a 200m dos Jardins de Belém. Arquitetura contemporânea portuguesa.', features:['Jardim privado 500m²','Piscina aquecida','Escritório home-office','Cave garagem 3 carros','Lareira sala','Cozinha exterior'], tourUrl:null, grad:'135deg, #0d2b1a, #061510', lat:38.6979, lng:-9.2030, lifestyle:['historic','city'], videoUrl:null, virtualTourEmbed:null },
  { id:'AG-2026-013', ref:'AG-2026-013', nome:'T3 Campo de Ourique', zona:'Lisboa', bairro:'Campo de Ourique', tipo:'Apartamento', preco:890000, area:165, quartos:3, casasBanho:2, andar:'2º', energia:'A', vista:'jardim', piscina:false, garagem:true, jardim:false, terraco:false, condominio:true, badge:null, status:'Ativo', desc:'Apartamento luminoso em Campo de Ourique, o bairro mais desejado de Lisboa. Pé-direito alto 3.2m, janelas duplas, estacionamento privativo.', features:['Pé-direito 3.2m','Janelas anti-ruído','Parque de estacionamento','Arrecadação','Próximo Mercado Campo Ourique','Excelente luminosidade'], tourUrl:null, grad:'135deg, #1a2e3f, #0a1520', lat:38.7119, lng:-9.1656, lifestyle:['city'], videoUrl:null, virtualTourEmbed:null },
  // CASCAIS
  { id:'AG-2026-020', ref:'AG-2026-020', nome:'Villa Quinta da Marinha', zona:'Cascais', bairro:'Quinta da Marinha', tipo:'Moradia', preco:3800000, area:450, quartos:5, casasBanho:5, andar:'r/c', energia:'A+', vista:'golfe', piscina:true, garagem:true, jardim:true, terraco:true, condominio:true, badge:'Exclusivo', status:'Ativo', desc:'Villa contemporânea de arquitectura premiada no resort exclusivo de Quinta da Marinha. Vista para o campo de golfe, piscina exterior e interior, spa privado e jardim de 1.200m².', features:['Piscina exterior + interior','Spa privado','Jardim paisagístico 1.200m²','Vista campo de golfe','Smart Home Control4','Cave garagem 4 carros'], tourUrl:'https://my.matterport.com/show/?m=oCXP6iB8r8s', grad:'135deg, #0e2a3a, #051520', lat:38.6957, lng:-9.4276, lifestyle:['golf','nature'], videoUrl:null, virtualTourEmbed:'https://my.matterport.com/show/?m=oCXP6iB8r8s&play=1' },
  { id:'AG-2026-021', ref:'AG-2026-021', nome:'Moradia Estoril Frente Mar', zona:'Cascais', bairro:'Estoril', tipo:'Moradia', preco:2100000, area:280, quartos:4, casasBanho:3, andar:'r/c', energia:'B', vista:'mar', piscina:true, garagem:true, jardim:true, terraco:true, condominio:false, badge:'Destaque', status:'Ativo', desc:'Moradia a 200m da praia do Estoril com vista mar. Arquitectura clássica portuguesa restaurada, piscina aquecida e jardim tropical privado.', features:['200m Praia Estoril','Vista mar','Piscina aquecida','Jardim tropical 400m²','Garagem 2 carros','Churrasqueira exterior'], tourUrl:null, grad:'135deg, #0a1e2a, #050d14', lat:38.7016, lng:-9.3978, lifestyle:['seafront','golf'], videoUrl:null, virtualTourEmbed:null },
  { id:'AG-2026-022', ref:'AG-2026-022', nome:'Apartamento Centro Cascais', zona:'Cascais', bairro:'Cascais Centro', tipo:'Apartamento', preco:1350000, area:185, quartos:3, casasBanho:2, andar:'4º', energia:'A', vista:'mar', piscina:false, garagem:true, jardim:false, terraco:true, condominio:true, badge:null, status:'Ativo', desc:'Apartamento moderno no centro histórico de Cascais com terraço e vistas para a baía. Acabamentos premium, a 5 minutos da praia e da marina.', features:['Terraço 25m² vista mar','Centro histórico Cascais','5 min praia e marina','Parqueamento','Pé-direito 3m','Ar-condicionado'], tourUrl:null, grad:'135deg, #1a2a3a, #0a1520', lat:38.6969, lng:-9.4193, lifestyle:['seafront','marina','city'], videoUrl:null, virtualTourEmbed:null },
  // COMPORTA
  { id:'AG-2026-030', ref:'AG-2026-030', nome:'Herdade Comporta Exclusiva', zona:'Comporta', bairro:'Comporta', tipo:'Herdade', preco:6500000, area:850, quartos:6, casasBanho:6, andar:'r/c', energia:'B', vista:'natureza', piscina:true, garagem:true, jardim:true, terraco:true, condominio:false, badge:'Off-Market', status:'Ativo', desc:'Herdade exclusiva na Comporta com 5 hectares de natureza preservada, arrozais e pinhais centenários. Arquitectura de autor em madeira e pedra natural. Piscina infinita com vista para o Sado.', features:['5 hectares natureza','Piscina infinita vista Sado','Arquitectura de autor','Materiais naturais premium','Acesso privado praia','Zona equestre possível'], tourUrl:null, grad:'135deg, #2a1e0a, #150f03', lat:38.3836, lng:-8.7628, lifestyle:['nature','equestrian','seafront'], videoUrl:null, virtualTourEmbed:null },
  { id:'AG-2026-031', ref:'AG-2026-031', nome:'Villa Carvalhal Arrozais', zona:'Comporta', bairro:'Carvalhal', tipo:'Moradia', preco:2800000, area:320, quartos:4, casasBanho:4, andar:'r/c', energia:'A', vista:'natureza', piscina:true, garagem:true, jardim:true, terraco:true, condominio:false, badge:'Destaque', status:'Ativo', desc:'Villa contemporânea com vista sobre os arrozais da Comporta. Design minimalista em harmonia com a natureza preservada. Piscina privada, jardim nativo e acesso pedonal à praia.', features:['Vista arrozais Comporta','15 min praia pedonal','Jardim nativo Comporta','Piscina privada','Arquitectura minimalista','Domótica integrada'], tourUrl:null, grad:'135deg, #1e2a10, #0f1506', lat:38.3626, lng:-8.7851, lifestyle:['nature','seafront'], videoUrl:null, virtualTourEmbed:null },
  // PORTO
  { id:'AG-2026-040', ref:'AG-2026-040', nome:'Apartamento Foz do Douro', zona:'Porto', bairro:'Foz do Douro', tipo:'Apartamento', preco:980000, area:180, quartos:3, casasBanho:2, andar:'5º', energia:'A', vista:'rio', piscina:false, garagem:true, jardim:false, terraco:true, condominio:true, badge:'Destaque', status:'Ativo', desc:'Apartamento de luxo na Foz do Douro com vista sobre o rio e o oceano Atlântico. Acabamentos contemporâneos, terraço privado e estacionamento duplo.', features:['Vista rio Douro e Oceano','Terraço privado 30m²','Estacionamento duplo','Arrecadação','Condomínio seguro','Próximo Parque da Cidade'], tourUrl:null, grad:'135deg, #2a1505, #150a00', lat:41.1511, lng:-8.6752, lifestyle:['seafront','city'], videoUrl:null, virtualTourEmbed:null },
  { id:'AG-2026-041', ref:'AG-2026-041', nome:'Moradia Boavista Premium', zona:'Porto', bairro:'Boavista', tipo:'Moradia', preco:1250000, area:240, quartos:4, casasBanho:3, andar:'r/c', energia:'B', vista:'jardim', piscina:false, garagem:true, jardim:true, terraco:true, condominio:false, badge:null, status:'Ativo', desc:'Moradia em banda na Boavista com jardim privado e excelente localização. Próxima do Centro Comercial Bom Sucesso e do Parque da Cidade do Porto.', features:['Jardim privado 200m²','Garagem 2 carros','Próximo Parque Cidade','10 min aeroporto','3 casas de banho','Lareira'], tourUrl:null, grad:'135deg, #2a1a08, #150d00', lat:41.1585, lng:-8.6378, lifestyle:['city','nature'], videoUrl:null, virtualTourEmbed:null },
  { id:'AG-2026-042', ref:'AG-2026-042', nome:'T2 Cedofeita Renovado', zona:'Porto', bairro:'Cedofeita', tipo:'Apartamento', preco:520000, area:110, quartos:2, casasBanho:1, andar:'2º', energia:'A', vista:'cidade', piscina:false, garagem:false, jardim:false, terraco:false, condominio:true, badge:'Novo', status:'Ativo', desc:'Apartamento totalmente renovado no bairro artístico de Cedofeita. Zona em forte valorização, perto das melhores universidades e do centro histórico do Porto.', features:['Renovação 2025','Bairro artístico emergente','Próximo Casa da Música','Pé-direito elevado','Instalação eléctrica nova','Janelas duplas'], tourUrl:null, grad:'135deg, #1a2a1e, #0d150f', lat:41.1533, lng:-8.6319, lifestyle:['city','historic'], videoUrl:null, virtualTourEmbed:null },
  // ALGARVE
  { id:'AG-2026-050', ref:'AG-2026-050', nome:'Villa Vale do Lobo Golf', zona:'Algarve', bairro:'Vale do Lobo', tipo:'Moradia', preco:4200000, area:480, quartos:5, casasBanho:5, andar:'r/c', energia:'A', vista:'golfe', piscina:true, garagem:true, jardim:true, terraco:true, condominio:true, badge:'Exclusivo', status:'Ativo', desc:'Villa de luxo no resort exclusivo de Vale do Lobo com vista para o campo de golfe do Oceano. Design contemporâneo, piscina aquecida e domótica avançada. A 10 minutos da praia.', features:['Resort Vale do Lobo','Vista campo golfe','Piscina aquecida','Spa privado','Domótica Crestron','10 min praia'], tourUrl:null, grad:'135deg, #2a1a05, #150d00', lat:37.0548, lng:-8.1157, lifestyle:['golf','seafront'], videoUrl:null, virtualTourEmbed:null },
  { id:'AG-2026-051', ref:'AG-2026-051', nome:'Apartamento Vilamoura Marina', zona:'Algarve', bairro:'Vilamoura', tipo:'Apartamento', preco:1100000, area:175, quartos:3, casasBanho:2, andar:'3º', energia:'A', vista:'marina', piscina:true, garagem:true, jardim:false, terraco:true, condominio:true, badge:'Destaque', status:'Ativo', desc:'Apartamento premium em frente à Marina de Vilamoura com vistas excepcionais. Condomínio privado com piscina e ginásio. Excelente rendimento turístico.', features:['Vista Marina Vilamoura','Piscina condomínio','Ginásio privado','5 min casino','Parqueamento','Arrecadação'], tourUrl:null, grad:'135deg, #0a1e2a, #050d14', lat:37.0882, lng:-8.1232, lifestyle:['marina','golf','seafront'], videoUrl:null, virtualTourEmbed:null },
  // MADEIRA
  { id:'AG-2026-060', ref:'AG-2026-060', nome:'Apartamento Funchal Prime', zona:'Madeira', bairro:'Funchal', tipo:'Apartamento', preco:980000, area:165, quartos:3, casasBanho:2, andar:'7º', energia:'A+', vista:'oceano', piscina:true, garagem:true, jardim:false, terraco:true, condominio:true, badge:'Destaque', status:'Ativo', desc:'Apartamento premium no Funchal com vista 180° sobre o oceano Atlântico. Edificio de nova construção 2024, piscina e ginásio no condomínio. IFICI elegível.', features:['Vista oceano 180°','Nova construção 2024','Piscina + ginásio','IFICI elegível','Parqueamento duplo','Zona prime Funchal'], tourUrl:null, grad:'135deg, #0a2a1e, #051410', lat:32.6493, lng:-16.9074, lifestyle:['seafront','nature'], videoUrl:null, virtualTourEmbed:null },
  { id:'AG-2026-061', ref:'AG-2026-061', nome:'Villa Câmara de Lobos Cliffs', zona:'Madeira', bairro:'Câmara de Lobos', tipo:'Moradia', preco:1450000, area:290, quartos:4, casasBanho:3, andar:'r/c', energia:'B', vista:'mar', piscina:true, garagem:true, jardim:true, terraco:true, condominio:false, badge:null, status:'Ativo', desc:'Villa única nos cliffs de Câmara de Lobos, aldeia preferida de Winston Churchill. Vistas dramáticas sobre o Atlântico, piscina natural em rocha e jardim mediterrânico.', features:['Cliffs Winston Churchill','Vista Atlântico dramática','Piscina natural em rocha','Jardim mediterrânico','Acesso privado','15 min Funchal'], tourUrl:null, grad:'135deg, #0a2a1e, #051410', lat:32.6506, lng:-16.9777, lifestyle:['seafront','nature','historic'], videoUrl:null, virtualTourEmbed:null },
  // SINTRA
  { id:'AG-2026-070', ref:'AG-2026-070', nome:'Quinta Histórica Sintra', zona:'Sintra', bairro:'Sintra Vila', tipo:'Quinta', preco:2800000, area:650, quartos:6, casasBanho:5, andar:'r/c', energia:'C', vista:'natureza', piscina:true, garagem:true, jardim:true, terraco:true, condominio:false, badge:'Off-Market', status:'Ativo', desc:'Quinta histórica do século XIX completamente restaurada em Sintra, próxima dos Palácios Reais. Jardim romântico de 2.000m², piscina, adegas e cavalariças transformadas em suites.', features:['Século XIX restaurado','Jardim romântico 2.000m²','Adegas transformadas','Cavalariças suites','Piscina aquecida','UNESCO World Heritage zona'], tourUrl:null, grad:'135deg, #1e2a0a, #0f1503', lat:38.7977, lng:-9.3906, lifestyle:['historic','nature','equestrian'], videoUrl:null, virtualTourEmbed:null },
  { id:'AG-2026-071', ref:'AG-2026-071', nome:'Moradia Colares Serra', zona:'Sintra', bairro:'Colares', tipo:'Moradia', preco:1200000, area:280, quartos:4, casasBanho:3, andar:'r/c', energia:'B', vista:'natureza', piscina:false, garagem:true, jardim:true, terraco:true, condominio:false, badge:null, status:'Ativo', desc:'Moradia contemporânea em Colares com vista para a Serra de Sintra e a Praia Grande. Integrada na natureza, horta biológica, 30 min Lisboa, 5 min praia.', features:['Vista Serra Sintra','5 min Praia Grande','Horta biológica','30 min Lisboa','Garagem 2 carros','Natureza preservada'], tourUrl:null, grad:'135deg, #1e2a0a, #0f1503', lat:38.8048, lng:-9.4551, lifestyle:['nature','seafront'], videoUrl:null, virtualTourEmbed:null },
  // ERICEIRA
  { id:'AG-2026-080', ref:'AG-2026-080', nome:'Apartamento Ericeira Vista Mar', zona:'Ericeira', bairro:'Ericeira', tipo:'Apartamento', preco:650000, area:120, quartos:2, casasBanho:2, andar:'3º', energia:'A', vista:'mar', piscina:false, garagem:true, jardim:false, terraco:true, condominio:true, badge:'Destaque', status:'Ativo', desc:'Apartamento premium em Ericeira, Reserva Mundial de Surf, com vista mar e a 100m das melhores ondas da Europa. Acabamentos top, terraço, rendimento turístico excelente.', features:['100m ondas surf mundial','Vista mar directa','Terraço 20m²','Rendimento turístico 6%','Parqueamento','A 40min Lisboa'], tourUrl:null, grad:'135deg, #0a1e2a, #050d14', lat:38.9622, lng:-9.4152, lifestyle:['surf','seafront'], videoUrl:null, virtualTourEmbed:null },
  { id:'AG-2026-081', ref:'AG-2026-081', nome:'Moradia Mafra com Jardim', zona:'Ericeira', bairro:'Mafra', tipo:'Moradia', preco:1100000, area:240, quartos:4, casasBanho:3, andar:'r/c', energia:'B', vista:'natureza', piscina:true, garagem:true, jardim:true, terraco:true, condominio:false, badge:null, status:'Ativo', desc:'Moradia moderna em Mafra com jardim privado e piscina, 15 minutos da Ericeira e do Palácio Nacional de Mafra. Excelente relação qualidade/preço no eixo Lisboa-Ericeira.', features:['15 min Ericeira surf','Piscina privada','Jardim 300m²','Palácio Nacional 5min','Garagem 2 carros','40 min Lisboa A21'], tourUrl:null, grad:'135deg, #1e2a10, #0f1506', lat:38.9342, lng:-9.3256, lifestyle:['nature','historic'], videoUrl:null, virtualTourEmbed:null },
]

export const PROPERTY_IDS = PROPERTIES.map(p => p.id)

export const ZONE_YIELDS: Record<string, { preco: number; yield: number; yoy: number }> = {
  'Lisboa':   { preco: 5000, yield: 3.2, yoy: 14 },
  'Cascais':  { preco: 4713, yield: 3.8, yoy: 12 },
  'Comporta': { preco: 3941, yield: 4.0, yoy: 22 },
  'Porto':    { preco: 3643, yield: 4.1, yoy: 12 },
  'Algarve':  { preco: 3941, yield: 4.8, yoy: 11 },
  'Madeira':  { preco: 3760, yield: 4.5, yoy: 18 },
  'Sintra':   { preco: 4200, yield: 3.5, yoy:  9 },
  'Ericeira': { preco: 3800, yield: 4.2, yoy: 15 },
}

export function formatPrice(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `€ ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace('.', ',')}M`
  }
  return `€ ${n.toLocaleString('pt-PT')}`
}

export function formatPriceFull(n: number): string {
  return `€ ${n.toLocaleString('pt-PT')}`
}

export const ZONAS = ['Lisboa', 'Cascais', 'Comporta', 'Porto', 'Algarve', 'Madeira', 'Sintra', 'Ericeira']
export const TIPOS = ['Apartamento', 'Moradia', 'Villa', 'Herdade', 'Quinta']
