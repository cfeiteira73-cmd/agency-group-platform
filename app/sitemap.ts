import { MetadataRoute } from 'next'
import { readdirSync } from 'fs'
import { join } from 'path'
import { PROPERTIES } from './imoveis/data'
import { ARTICLES } from './blog/[slug]/articles'

// ── Static blog folder slugs (individual page.tsx files under /app/blog/*/) ──
// These 51 articles are separate from ARTICLES (dynamic [slug] route).
// We read the directory at build time — this is a Node.js only context (sitemap.ts).
function getStaticBlogSlugs(): string[] {
  try {
    const blogDir = join(process.cwd(), 'app', 'blog')
    return readdirSync(blogDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== '[slug]')
      .map(d => d.name)
  } catch {
    return []
  }
}

const STATIC_BLOG_SLUGS = getStaticBlogSlugs()
// Slugs already covered by ARTICLES dynamic route — avoid duplicates
const DYNAMIC_SLUGS = new Set(ARTICLES.map(a => a.slug))

const BASE = 'https://www.agencygroup.pt'

const ZONAS = ['lisboa', 'cascais', 'comporta', 'porto', 'algarve', 'madeira', 'sintra', 'ericeira']

const PREMIUM_IDS = PROPERTIES
  .filter(p => p.preco >= 3_000_000)
  .map(p => p.id)

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // ── Static pages ─────────────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                                          lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/imoveis`,                            lastModified: now, changeFrequency: 'daily',   priority: 0.95 },
    // ── SEO Pillar Pages (EN — high-intent commercial) ─────────────────────────
    { url: `${BASE}/buy-property-portugal`,              lastModified: now, changeFrequency: 'monthly', priority: 0.95 },
    { url: `${BASE}/invest-in-portugal-real-estate`,     lastModified: now, changeFrequency: 'monthly', priority: 0.93 },
    { url: `${BASE}/off-market-portugal`,                lastModified: now, changeFrequency: 'weekly',  priority: 0.92 },
    { url: `${BASE}/faq`,                               lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE}/blog`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/agente/carlos`,   lastModified: now, changeFrequency: 'monthly', priority: 0.88 },
    { url: `${BASE}/en`,              lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE}/fr`,              lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE}/de`,              lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/zh`,              lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/ar`,              lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/relatorio-2026`,  lastModified: now, changeFrequency: 'monthly', priority: 0.65 },
    { url: `${BASE}/reports`,         lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/equipa`,          lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/contacto`,        lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/vendidos`,                lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/vender-imovel-portugal`, lastModified: now, changeFrequency: 'monthly', priority: 0.90 },
    { url: `${BASE}/casos-de-sucesso`,       lastModified: now, changeFrequency: 'monthly', priority: 0.80 },
    { url: `${BASE}/concierge-estrangeiros`, lastModified: now, changeFrequency: 'monthly', priority: 0.88 },
    { url: `${BASE}/investor-intelligence`,  lastModified: now, changeFrequency: 'monthly', priority: 0.82 },
    { url: `${BASE}/white-label`,            lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    // /off-market is robots: noindex — excluded from sitemap to preserve crawl budget
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

  // ── Blog pages (dynamic [slug] route) ────────────────────────────────────────
  const blogPages: MetadataRoute.Sitemap = ARTICLES.map(a => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: 'monthly' as const,
    priority: 0.65,
  }))

  // ── Blog pages (static individual folders) ───────────────────────────────────
  // 51 articles with individual page.tsx files — were missing from sitemap before this fix
  const staticBlogPages: MetadataRoute.Sitemap = STATIC_BLOG_SLUGS
    .filter(slug => !DYNAMIC_SLUGS.has(slug)) // avoid duplicates with ARTICLES
    .map(slug => ({
      url: `${BASE}/blog/${slug}`,
      lastModified: now,
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

  return [...staticPages, ...zonePages, ...propertyPages, ...premiumPages, ...blogPages, ...staticBlogPages]
}
