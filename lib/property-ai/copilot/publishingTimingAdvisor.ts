// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, PropertyIntelligence, DistributionChannel } from '@/lib/property-ai/types'

export type PublishingDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'

export interface PublishingStrategy {
  recommended_publish_time: string
  target_day: PublishingDay
  target_hour: number
  rationale: string
  boost_first_48h: boolean
  seasonal_note?: string
  channel_priority: DistributionChannel[]
}

// ISO month index (0-based)
const PEAK_MONTHS = new Set([4, 5, 8, 9]) // May, June, Sept, Oct

function nextWeekday(day: PublishingDay, hour: number): string {
  const DAY_MAP: Record<PublishingDay, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
  }
  const now = new Date()
  const target = DAY_MAP[day]
  const current = now.getDay() // 0=Sun
  let daysAhead = target - current
  if (daysAhead <= 0) daysAhead += 7
  const publish = new Date(now)
  publish.setDate(now.getDate() + daysAhead)
  publish.setHours(hour, 0, 0, 0)
  return publish.toISOString()
}

function seasonalNote(month: number): string | undefined {
  if (month === 4 || month === 5) return 'Q2 peak season — highest inquiry volumes from international buyers (May–June)'
  if (month === 8 || month === 9) return 'Q3/Q4 peak season — strong post-summer demand from European buyers (Sept–Oct)'
  return undefined
}

class PublishingTimingAdvisor {
  advise(
    analysis: PropertyAnalysis,
    intelligence: PropertyIntelligence,
  ): PublishingStrategy {
    const zoneClass = analysis.location?.zone_classification ?? 'mid-range'
    const isInternationalLuxury =
      zoneClass === 'ultra-luxury' || zoneClass === 'luxury'

    // Best publishing day: Tuesday–Thursday
    const target_day: PublishingDay = 'wednesday'

    // International luxury → morning for European/global audiences; domestic → evening peak
    const target_hour = isInternationalLuxury ? 10 : 18

    const recommended_publish_time = nextWeekday(target_day, target_hour)

    const boost_first_48h = intelligence.homepage_placement_score >= 70

    const channel_priority: DistributionChannel[] = isInternationalLuxury
      ? ['homepage', 'email', 'instagram', 'facebook', 'whatsapp', 'idealista', 'kyero', 'imovirtual', 'crm', 'tiktok']
      : ['homepage', 'idealista', 'imovirtual', 'email', 'instagram', 'facebook', 'whatsapp', 'crm', 'tiktok', 'kyero']

    const rationale = `Wednesday is the highest-engagement weekday for property inquiries. ${isInternationalLuxury ? '10:00 publish reaches European and global audiences during business hours.' : '18:00 publish captures domestic buyers post-work.'} ${boost_first_48h ? 'Paid boost recommended given strong placement score.' : ''}`

    const month = new Date().getMonth()
    const seasonal_note = PEAK_MONTHS.has(month) ? seasonalNote(month) : undefined

    logger.info('[PublishingTimingAdvisor] advised', {
      submission_id: analysis.submission_id,
      recommended_publish_time,
    })

    return {
      recommended_publish_time,
      target_day,
      target_hour,
      rationale,
      boost_first_48h,
      seasonal_note,
      channel_priority,
    }
  }
}

export const publishingTimingAdvisor = new PublishingTimingAdvisor()
