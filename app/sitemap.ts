import { MetadataRoute } from 'next'
import { PROPERTIES } from './imoveis/data'
import { ARTICLES } from './blog/[slug]/articles'

const BASE = 'https://agencygroup.pt'

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
    { url: `${BASE}/portal`,          lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
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
