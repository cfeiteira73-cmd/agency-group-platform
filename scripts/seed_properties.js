const https = require('https');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // SECURITY: never hardcode — use env var
const HOST = 'isbfiofwpxqqpgxoftph.supabase.co';

const properties = [
  {id:'AG-2026-010',nome:'Penthouse Príncipe Real',zona:'Lisboa',bairro:'Príncipe Real',tipo:'Penthouse',preco:2850000,area:220,quartos:3,casas_banho:3,energia:'A',badge:'Destaque',status:'active',gradient:'linear-gradient(135deg, #1a3a2a 0%, #0c1f15 100%)',features:['Terraço 80m²','Vistas Tejo','Domótica','Cozinha Bulthaup','Piscina privativa','Garagem dupla'],lifestyle_tags:['Luxo','Vista Mar','Lifestyle Urbano','Investimento Premium'],descricao:'Penthouse exclusiva no coração do Príncipe Real. Piso 6 com terraço privativo de 80m², vistas 360° sobre Lisboa e o Tejo.'},
  {id:'AG-2026-011',nome:'Apartamento Chiado Premium',zona:'Lisboa',bairro:'Chiado',tipo:'Apartamento',preco:1450000,area:145,quartos:2,casas_banho:2,energia:'A+',badge:'Novo',status:'active',gradient:'linear-gradient(135deg, #2a1a3a 0%, #1a0c2a 100%)',features:['Andar alto','Vista Tejo','Remodelado 2024','Parquet original','Garagem'],lifestyle_tags:['Lifestyle Cultural','Gastronomia','Arrendamento Premium'],descricao:'T2 remodelado no Chiado. Andar alto com vista para o Rio Tejo.'},
  {id:'AG-2026-012',nome:'Moradia Belém com Jardim',zona:'Lisboa',bairro:'Belém',tipo:'Moradia',preco:3200000,area:380,quartos:5,casas_banho:4,energia:'A',badge:'Off-Market',status:'active',gradient:'linear-gradient(135deg, #1a2a3a 0%, #0c1a2a 100%)',features:['Jardim 600m²','Piscina aquecida','Garagem tripla','Home cinema'],lifestyle_tags:['Família','Luxo Discreto','Jardim Privado'],descricao:'Moradia independente em Belém com jardim privado de 600m².'},
  {id:'AG-2026-013',nome:'Apartamento Campo de Ourique',zona:'Lisboa',bairro:'Campo de Ourique',tipo:'Apartamento',preco:780000,area:110,quartos:3,casas_banho:2,energia:'B',badge:'Novo',status:'active',gradient:'linear-gradient(135deg, #2a2a1a 0%, #1a1a0c 100%)',features:['Varanda','Estacionamento','Arrecadação','Metro Rato a 5min'],lifestyle_tags:['Família','HPP','Bairro Residencial'],descricao:'T3 em Campo de Ourique, bairro mais residencial de Lisboa.'},
  {id:'AG-2026-020',nome:'Villa Quinta da Marinha',zona:'Cascais',bairro:'Quinta da Marinha',tipo:'Villa',preco:3800000,area:450,quartos:5,casas_banho:5,energia:'A',badge:'Exclusivo',status:'active',gradient:'linear-gradient(135deg, #1a3a1a 0%, #0c2a0c 100%)',features:['Piscina infinity','Campo Golfe','Jardim paisagístico','Garagem tripla'],lifestyle_tags:['Golf Lifestyle','Praia Guincho','Luxo Contemporâneo'],descricao:'Villa de arquitectura contemporânea na Quinta da Marinha, em frente ao campo de golfe.'},
  {id:'AG-2026-021',nome:'Moradia Estoril Frente Mar',zona:'Cascais',bairro:'Estoril',tipo:'Moradia',preco:2100000,area:280,quartos:4,casas_banho:3,energia:'A',badge:'Destaque',status:'active',gradient:'linear-gradient(135deg, #1a3a3a 0%, #0c2a2a 100%)',features:['Frente mar','Acesso praia privada','Piscina aquecida','Terraço'],lifestyle_tags:['Vista Mar','Lifestyle Costeiro','Praia a Pé'],descricao:'Moradia com acesso directo à praia do Estoril. Terraço sobre o mar.'},
  {id:'AG-2026-022',nome:'Apartamento Cascais Centro',zona:'Cascais',bairro:'Cascais Centro',tipo:'Apartamento',preco:650000,area:95,quartos:2,casas_banho:2,energia:'A',badge:'Novo',status:'active',gradient:'linear-gradient(135deg, #3a2a1a 0%, #2a1a0c 100%)',features:['Piscina condomínio','Ginásio','Concierge 24h','3min da Baía'],lifestyle_tags:['NHR','Investimento Turístico','Lifestyle Costeiro'],descricao:'T2 moderno no centro histórico de Cascais. A 3 minutos da baía.'},
  {id:'AG-2026-030',nome:'Herdade Comporta Exclusiva',zona:'Comporta',bairro:'Comporta',tipo:'Herdade',preco:6500000,area:850,quartos:6,casas_banho:6,energia:'A+',badge:'Off-Market',status:'active',gradient:'linear-gradient(135deg, #3a3a1a 0%, #2a2a0c 100%)',features:['5 hectares','Praia privada','Piscina natural','Heliponto autorizado'],lifestyle_tags:['Ultra Luxo','Off-Market','Família HNWI'],descricao:'Herdade exclusiva na Comporta com 5 hectares de pinhal e acesso directo à praia.'},
  {id:'AG-2026-031',nome:'Villa Carvalhal Comporta',zona:'Comporta',bairro:'Carvalhal',tipo:'Villa',preco:1850000,area:320,quartos:4,casas_banho:4,energia:'A',badge:'Exclusivo',status:'active',gradient:'linear-gradient(135deg, #3a2a1a 0%, #2a1a0c 100%)',features:['500m da praia','Piscina infinita','Licença AL activa','Dunas naturais'],lifestyle_tags:['Lifestyle Comporta','Alojamento Local','Rendimento'],descricao:'Villa contemporânea no Carvalhal, a 500m da praia. Licença AL activa.'},
  {id:'AG-2026-040',nome:'Apartamento Foz do Douro',zona:'Porto',bairro:'Foz do Douro',tipo:'Apartamento',preco:980000,area:180,quartos:3,casas_banho:2,energia:'A',badge:'Destaque',status:'active',gradient:'linear-gradient(135deg, #3a1a1a 0%, #2a0c0c 100%)',features:['Vista Oceano','Piscina condomínio','Ginásio','Box dupla'],lifestyle_tags:['Luxo Porto','Vista Oceano','Foz Premium'],descricao:'T3 de luxo na Foz do Douro com vistas para o Oceano Atlântico.'},
  {id:'AG-2026-041',nome:'Penthouse Boavista Porto',zona:'Porto',bairro:'Boavista',tipo:'Penthouse',preco:1200000,area:195,quartos:3,casas_banho:3,energia:'A+',badge:'Novo',status:'active',gradient:'linear-gradient(135deg, #1a1a3a 0%, #0c0c2a 100%)',features:['Terraço 100m²','Vista panorâmica Porto','Domótica','Garagem dupla'],lifestyle_tags:['Executivo Porto','Luxo Contemporâneo','Vista Panorâmica'],descricao:'Penthouse na Boavista. Terraço privativo de 100m² com vista panorâmica.'},
  {id:'AG-2026-042',nome:'Apartamento Cedofeita',zona:'Porto',bairro:'Cedofeita',tipo:'Apartamento',preco:420000,area:85,quartos:2,casas_banho:1,energia:'B',badge:'Novo',status:'active',gradient:'linear-gradient(135deg, #2a1a3a 0%, #1a0c2a 100%)',features:['Remodelado 2024','Varanda','AL autorizado','Mobilado'],lifestyle_tags:['Investimento Yield','NHR','Arrendamento'],descricao:'T2 remodelado em Cedofeita. Yield estimado 5.5%.'},
  {id:'AG-2026-050',nome:'Villa Vale do Lobo Golf',zona:'Algarve',bairro:'Vale do Lobo',tipo:'Villa',preco:4200000,area:480,quartos:5,casas_banho:5,energia:'A+',badge:'Exclusivo',status:'active',gradient:'linear-gradient(135deg, #3a2a1a 0%, #2a1a0c 100%)',features:['Royal Golf fronteira','Piscina infinity aquecida','Jardim 1000m²','Garagem 4 carros','Cinema privado'],lifestyle_tags:['Golf Premium','Ultra Luxo','Algarve Exclusivo'],descricao:'Villa de luxo em Vale do Lobo, frente ao Royal Golf Course.'},
  {id:'AG-2026-051',nome:'Apartamento Vilamoura Marina',zona:'Algarve',bairro:'Vilamoura',tipo:'Apartamento',preco:890000,area:130,quartos:3,casas_banho:2,energia:'A',badge:'Destaque',status:'active',gradient:'linear-gradient(135deg, #1a3a3a 0%, #0c2a2a 100%)',features:['Vista Marina','Piscina condomínio','SPA','Licença AL'],lifestyle_tags:['Marina Lifestyle','Algarve Luxo','Rendimento AL'],descricao:'T3 premium com vista directa para a Marina de Vilamoura.'},
  {id:'AG-2026-060',nome:'Apartamento Funchal Prime',zona:'Madeira',bairro:'Funchal',tipo:'Apartamento',preco:980000,area:165,quartos:3,casas_banho:2,energia:'A',badge:'Destaque',status:'active',gradient:'linear-gradient(135deg, #1a3a2a 0%, #0c2a1a 100%)',features:['Vista Oceano 180°','Piscina aquecida','Ginásio','Marina a 5min'],lifestyle_tags:['Madeira Premium','Vista Oceano','NHR Madeira'],descricao:'T3 de luxo no coração do Funchal com vista sobre o Oceano Atlântico.'},
  {id:'AG-2026-061',nome:'Villa Câmara de Lobos',zona:'Madeira',bairro:'Câmara de Lobos',tipo:'Villa',preco:1350000,area:280,quartos:4,casas_banho:3,energia:'A',badge:'Exclusivo',status:'active',gradient:'linear-gradient(135deg, #2a3a1a 0%, #1a2a0c 100%)',features:['Vista penhasco Oceano','Piscina','Jardim tropical','Garagem dupla'],lifestyle_tags:['Vista Oceânica Única','Lifestyle Madeira'],descricao:'Villa contemporânea em Câmara de Lobos, o penhasco mais fotografado do mundo.'},
  {id:'AG-2026-070',nome:'Quinta Histórica Sintra',zona:'Sintra',bairro:'Sintra Vila',tipo:'Quinta',preco:2800000,area:650,quartos:6,casas_banho:5,energia:'D',badge:'Off-Market',status:'active',gradient:'linear-gradient(135deg, #2a3a2a 0%, #1a2a1a 100%)',features:['UNESCO Heritage','4 hectares','Século XVIII','Cavalariça','Piscina'],lifestyle_tags:['Heritage Histórico','Sintra UNESCO'],descricao:'Quinta senhorial do século XVIII em Sintra Património UNESCO.'},
  {id:'AG-2026-071',nome:'Moradia Colares Contemporânea',zona:'Sintra',bairro:'Colares',tipo:'Moradia',preco:1100000,area:260,quartos:4,casas_banho:3,energia:'A+',badge:'Novo',status:'active',gradient:'linear-gradient(135deg, #1a3a1a 0%, #0c2a0c 100%)',features:['BREEAM Excellent','100% solar','Jardim biodiverso','5min praia do Maçã'],lifestyle_tags:['Arquitectura Sustentável','EcoLuxo'],descricao:'Moradia contemporânea em Colares entre a Serra de Sintra e o Oceano.'},
  {id:'AG-2026-080',nome:'Apartamento Ericeira Surf',zona:'Ericeira',bairro:'Ericeira',tipo:'Apartamento',preco:450000,area:90,quartos:2,casas_banho:2,energia:'A',badge:'Novo',status:'active',gradient:'linear-gradient(135deg, #1a2a3a 0%, #0c1a2a 100%)',features:['200m praia','Licença AL activa','Yield 6%+','World Surf Reserve'],lifestyle_tags:['Surf Lifestyle','Investimento Yield'],descricao:'T2 moderno em Ericeira, a única World Surf Reserve da Europa. 200m da praia.'},
  {id:'AG-2026-081',nome:'Villa Mafra Alto Luxo',zona:'Ericeira',bairro:'Mafra',tipo:'Villa',preco:1650000,area:350,quartos:5,casas_banho:4,energia:'A',badge:'Destaque',status:'active',gradient:'linear-gradient(135deg, #3a1a2a 0%, #2a0c1a 100%)',features:['Vista Palácio Mafra','5000m² terreno','Piscina aquecida','Campo padel'],lifestyle_tags:['Lifestyle Desporto','Vista Atlântico'],descricao:'Villa contemporânea em Mafra com vista para o Palácio Nacional e Oceano.'}
];

const data = JSON.stringify(properties);
const opts = {
  hostname: HOST,
  path: '/rest/v1/properties',
  method: 'POST',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(opts, r => {
  let d = '';
  r.on('data', c => d += c);
  r.on('end', () => {
    if (r.statusCode === 201 || r.statusCode === 200) {
      console.log('SUCCESS:', r.statusCode, '— 20 properties inserted/updated');
    } else {
      console.log('ERROR:', r.statusCode, d.substring(0, 400));
    }
  });
});
req.on('error', e => console.error('Request error:', e.message));
req.write(data);
req.end();
