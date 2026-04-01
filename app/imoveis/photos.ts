// ─── Real Property Photos — curated Unsplash URLs ─────────────────────────────
// 12 photos per property × 20 properties = 240 photos
// All photos sourced from Unsplash (free to use)

export interface PhotoSet {
  url: string
  label: string
  thumb: string // 400×280 thumbnail
}

// Helper: build Unsplash URL with sizing params
function u(id: string, w = 1600, h = 900): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`
}
function t(id: string): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&h=280&q=75`
}

// ─── Photo Library per Property ───────────────────────────────────────────────
export const PROPERTY_PHOTOS: Record<string, PhotoSet[]> = {

  // AG-2026-001 — Penthouse Avenida da Liberdade (Lisboa)
  'AG-2026-001': [
    { url: u('photo-1600596542815-ffad4c1539a9'), label: 'Exterior Principal', thumb: t('photo-1600596542815-ffad4c1539a9') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Sala de Estar', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Principal', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Ciudad', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall de Entrada', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600210492493-0946911123ea'), label: 'Escritório', thumb: t('photo-1600210492493-0946911123ea') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600585154526-990dced4db0d'), label: 'Vista Noturna', thumb: t('photo-1600585154526-990dced4db0d') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Interior', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-002 — Moradia Cascais Centro
  'AG-2026-002': [
    { url: u('photo-1613977257592-4871e5fcd7c4'), label: 'Exterior Principal', thumb: t('photo-1613977257592-4871e5fcd7c4') },
    { url: u('photo-1600585154340-be6161a56a0c'), label: 'Sala de Estar', thumb: t('photo-1600585154340-be6161a56a0c') },
    { url: u('photo-1556909114-f6e7ad7d3136'), label: 'Cozinha', thumb: t('photo-1556909114-f6e7ad7d3136') },
    { url: u('photo-1616047006789-b7af5afb8c20'), label: 'Suite Principal', thumb: t('photo-1616047006789-b7af5afb8c20') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1575403071235-5dcd06cbf169'), label: 'Piscina', thumb: t('photo-1575403071235-5dcd06cbf169') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Garagem', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600210492493-0946911123ea'), label: 'Escritório', thumb: t('photo-1600210492493-0946911123ea') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Vista Jardim', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-003 — Quinta Comporta Frente Mar
  'AG-2026-003': [
    { url: u('photo-1505761671935-60b3a7427bad'), label: 'Exterior Principal', thumb: t('photo-1505761671935-60b3a7427bad') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Sala de Estar', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Principal', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1571896349842-33c89424de2d'), label: 'Piscina Infinita', thumb: t('photo-1571896349842-33c89424de2d') },
    { url: u('photo-1499793983690-e29da59ef1c2'), label: 'Vista Mar', thumb: t('photo-1499793983690-e29da59ef1c2') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall de Entrada', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Pôr do Sol', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-004 — Apartamento Chiado T3
  'AG-2026-004': [
    { url: u('photo-1600596542815-ffad4c1539a9'), label: 'Exterior Principal', thumb: t('photo-1600596542815-ffad4c1539a9') },
    { url: u('photo-1600585154340-be6161a56a0c'), label: 'Sala de Estar', thumb: t('photo-1600585154340-be6161a56a0c') },
    { url: u('photo-1556909114-f6e7ad7d3136'), label: 'Cozinha', thumb: t('photo-1556909114-f6e7ad7d3136') },
    { url: u('photo-1616047006789-b7af5afb8c20'), label: 'Suite Principal', thumb: t('photo-1616047006789-b7af5afb8c20') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Rio Tejo', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall de Entrada', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600210492493-0946911123ea'), label: 'Escritório', thumb: t('photo-1600210492493-0946911123ea') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Interior', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
    { url: u('photo-1600585154526-990dced4db0d'), label: 'Vista Noturna', thumb: t('photo-1600585154526-990dced4db0d') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
  ],

  // AG-2026-005 — Villa Algarve Frente Mar
  'AG-2026-005': [
    { url: u('photo-1613977257592-4871e5fcd7c4'), label: 'Exterior Principal', thumb: t('photo-1613977257592-4871e5fcd7c4') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Sala de Estar', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Principal', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1571896349842-33c89424de2d'), label: 'Piscina', thumb: t('photo-1571896349842-33c89424de2d') },
    { url: u('photo-1499793983690-e29da59ef1c2'), label: 'Vista Mar', thumb: t('photo-1499793983690-e29da59ef1c2') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Garagem', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Exterior', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-006 — Moradia Sintra Histórica
  'AG-2026-006': [
    { url: u('photo-1505761671935-60b3a7427bad'), label: 'Exterior Principal', thumb: t('photo-1505761671935-60b3a7427bad') },
    { url: u('photo-1600585154340-be6161a56a0c'), label: 'Sala de Estar', thumb: t('photo-1600585154340-be6161a56a0c') },
    { url: u('photo-1556909114-f6e7ad7d3136'), label: 'Cozinha', thumb: t('photo-1556909114-f6e7ad7d3136') },
    { url: u('photo-1616047006789-b7af5afb8c20'), label: 'Suite Principal', thumb: t('photo-1616047006789-b7af5afb8c20') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim Histórico', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall de Entrada', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Serra', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600585154526-990dced4db0d'), label: 'Exterior Tardio', thumb: t('photo-1600585154526-990dced4db0d') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Arquitetural', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-007 — Penthouse Porto Foz
  'AG-2026-007': [
    { url: u('photo-1600596542815-ffad4c1539a9'), label: 'Exterior Principal', thumb: t('photo-1600596542815-ffad4c1539a9') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Sala de Estar', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Principal', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Rio Douro', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço Panorâmico', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall de Entrada', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600210492493-0946911123ea'), label: 'Escritório', thumb: t('photo-1600210492493-0946911123ea') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600585154526-990dced4db0d'), label: 'Vista Noturna', thumb: t('photo-1600585154526-990dced4db0d') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Interior', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-008 — Apartamento Alfama Histórico
  'AG-2026-008': [
    { url: u('photo-1613977257592-4871e5fcd7c4'), label: 'Exterior Principal', thumb: t('photo-1613977257592-4871e5fcd7c4') },
    { url: u('photo-1600585154340-be6161a56a0c'), label: 'Sala de Estar', thumb: t('photo-1600585154340-be6161a56a0c') },
    { url: u('photo-1556909114-f6e7ad7d3136'), label: 'Cozinha', thumb: t('photo-1556909114-f6e7ad7d3136') },
    { url: u('photo-1616047006789-b7af5afb8c20'), label: 'Suite Principal', thumb: t('photo-1616047006789-b7af5afb8c20') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Castelo', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall de Entrada', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1600585154526-990dced4db0d'), label: 'Vista Noturna', thumb: t('photo-1600585154526-990dced4db0d') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Azulejo', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
    { url: u('photo-1600210492493-0946911123ea'), label: 'Escritório', thumb: t('photo-1600210492493-0946911123ea') },
  ],

  // AG-2026-009 — Villa Madeira Ponta do Sol
  'AG-2026-009': [
    { url: u('photo-1505761671935-60b3a7427bad'), label: 'Exterior Principal', thumb: t('photo-1505761671935-60b3a7427bad') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Sala de Estar', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Principal', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1571896349842-33c89424de2d'), label: 'Piscina', thumb: t('photo-1571896349842-33c89424de2d') },
    { url: u('photo-1499793983690-e29da59ef1c2'), label: 'Vista Oceano Atlântico', thumb: t('photo-1499793983690-e29da59ef1c2') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim Tropical', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Garagem', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Pôr do Sol', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-010 — Cobertura Príncipe Real
  'AG-2026-010': [
    { url: u('photo-1600596542815-ffad4c1539a9'), label: 'Exterior Principal', thumb: t('photo-1600596542815-ffad4c1539a9') },
    { url: u('photo-1600585154340-be6161a56a0c'), label: 'Sala de Estar', thumb: t('photo-1600585154340-be6161a56a0c') },
    { url: u('photo-1556909114-f6e7ad7d3136'), label: 'Cozinha', thumb: t('photo-1556909114-f6e7ad7d3136') },
    { url: u('photo-1616047006789-b7af5afb8c20'), label: 'Suite Principal', thumb: t('photo-1616047006789-b7af5afb8c20') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Tejo + Cristo-Rei', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço Panorâmico', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall de Entrada', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600210492493-0946911123ea'), label: 'Escritório', thumb: t('photo-1600210492493-0946911123ea') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600585154526-990dced4db0d'), label: 'Vista Noturna Lisboa', thumb: t('photo-1600585154526-990dced4db0d') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Interior', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-011 — Moradia Estoril Golf
  'AG-2026-011': [
    { url: u('photo-1613977257592-4871e5fcd7c4'), label: 'Exterior Principal', thumb: t('photo-1613977257592-4871e5fcd7c4') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Sala de Estar', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Principal', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1575403071235-5dcd06cbf169'), label: 'Piscina', thumb: t('photo-1575403071235-5dcd06cbf169') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Garagem', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Golf', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Exterior', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-012 — Apartamento T2 Baixa Pombalina
  'AG-2026-012': [
    { url: u('photo-1600596542815-ffad4c1539a9'), label: 'Exterior Principal', thumb: t('photo-1600596542815-ffad4c1539a9') },
    { url: u('photo-1600585154340-be6161a56a0c'), label: 'Sala de Estar', thumb: t('photo-1600585154340-be6161a56a0c') },
    { url: u('photo-1556909114-f6e7ad7d3136'), label: 'Cozinha', thumb: t('photo-1556909114-f6e7ad7d3136') },
    { url: u('photo-1616047006789-b7af5afb8c20'), label: 'Suite Principal', thumb: t('photo-1616047006789-b7af5afb8c20') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Centro Histórico', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall de Entrada', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600585154526-990dced4db0d'), label: 'Vista Noturna', thumb: t('photo-1600585154526-990dced4db0d') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Pombalino', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
    { url: u('photo-1600210492493-0946911123ea'), label: 'Escritório', thumb: t('photo-1600210492493-0946911123ea') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Varanda', thumb: t('photo-1600566753190-17f0baa2a6c3') },
  ],

  // AG-2026-013 — Herdade Comporta Off-Market
  'AG-2026-013': [
    { url: u('photo-1505761671935-60b3a7427bad'), label: 'Exterior Principal', thumb: t('photo-1505761671935-60b3a7427bad') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Sala de Estar', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Principal', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1571896349842-33c89424de2d'), label: 'Piscina Infinita', thumb: t('photo-1571896349842-33c89424de2d') },
    { url: u('photo-1499793983690-e29da59ef1c2'), label: 'Vista Atlântico', thumb: t('photo-1499793983690-e29da59ef1c2') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim de Pinheiros', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Garagem', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Pôr do Sol', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-014 — Moradia Cascais Quinta da Marinha
  'AG-2026-014': [
    { url: u('photo-1613977257592-4871e5fcd7c4'), label: 'Exterior Principal', thumb: t('photo-1613977257592-4871e5fcd7c4') },
    { url: u('photo-1600585154340-be6161a56a0c'), label: 'Sala de Estar', thumb: t('photo-1600585154340-be6161a56a0c') },
    { url: u('photo-1556909114-f6e7ad7d3136'), label: 'Cozinha', thumb: t('photo-1556909114-f6e7ad7d3136') },
    { url: u('photo-1616047006789-b7af5afb8c20'), label: 'Suite Principal', thumb: t('photo-1616047006789-b7af5afb8c20') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1575403071235-5dcd06cbf169'), label: 'Piscina', thumb: t('photo-1575403071235-5dcd06cbf169') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Garagem', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Oceano', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Exterior', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-015 — Apartamento Mouraria Vista Castelo
  'AG-2026-015': [
    { url: u('photo-1600596542815-ffad4c1539a9'), label: 'Exterior Principal', thumb: t('photo-1600596542815-ffad4c1539a9') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Sala de Estar', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Principal', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Castelo S. Jorge', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Varanda', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall de Entrada', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600585154526-990dced4db0d'), label: 'Vista Noturna', thumb: t('photo-1600585154526-990dced4db0d') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Histórico', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600210492493-0946911123ea'), label: 'Escritório', thumb: t('photo-1600210492493-0946911123ea') },
  ],

  // AG-2026-016 — Villa Algarve Vilamoura
  'AG-2026-016': [
    { url: u('photo-1613977257592-4871e5fcd7c4'), label: 'Exterior Principal', thumb: t('photo-1613977257592-4871e5fcd7c4') },
    { url: u('photo-1600585154340-be6161a56a0c'), label: 'Sala de Estar', thumb: t('photo-1600585154340-be6161a56a0c') },
    { url: u('photo-1556909114-f6e7ad7d3136'), label: 'Cozinha', thumb: t('photo-1556909114-f6e7ad7d3136') },
    { url: u('photo-1616047006789-b7af5afb8c20'), label: 'Suite Principal', thumb: t('photo-1616047006789-b7af5afb8c20') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1571896349842-33c89424de2d'), label: 'Piscina', thumb: t('photo-1571896349842-33c89424de2d') },
    { url: u('photo-1499793983690-e29da59ef1c2'), label: 'Vista Mar', thumb: t('photo-1499793983690-e29da59ef1c2') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Garagem', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Exterior', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-017 — Palacete Cascais Histórico
  'AG-2026-017': [
    { url: u('photo-1505761671935-60b3a7427bad'), label: 'Fachada Principal', thumb: t('photo-1505761671935-60b3a7427bad') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Grande Salão', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Real', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho Nobre', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1575403071235-5dcd06cbf169'), label: 'Piscina', thumb: t('photo-1575403071235-5dcd06cbf169') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim Palacete', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall Nobre', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600210492493-0946911123ea'), label: 'Biblioteca', thumb: t('photo-1600210492493-0946911123ea') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Mar', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Arquitetural', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-018 — Penthouse Lisboa Santa Catarina
  'AG-2026-018': [
    { url: u('photo-1600596542815-ffad4c1539a9'), label: 'Exterior Principal', thumb: t('photo-1600596542815-ffad4c1539a9') },
    { url: u('photo-1600585154340-be6161a56a0c'), label: 'Sala de Estar', thumb: t('photo-1600585154340-be6161a56a0c') },
    { url: u('photo-1556909114-f6e7ad7d3136'), label: 'Cozinha', thumb: t('photo-1556909114-f6e7ad7d3136') },
    { url: u('photo-1616047006789-b7af5afb8c20'), label: 'Suite Principal', thumb: t('photo-1616047006789-b7af5afb8c20') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Rio', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Hall de Entrada', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600210492493-0946911123ea'), label: 'Escritório', thumb: t('photo-1600210492493-0946911123ea') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600585154526-990dced4db0d'), label: 'Vista Noturna', thumb: t('photo-1600585154526-990dced4db0d') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Interior', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-019 — Moradia Porto Boavista
  'AG-2026-019': [
    { url: u('photo-1613977257592-4871e5fcd7c4'), label: 'Exterior Principal', thumb: t('photo-1613977257592-4871e5fcd7c4') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Sala de Estar', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Principal', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1575403071235-5dcd06cbf169'), label: 'Piscina', thumb: t('photo-1575403071235-5dcd06cbf169') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Garagem', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600573472550-8090b5e0745e'), label: 'Vista Cidade', thumb: t('photo-1600573472550-8090b5e0745e') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Detalhe Exterior', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],

  // AG-2026-020 — Villa Gerês Nature Retreat
  'AG-2026-020': [
    { url: u('photo-1505761671935-60b3a7427bad'), label: 'Exterior Principal', thumb: t('photo-1505761671935-60b3a7427bad') },
    { url: u('photo-1600607687939-ce8a6c25118c'), label: 'Sala de Estar', thumb: t('photo-1600607687939-ce8a6c25118c') },
    { url: u('photo-1556912173-3bb406ef7e77'), label: 'Cozinha', thumb: t('photo-1556912173-3bb406ef7e77') },
    { url: u('photo-1616594039964-ae9021a400a0'), label: 'Suite Principal', thumb: t('photo-1616594039964-ae9021a400a0') },
    { url: u('photo-1552321554-5fefe8c9ef14'), label: 'Casa de Banho', thumb: t('photo-1552321554-5fefe8c9ef14') },
    { url: u('photo-1575403071235-5dcd06cbf169'), label: 'Piscina Natural', thumb: t('photo-1575403071235-5dcd06cbf169') },
    { url: u('photo-1558618666-fcd25c85cd64'), label: 'Jardim Natural', thumb: t('photo-1558618666-fcd25c85cd64') },
    { url: u('photo-1499793983690-e29da59ef1c2'), label: 'Vista Serra do Gerês', thumb: t('photo-1499793983690-e29da59ef1c2') },
    { url: u('photo-1600566753190-17f0baa2a6c3'), label: 'Terraço', thumb: t('photo-1600566753190-17f0baa2a6c3') },
    { url: u('photo-1560448204-e02f11c3d0e2'), label: 'Suite 2', thumb: t('photo-1560448204-e02f11c3d0e2') },
    { url: u('photo-1600047509807-ba8f99d2cdde'), label: 'Garagem', thumb: t('photo-1600047509807-ba8f99d2cdde') },
    { url: u('photo-1512918728675-ed5a9ecdebfd'), label: 'Natureza Envolvente', thumb: t('photo-1512918728675-ed5a9ecdebfd') },
  ],
}

// ─── Get photos for a property (with fallback) ────────────────────────────────
export function getPropertyPhotos(propertyId: string): PhotoSet[] {
  return PROPERTY_PHOTOS[propertyId] ?? []
}
