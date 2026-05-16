// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// Main barrel — re-exports all property-ai modules

export * from '@/lib/property-ai/types'
export * from '@/lib/property-ai/ingestion'
export * from '@/lib/property-ai/listing-generator'
export * from '@/lib/property-ai/media'
export * from '@/lib/property-ai/intelligence'
export * from '@/lib/property-ai/copilot'
export * from '@/lib/property-ai/homepage'
export * from '@/lib/property-ai/distribution'
export * from '@/lib/property-ai/learning'

// Convenience namespace
import { mediaIngestionOrchestrator } from '@/lib/property-ai/ingestion'
import { listingOrchestrator } from '@/lib/property-ai/listing-generator'
import { mediaOrchestrator } from '@/lib/property-ai/media'
import { propertyIntelligenceEngine } from '@/lib/property-ai/intelligence'
import { copilotOrchestrator } from '@/lib/property-ai/copilot'
import { homepageRankingEngine } from '@/lib/property-ai/homepage'
import { distributionOrchestrator } from '@/lib/property-ai/distribution'
import { listingPerformanceTracker } from '@/lib/property-ai/learning'

export const propertyAI = {
  // ingestion
  ingest: mediaIngestionOrchestrator,
  // listing
  generateListing: listingOrchestrator,
  // media
  processMedia: mediaOrchestrator,
  // intelligence
  computeIntelligence: propertyIntelligenceEngine,
  // copilot
  copilot: copilotOrchestrator,
  // homepage
  rankHomepage: homepageRankingEngine,
  // distribution
  distribute: distributionOrchestrator,
  // learning
  trackPerformance: listingPerformanceTracker,
}
