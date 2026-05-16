// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { ImageScore } from './imageScoringEngine'

export interface PhotoSequence {
  cover_image: ImageScore
  sequence: ImageScore[]      // ordered for gallery display
  hero_image: ImageScore      // for homepage hero (high impact)
  social_image: ImageScore    // best for social media
  thumbnail_image: ImageScore // smallest/fastest loading (lowest file priority)
}

// Canonical room order for gallery display
const ROOM_ORDER: Record<string, number> = {
  exterior: 0,
  terrace: 1,
  pool: 2,
  garden: 3,
  living_room: 4,
  dining_room: 5,
  kitchen: 6,
  bedroom: 7,
  bathroom: 8,
  office: 9,
  garage: 10,
  other: 11,
}

function roomPriority(roomType?: string): number {
  return ROOM_ORDER[roomType ?? 'other'] ?? 11
}

function pickBest(scores: ImageScore[], filter: (s: ImageScore) => boolean): ImageScore | undefined {
  return scores
    .filter(filter)
    .sort((a, b) => b.aesthetic_score - a.aesthetic_score)[0]
}

const PLACEHOLDER_SCORE: ImageScore = {
  asset_id: 'placeholder',
  url: '',
  aesthetic_score: 0,
  is_blurry: false,
  is_duplicate: false,
  lighting_quality: 'adequate',
  composition_score: 0,
  room_type: 'other',
  hero_candidate: false,
  social_candidate: false,
}

class CoverImageSelector {
  selectAndRank(scores: ImageScore[]): PhotoSequence {
    // Filter out unusable images
    const usable = scores.filter((s) => !s.is_blurry && !s.is_duplicate)

    // Cover: highest aesthetic_score among hero_candidates
    const cover_image =
      pickBest(usable, (s) => s.hero_candidate) ??
      pickBest(usable, () => true) ??
      PLACEHOLDER_SCORE

    // Hero: highest aesthetic_score overall among usable
    const hero_image =
      pickBest(usable, (s) => s.hero_candidate) ??
      pickBest(usable, () => true) ??
      cover_image

    // Social: best social_candidate
    const social_image =
      pickBest(usable, (s) => s.social_candidate) ??
      pickBest(usable, () => true) ??
      cover_image

    // Thumbnail: lowest aesthetic overhead — pick smallest by score (or exterior if available)
    const thumbnail_image =
      pickBest(usable, (s) => s.room_type === 'exterior') ??
      usable.sort((a, b) => a.aesthetic_score - b.aesthetic_score)[0] ??
      cover_image

    // Sequence: sorted by canonical room order, cover goes first
    const sequenced = [...usable].sort((a, b) => {
      const roomDiff = roomPriority(a.room_type) - roomPriority(b.room_type)
      if (roomDiff !== 0) return roomDiff
      return b.aesthetic_score - a.aesthetic_score
    })

    // Ensure cover is first in sequence
    const sequenceWithCoverFirst = [
      cover_image,
      ...sequenced.filter((s) => s.asset_id !== cover_image.asset_id),
    ]

    logger.info('[CoverImageSelector] selected', {
      cover_url: cover_image.url,
      sequence_length: sequenceWithCoverFirst.length,
    })

    return {
      cover_image,
      sequence: sequenceWithCoverFirst,
      hero_image,
      social_image,
      thumbnail_image,
    }
  }
}

export const coverImageSelector = new CoverImageSelector()
