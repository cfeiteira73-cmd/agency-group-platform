// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { supabaseAdmin } from '@/lib/supabase'
import type { PropertyAnalysis, GeneratedListing, ListingLanguage } from '@/lib/property-ai/types'
import { titleGenerator } from './titleGenerator'
import { descriptionGenerator } from './descriptionGenerator'
import { seoGenerator } from './seoGenerator'
import type { TitleSet } from './titleGenerator'
import type { DescriptionSet } from './descriptionGenerator'
import type { SEOPackage } from './seoGenerator'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

const PRIMARY_LANGUAGES: ListingLanguage[] = ['pt', 'en']
const SECONDARY_LANGUAGES: ListingLanguage[] = ['es', 'fr']
const LUXURY_LANGUAGES: ListingLanguage[] = ['de', 'ar']
const LUXURY_SCORE_THRESHOLD = 70

interface LanguageBundle {
  titles: TitleSet
  descriptions: DescriptionSet
  seo: SEOPackage
}

async function generateForLanguage(
  analysis: PropertyAnalysis,
  language: ListingLanguage,
  priceEur?: number,
  partialListing: Partial<GeneratedListing> = {},
): Promise<LanguageBundle> {
  const [titles, descriptions, seo] = await Promise.all([
    titleGenerator.generate(analysis, language),
    descriptionGenerator.generate(analysis, language, priceEur),
    seoGenerator.generate(analysis, partialListing, language),
  ])
  return { titles, descriptions, seo }
}

function assembleGeneratedListing(
  analysis: PropertyAnalysis,
  bundles: Partial<Record<ListingLanguage, LanguageBundle>>,
  priceEur?: number,
  languagesGenerated: ListingLanguage[] = [],
): GeneratedListing {
  const title: Partial<Record<ListingLanguage, string>> = {}
  const seo_title: Partial<Record<ListingLanguage, string>> = {}
  const description: Partial<Record<ListingLanguage, string>> = {}
  const short_description: Partial<Record<ListingLanguage, string>> = {}
  const investor_description: Partial<Record<ListingLanguage, string>> = {}
  const luxury_description: Partial<Record<ListingLanguage, string>> = {}
  const social_caption: Partial<Record<ListingLanguage, string>> = {}
  const meta_description: Partial<Record<ListingLanguage, string>> = {}
  const seo_keywords: string[] = []

  for (const [lang, bundle] of Object.entries(bundles) as Array<[ListingLanguage, LanguageBundle]>) {
    if (!bundle) continue
    title[lang] = bundle.titles.standard
    seo_title[lang] = bundle.titles.seo
    description[lang] = bundle.descriptions.full
    short_description[lang] = bundle.descriptions.short
    investor_description[lang] = bundle.descriptions.investor
    luxury_description[lang] = bundle.descriptions.luxury
    social_caption[lang] = bundle.titles.social
    meta_description[lang] = bundle.seo.meta_description
    for (const kw of bundle.seo.keywords) {
      if (!seo_keywords.includes(kw)) seo_keywords.push(kw)
    }
  }

  const pricePerSqm =
    priceEur != null && analysis.area_sqm != null && analysis.area_sqm > 0
      ? Math.round(priceEur / analysis.area_sqm)
      : undefined

  return {
    listing_id: crypto.randomUUID(),
    submission_id: analysis.submission_id,
    org_id: analysis.org_id,
    title,
    seo_title,
    description,
    short_description,
    investor_description,
    luxury_description,
    social_caption,
    meta_description,
    seo_keywords: seo_keywords.slice(0, 20),
    estimated_price_eur: priceEur,
    price_per_sqm: pricePerSqm,
    generated_at: new Date(),
    confidence: analysis.confidence,
  }
}

class ListingOrchestrator {
  async generate(analysis: PropertyAnalysis, priceEur?: number): Promise<GeneratedListing> {
    const languagesToGenerate: ListingLanguage[] = [...PRIMARY_LANGUAGES, ...SECONDARY_LANGUAGES]
    if (analysis.luxury_score > LUXURY_SCORE_THRESHOLD) {
      languagesToGenerate.push(...LUXURY_LANGUAGES)
    }

    const bundles: Partial<Record<ListingLanguage, LanguageBundle>> = {}

    // Run primary languages in parallel
    const primaryResults = await Promise.allSettled(
      PRIMARY_LANGUAGES.map(async (lang) => {
        const bundle = await generateForLanguage(analysis, lang, priceEur)
        return { lang, bundle }
      }),
    )
    for (const result of primaryResults) {
      if (result.status === 'fulfilled') {
        bundles[result.value.lang] = result.value.bundle
      } else {
        logger.warn('[ListingOrchestrator] primary language failed', {
          submission_id: analysis.submission_id,
          err: String(result.reason),
        })
      }
    }

    // Run secondary languages in parallel
    const secondaryResults = await Promise.allSettled(
      SECONDARY_LANGUAGES.map(async (lang) => {
        const bundle = await generateForLanguage(analysis, lang, priceEur)
        return { lang, bundle }
      }),
    )
    for (const result of secondaryResults) {
      if (result.status === 'fulfilled') {
        bundles[result.value.lang] = result.value.bundle
      } else {
        logger.warn('[ListingOrchestrator] secondary language failed', {
          submission_id: analysis.submission_id,
          err: String(result.reason),
        })
      }
    }

    // Run luxury languages only if luxury_score threshold met
    if (analysis.luxury_score > LUXURY_SCORE_THRESHOLD) {
      const luxuryResults = await Promise.allSettled(
        LUXURY_LANGUAGES.map(async (lang) => {
          const bundle = await generateForLanguage(analysis, lang, priceEur)
          return { lang, bundle }
        }),
      )
      for (const result of luxuryResults) {
        if (result.status === 'fulfilled') {
          bundles[result.value.lang] = result.value.bundle
        } else {
          logger.warn('[ListingOrchestrator] luxury language failed', {
            submission_id: analysis.submission_id,
            err: String(result.reason),
          })
        }
      }
    }

    const languagesGenerated = Object.keys(bundles) as ListingLanguage[]
    const listing = assembleGeneratedListing(analysis, bundles, priceEur, languagesGenerated)

    // Persist to Supabase
    try {
      const table = (sb.from('property_ai_listings') as {
        upsert: (data: unknown) => Promise<{ error: unknown }>
      })
      await table.upsert({
        listing_id: listing.listing_id,
        submission_id: listing.submission_id,
        org_id: listing.org_id,
        title: listing.title,
        seo_title: listing.seo_title,
        description: listing.description,
        short_description: listing.short_description,
        investor_description: listing.investor_description,
        luxury_description: listing.luxury_description,
        social_caption: listing.social_caption,
        meta_description: listing.meta_description,
        seo_keywords: listing.seo_keywords,
        estimated_price_eur: listing.estimated_price_eur,
        price_per_sqm: listing.price_per_sqm,
        generated_at: listing.generated_at.toISOString(),
        confidence: listing.confidence,
        languages_generated: languagesGenerated,
      })
    } catch (err) {
      logger.error('[ListingOrchestrator] supabase persist failed', {
        submission_id: analysis.submission_id,
        err: String(err),
      })
    }

    logger.info('[ListingOrchestrator] complete', {
      submission_id: analysis.submission_id,
      languages_generated: languagesGenerated,
      confidence: analysis.confidence,
    })

    return listing
  }
}

export const listingOrchestrator = new ListingOrchestrator()
