import { MetadataRoute } from 'next'
import { PROPERTIES } from './imoveis/data'
import { ARTICLES } from './blog/[slug]/articles'

const BASE = 'https://www.agencygroup.pt'

const ZONAS = ['lisboa', 'cascais', 'comporta', 'porto', 'algarve', 'madeira', 'sintra', 'ericeira']

const PREMIUM_IDS = PROPERTIES
  .filter(p => p.preco >= 3_000_000)
  .map(p => p.id)

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // ── Static pages ─────────────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                      lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/imoveis`,         lastModified: now, changeFrequency: 'daily',   priority: 0.95 },
    { url: `${BASE}/blog`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/agente/carlos`,   lastModified: now, changeFrequency: 'monthly', priority: 0.88 },
    { url: `${BASE}/en`,              lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE}/fr`,              lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE}/de`,              lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/zh`,              lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/ar`,              lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/relatorio-2026`,  lastModified: now, changeFrequency: 'monthly', priority: 0.65 },
    { url: `${BASE}/reports`,         lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    // ── Static SEO blog articles (PT) ────────────────────────────────────────────
    { url: `${BASE}/blog/comprar-casa-portugal-2026`,         lastModified: new Date('2026-03-30'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/propriedades-luxo-lisboa-2026`,      lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/investir-imoveis-comporta-2026`,     lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/mercado-imoveis-porto-2026`,         lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/apartamentos-luxo-cascais-comprar`,  lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/vender-imovel-portugal-2026`,        lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    // ── EN SEO blog articles ──────────────────────────────────────────────────────
    { url: `${BASE}/blog/luxury-property-lisbon`,                 lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/nhr-portugal-2026-guide`,                lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/buy-property-cascais`,                   lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/property-investment-portugal-returns`,   lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/golden-visa-portugal-alternatives-2026`, lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/buying-property-portugal-2026`,          lastModified: new Date('2026-04-02'), changeFrequency: 'monthly', priority: 0.82 },
    // ── Wave 4 EN+FR SEO blog articles ───────────────────────────────────────────
    { url: `${BASE}/blog/luxury-villas-algarve-2026`,             lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/madeira-island-property-investment`,     lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/portugal-vs-spain-property-2026`,       lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/acheter-appartement-lisbonne-guide`,     lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/comporta-portugal-luxury-market`,        lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    // ── Wave 5 EN+PT SEO blog articles ───────────────────────────────────────────
    { url: `${BASE}/blog/sintra-luxury-property-2026`,            lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/nhr-ifici-2026-guia-completo`,           lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/lisbon-vs-porto-investment-2026`,        lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/portugal-retirement-haven-2026`,         lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/acores-investimento-imobiliario-2026`,   lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    // ── Wave 6 EN+PT SEO blog articles ───────────────────────────────────────────
    { url: `${BASE}/blog/buying-property-portugal-guide-2026`,    lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/algarve-golden-triangle-2026`,           lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/investir-madeira-2026`,                  lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/primeira-casa-lisboa-guia-2026`,         lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/portugal-vs-spain-tax-residency-2026`,   lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    // ── Wave 7 FR SEO blog articles ───────────────────────────────────────────────
    { url: `${BASE}/blog/acheter-maison-cascais-portugal`,     lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/investir-immobilier-algarve-2026`,    lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/regime-ifici-nhr-france-portugal`,    lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/acheter-appartement-porto-france`,    lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/blog/vendre-bien-portugal-guide`,          lastModified: new Date('2026-04-06'), changeFrequency: 'monthly', priority: 0.82 },
    // ── Wave 8 Sprint 9 blog articles (EN×6/PT×2/FR×1/IT×1) ─────────────────────
    { url: `${BASE}/blog/best-areas-lisbon-expats-2026`,        lastModified: new Date('2026-04-07'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog/vat-exemption-portugal-property`,      lastModified: new Date('2026-04-07'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog/luxury-apartments-porto-foz`,          lastModified: new Date('2026-04-07'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog/comprare-casa-portogallo-guida`,       lastModified: new Date('2026-04-07'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog/property-management-portugal`,         lastModified: new Date('2026-04-07'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog/acheter-villa-algarve-2026`,           lastModified: new Date('2026-04-07'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog/golden-coast-portugal-estoril`,        lastModified: new Date('2026-04-07'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog/investimento-madeira-2026`,            lastModified: new Date('2026-04-07'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog/portugal-residency-investment-2026`,   lastModified: new Date('2026-04-07'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog/acores-imoveis-investimento`,          lastModified: new Date('2026-04-07'), changeFrequency: 'monthly', priority: 0.7 },
    // /portal is disallowed in robots.txt — excluded from sitemap
  ]

  // ── Zone pages ───────────────────────────────────────────────────────────────
  const zonePages: MetadataRoute.Sitemap = ZONAS.map(z => ({
    url: `${BASE}/zonas/${z}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // ── Property pages ────────────────────────────────────────────────────────────
  const propertyPages: MetadataRoute.Sitemap = PROPERTIES.map(p => ({
    url: `${BASE}/imoveis/${p.id}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  // ── Blog pages ────────────────────────────────────────────────────────────────
  const blogPages: MetadataRoute.Sitemap = ARTICLES.map(a => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: 'monthly' as const,
    priority: 0.65,
  }))

  // ── Premium microsites ────────────────────────────────────────────────────────
  const premiumPages: MetadataRoute.Sitemap = PREMIUM_IDS.map(id => ({
    url: `${BASE}/imoveis/premium/${id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.92,
  }))

  return [...staticPages, ...zonePages, ...propertyPages, ...premiumPages, ...blogPages]
}
