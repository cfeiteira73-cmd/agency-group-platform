// =============================================================================
// Agency Group — National Data Ingestion Framework
// lib/ingestion/types.ts
//
// Unified interfaces for all Portugal real estate data providers.
// Every provider adapter must implement ProviderAdapter and emit ProviderListing.
//
// Provider trust scores:
//   casafari    = 1.00  (professional B2B aggregator, highest data quality)
//   eleiloes    = 1.00  (legal auctions, official government source)
//   idealista   = 0.95  (major portal, professional listings, some duplication)
//   imovirtual  = 0.90  (second major portal, more consumer listings)
//   dre         = 1.00  (official government gazette — insolvency/inheritance)
//   manual      = 0.70  (agent-entered, no external validation)
//   scraped     = 0.60  (web-scraped from unverified sources)
// =============================================================================

// ---------------------------------------------------------------------------
// Provider names
// ---------------------------------------------------------------------------

export type ProviderName =
  | 'idealista'
  | 'imovirtual'
  | 'casafari'
  | 'eleiloes'
  | 'dre'
  | 'manual'
  | 'scraped'

export const PROVIDER_CONFIDENCE: Record<ProviderName, number> = {
  casafari:   1.00,
  eleiloes:   1.00,
  dre:        1.00,
  idealista:  0.95,
  imovirtual: 0.90,
  manual:     0.70,
  scraped:    0.60,
}

// ---------------------------------------------------------------------------
// Normalized listing (output of every provider adapter)
// ---------------------------------------------------------------------------

export interface ProviderListing {
  // ── Identity ───────────────────────────────────────────────────────────────
  provider:            ProviderName
  provider_listing_id: string
  source_confidence:   number   // 0-1 (from PROVIDER_CONFIDENCE)
  source_url:          string

  // ── Core fields (normalized to our schema) ─────────────────────────────────
  title:               string
  price:               number
  price_previous?:     number | null
  area_m2?:            number | null
  bedrooms?:           number | null
  bathrooms?:          number | null
  type?:               NormalizedPropertyType | null
  condition?:          NormalizedCondition | null
  status:              'active' | 'sold' | 'withdrawn' | 'auction'

  // ── Location ───────────────────────────────────────────────────────────────
  address?:            string | null
  zone?:               string | null
  city?:               string | null
  concelho?:           string | null
  latitude?:           number | null
  longitude?:          number | null

  // ── Presentation ───────────────────────────────────────────────────────────
  description?:        string | null
  photos?:             string[]
  features?:           string[]
  has_floorplan?:      boolean
  has_video?:          boolean
  num_photos?:         number

  // ── Market timing ──────────────────────────────────────────────────────────
  listed_at?:          string | null  // ISO date from provider
  scraped_at:          string         // ISO timestamp when we fetched it

  // ── Auction-specific (for eleiloes / bank listings) ─────────────────────────
  auction_end_date?:   string | null
  auction_base_price?: number | null
  auction_min_bid?:    number | null
}

// Property type normalized to our internal enum
export type NormalizedPropertyType =
  | 'apartment' | 'penthouse' | 'villa' | 'townhouse'
  | 'commercial' | 'office' | 'land' | 'warehouse'
  | 'hotel' | 'development_plot' | 'other'

// Condition normalized
export type NormalizedCondition =
  | 'new' | 'excellent' | 'good' | 'needs_renovation' | 'ruin'

// ---------------------------------------------------------------------------
// Provider fetch parameters (common across all providers)
// ---------------------------------------------------------------------------

export interface ProviderFetchParams {
  city?:       string           // e.g. 'Lisboa', 'Porto'
  zone?:       string           // zone key from zones.ts
  minPrice?:   number
  maxPrice?:   number
  limit?:      number           // max listings to return
  page?:       number           // pagination
  propertyType?: NormalizedPropertyType
  operation?:  'sale' | 'rent'
}

// ---------------------------------------------------------------------------
// Provider adapter interface — all adapters must implement this
// ---------------------------------------------------------------------------

export interface ProviderAdapter {
  /** Unique provider name */
  readonly name:         ProviderName
  /** Trust score for data from this provider */
  readonly confidence:   number
  /**
   * Check if the adapter is ready to use (env vars configured etc.)
   * Returns false if required API keys are missing.
   * Safe to call with no network — no side effects.
   */
  isConfigured(): boolean
  /**
   * Fetch and normalize listings from this provider.
   * Returns empty array (not throws) on any error.
   */
  fetchListings(params?: ProviderFetchParams): Promise<ProviderListing[]>
}

// ---------------------------------------------------------------------------
// Dedup result
// ---------------------------------------------------------------------------

export interface DedupResult {
  /** ID of matching existing property, or null if genuinely new */
  canonical_id:     string | null
  /** True if no existing match was found */
  is_new:           boolean
  /** How confident we are that this matches the existing property (0–1) */
  merge_confidence: number
  /** Fields that contributed to the match decision */
  match_signals:    string[]
}

// ---------------------------------------------------------------------------
// Single ingestion result for one provider
// ---------------------------------------------------------------------------

export interface ProviderIngestionResult {
  provider:       ProviderName
  fetched:        number
  new_listings:   number
  updated:        number
  duplicates_skipped: number
  errors:         string[]
  duration_ms:    number
}

// ---------------------------------------------------------------------------
// Full pipeline run result
// ---------------------------------------------------------------------------

export interface PipelineRunResult {
  run_id:          string
  started_at:      string
  completed_at:    string
  duration_ms:     number
  providers:       ProviderIngestionResult[]
  total_fetched:   number
  total_new:       number
  total_updated:   number
  total_errors:    number
  warnings:        string[]
}
