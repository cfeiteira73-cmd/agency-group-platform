'use client'

import { useEffect, useState, type JSX } from 'react'

interface StaleDataWarningProps {
  lastUpdatedAt: string | Date | null
  staleThresholdMs?: number // default: 5 minutes
  onRefresh?: () => void
  compact?: boolean
}

export function StaleDataWarning({
  lastUpdatedAt,
  staleThresholdMs = 5 * 60 * 1000,
  onRefresh,
  compact = false,
}: StaleDataWarningProps): JSX.Element | null {
  const [isStale, setIsStale] = useState(false)
  const [staleSince, setStaleSince] = useState<string | null>(null)

  useEffect(() => {
    if (!lastUpdatedAt) return
    const checkStale = () => {
      const last =
        typeof lastUpdatedAt === 'string' ? new Date(lastUpdatedAt) : lastUpdatedAt
      const ageMs = Date.now() - last.getTime()
      const stale = ageMs > staleThresholdMs
      setIsStale(stale)
      if (stale) {
        const mins = Math.floor(ageMs / 60_000)
        setStaleSince(
          mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`,
        )
      }
    }
    checkStale()
    const interval = setInterval(checkStale, 30_000)
    return () => clearInterval(interval)
  }, [lastUpdatedAt, staleThresholdMs])

  if (!isStale || !lastUpdatedAt) return null

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Data is {staleSince} old
      </span>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-sm"
    >
      <span className="text-amber-800 dark:text-amber-200">
        ⚠ Data may be outdated ({staleSince} since last update)
      </span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="ml-3 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline focus:outline-none"
        >
          Refresh
        </button>
      )}
    </div>
  )
}
