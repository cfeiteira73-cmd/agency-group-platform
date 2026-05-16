// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

export type PropertyInputType = 'photo' | 'video' | 'pdf' | 'audio' | 'text' | 'url' | 'drone'
export type PropertyStatus = 'ingesting' | 'analyzing' | 'enriching' | 'generating' | 'reviewing' | 'live' | 'archived'
export type ListingLanguage = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'ar'
export type DistributionChannel = 'homepage' | 'crm' | 'email' | 'instagram' | 'facebook' | 'tiktok' | 'whatsapp' | 'idealista' | 'imovirtual' | 'kyero'
export type PropertyType = 'apartment' | 'villa' | 'townhouse' | 'penthouse' | 'studio' | 'commercial' | 'land' | 'garage'
export type ArchitectureStyle = 'modern' | 'contemporary' | 'traditional' | 'luxury' | 'rustic' | 'art-deco' | 'minimalist' | 'mediterranean'
export type EnergyClass = 'A+' | 'A' | 'B' | 'B-' | 'C' | 'D' | 'E' | 'F' | 'unknown'
export type PropertyCondition = 'new' | 'excellent' | 'good' | 'needs_renovation' | 'unknown'
export type StagingQuality = 'unstaged' | 'basic' | 'professional' | 'luxury'
export type ZoneClassification = 'ultra-luxury' | 'luxury' | 'premium' | 'mid-range' | 'affordable'

export interface InputFile {
  file_id: string; type: PropertyInputType; url: string; filename: string; size_bytes: number; uploaded_at: Date
}
export interface PropertySubmission {
  submission_id: string; org_id: string; agent_id: string; status: PropertyStatus
  input_files: InputFile[]; raw_description?: string; raw_url?: string; created_at: Date; updated_at: Date
}
export interface PropertyLocation {
  city?: string; neighborhood?: string; zone?: string; latitude?: number; longitude?: number
  walkability_score?: number; premium_zone: boolean; zone_classification: ZoneClassification; nearby_amenities: string[]
}
export interface PropertyAnalysis {
  analysis_id: string; submission_id: string; org_id: string
  property_type?: PropertyType; bedrooms?: number; bathrooms?: number; area_sqm?: number; floor?: number
  condition: PropertyCondition; energy_class: EnergyClass
  has_pool: boolean; has_garden: boolean; has_parking: boolean; has_elevator: boolean
  has_sea_view: boolean; has_golf_view: boolean; has_city_view: boolean; has_mountain_view: boolean
  architecture_style: ArchitectureStyle; luxury_score: number; renovation_probability: number
  sunlight_score: number; staging_quality: StagingQuality; location?: PropertyLocation
  confidence: number; analyzed_at: Date
}
export interface GeneratedListing {
  listing_id: string; submission_id: string; org_id: string
  title: Partial<Record<ListingLanguage, string>>; seo_title: Partial<Record<ListingLanguage, string>>
  description: Partial<Record<ListingLanguage, string>>; short_description: Partial<Record<ListingLanguage, string>>
  investor_description: Partial<Record<ListingLanguage, string>>; luxury_description: Partial<Record<ListingLanguage, string>>
  social_caption: Partial<Record<ListingLanguage, string>>; meta_description: Partial<Record<ListingLanguage, string>>
  seo_keywords: string[]; estimated_price_eur?: number; price_per_sqm?: number; generated_at: Date; confidence: number
}
export interface MediaAsset {
  asset_id: string; submission_id: string; type: PropertyInputType; url: string; thumbnail_url?: string
  aesthetic_score: number; is_cover: boolean; sequence_order: number; is_blurry: boolean; is_duplicate: boolean
  social_crop_url?: string; hero_crop_url?: string; created_at: Date
}
export interface PropertyIntelligence {
  intel_id: string; submission_id: string; org_id: string
  demand_score: number; conversion_probability: number; lead_attractiveness: number; investor_attractiveness: number
  liquidity_speed_days: number; pricing_competitiveness: number; featured_priority_score: number
  luxury_visibility_score: number; homepage_placement_score: number; listing_readiness_score: number; computed_at: Date
}
export interface DistributionResult {
  distribution_id: string; submission_id: string; channel: DistributionChannel
  status: 'pending' | 'sent' | 'failed' | 'skipped'; sent_at?: Date; error?: string; asset_url?: string
}
export interface ListingPerformance {
  perf_id: string; submission_id: string; org_id: string
  clicks: number; saves: number; shares: number; inquiries: number; viewings_booked: number
  avg_time_on_listing_s: number; ctr: number; lead_quality_score: number; period_start: Date; period_end: Date
}
