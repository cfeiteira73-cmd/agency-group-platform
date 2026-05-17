// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// URL Scraper — fetches property listing pages from any real estate portal
// and extracts structured property data using Claude.
// Supports: Idealista, Imovirtual, OLX, Realestate.com, Unimóvel, ERA, RE/MAX,
//           Century 21, KW, Sotheby's, Rightmove, any generic property page.
// =============================================================================

import { logger } from '@/lib/observability/logger'
import type { PropertyType } from '@/lib/property-ai/types'

export interface UrlScrapedData {
  title?: string
  description?: string
  price_eur?: number
  bedrooms?: number
  bathrooms?: number
  area_sqm?: number
  floor?: number
  property_type?: PropertyType
  location_city?: string
  location_neighborhood?: string
  energy_class?: string
  has_pool?: boolean
  has_garage?: boolean
  has_elevator?: boolean
  has_garden?: boolean
  has_sea_view?: boolean
  year_built?: number
  condition?: string
  features?: string[]
  images?: string[]
  portal_reference?: string
  confidence: number
  source_url: string
  scraped_at: Date
}

// ---------------------------------------------------------------------------
// Portal-specific selectors (regex patterns for clean extraction)
// ---------------------------------------------------------------------------

const PORTAL_PATTERNS: Record<string, RegExp> = {
  idealista: /idealista\.(pt|es|it|com)/,
  imovirtual: /imovirtual\.com/,
  olx: /olx\.pt/,
  realestate: /realestate\.com/,
  unimovél: /unimov/i,
  era: /era\.pt/,
  remax: /remax\.pt/,
  century21: /century21\.pt/,
  kw: /kwportugal\.pt|kwcomercial\.pt/,
  rightmove: /rightmove\.co\.uk/,
  sothebys: /sothebysrealty/,
}

function detectPortal(url: string): string {
  for (const [name, pattern] of Object.entries(PORTAL_PATTERNS)) {
    if (pattern.test(url)) return name
  }
  return 'generic'
}

// ---------------------------------------------------------------------------
// HTML → plain text (no DOM parser — works in Node.js edge)
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    // Remove script, style, nav, footer, header (with their content)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    // Convert common elements to newlines
    .replace(/<\/(p|div|li|tr|h[1-6]|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&euro;/g, '€')
    .replace(/&#8364;/g, '€')
    .replace(/&quot;/g, '"')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function truncateForClaude(text: string, maxChars = 8000): string {
  if (text.length <= maxChars) return text
  // Keep beginning and end (most relevant for property pages)
  const half = Math.floor(maxChars / 2)
  return `${text.slice(0, half)}\n\n[...truncated...]\n\n${text.slice(-half)}`
}

// ---------------------------------------------------------------------------
// Claude extraction prompt
// ---------------------------------------------------------------------------

function buildExtractionPrompt(text: string, url: string, portal: string): string {
  return `You are a world-class real estate data extraction AI. You've been given scraped text from a property listing page.

Portal detected: ${portal}
Source URL: ${url}

Extract ALL available property information and return a JSON object with EXACTLY these fields (use null for missing):
{
  "title": "string or null",
  "description": "full property description or null",
  "price_eur": number or null,
  "bedrooms": number or null,
  "bathrooms": number or null,
  "area_sqm": number or null (gross area if multiple given),
  "floor": number or null,
  "property_type": "apartment|villa|townhouse|penthouse|studio|commercial|land|garage" or null,
  "location_city": "city name or null",
  "location_neighborhood": "neighborhood/parish or null",
  "energy_class": "A+|A|B|B-|C|D|E|F" or null,
  "has_pool": true/false,
  "has_garage": true/false,
  "has_elevator": true/false,
  "has_garden": true/false,
  "has_sea_view": true/false,
  "year_built": number or null,
  "condition": "new|excellent|good|needs_renovation" or null,
  "features": ["feature1", "feature2", ...] (max 10 key features),
  "portal_reference": "listing ID/reference code or null",
  "confidence": 0.0-1.0 (how confident you are in the overall extraction)
}

IMPORTANT:
- For price: convert to EUR if in another currency. Strip symbols and commas.
- For area: use m² (convert if ft² — divide by 10.764)
- Return ONLY the JSON object, no additional text.

Scraped page text:
${text}`
}

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

async function callClaudeExtract(prompt: string): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!resp.ok) {
    throw new Error(`Claude API error: ${resp.status}`)
  }

  const data = await resp.json() as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ''
}

// ---------------------------------------------------------------------------
// Fetch the URL
// ---------------------------------------------------------------------------

async function fetchPageHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      // Mimic a real browser to avoid bot detection
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
      'Accept-Encoding': 'identity', // avoid gzip — simpler to handle
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(15_000), // 15s timeout
    redirect: 'follow',
  })

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} fetching ${url}`)
  }

  const contentType = resp.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error(`Non-HTML content type: ${contentType}`)
  }

  // Limit to 500KB to avoid huge pages
  const text = await resp.text()
  return text.slice(0, 500_000)
}

// ---------------------------------------------------------------------------
// Main scraper class
// ---------------------------------------------------------------------------

class UrlScraper {
  async scrape(url: string, submissionId: string): Promise<UrlScrapedData> {
    const portal = detectPortal(url)
    logger.info('[UrlScraper] scraping', { submissionId, url, portal })

    const fallback: UrlScrapedData = {
      confidence: 0,
      source_url: url,
      scraped_at: new Date(),
    }

    try {
      // 1. Fetch HTML
      const html = await fetchPageHtml(url)

      // 2. Strip to plain text
      const text = stripHtml(html)
      const truncated = truncateForClaude(text, 8000)

      if (truncated.length < 100) {
        logger.warn('[UrlScraper] page too short after stripping', { submissionId, url, length: truncated.length })
        return fallback
      }

      // 3. Claude extraction
      const prompt = buildExtractionPrompt(truncated, url, portal)
      const raw = await callClaudeExtract(prompt)

      // 4. Parse JSON
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        logger.warn('[UrlScraper] no JSON in Claude response', { submissionId, url })
        return fallback
      }

      const parsed = JSON.parse(jsonMatch[0]) as Partial<UrlScrapedData & {
        has_garage: boolean
        location_city: string
        location_neighborhood: string
        energy_class: string
        year_built: number
        condition: string
        features: string[]
        portal_reference: string
      }>

      const result: UrlScrapedData = {
        title:                parsed.title ?? undefined,
        description:          parsed.description ?? undefined,
        price_eur:            typeof parsed.price_eur === 'number' ? parsed.price_eur : undefined,
        bedrooms:             typeof parsed.bedrooms === 'number' ? parsed.bedrooms : undefined,
        bathrooms:            typeof parsed.bathrooms === 'number' ? parsed.bathrooms : undefined,
        area_sqm:             typeof parsed.area_sqm === 'number' ? parsed.area_sqm : undefined,
        floor:                typeof parsed.floor === 'number' ? parsed.floor : undefined,
        property_type:        (parsed.property_type as PropertyType) ?? undefined,
        location_city:        parsed.location_city ?? undefined,
        location_neighborhood: parsed.location_neighborhood ?? undefined,
        energy_class:         parsed.energy_class ?? undefined,
        has_pool:             Boolean(parsed.has_pool),
        has_garage:           Boolean(parsed.has_garage),
        has_elevator:         Boolean(parsed.has_elevator),
        has_garden:           Boolean(parsed.has_garden),
        has_sea_view:         Boolean(parsed.has_sea_view),
        year_built:           typeof parsed.year_built === 'number' ? parsed.year_built : undefined,
        condition:            parsed.condition ?? undefined,
        features:             Array.isArray(parsed.features) ? parsed.features : [],
        portal_reference:     parsed.portal_reference ?? undefined,
        confidence:           typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
        source_url:           url,
        scraped_at:           new Date(),
      }

      logger.info('[UrlScraper] extraction complete', {
        submissionId,
        portal,
        confidence: result.confidence,
        has_price: !!result.price_eur,
        has_location: !!result.location_city,
        bedrooms: result.bedrooms,
      })

      return result
    } catch (err) {
      logger.error('[UrlScraper] scraping failed', { submissionId, url, err: err instanceof Error ? err.message : String(err) })
      return fallback
    }
  }
}

export const urlScraper = new UrlScraper()
