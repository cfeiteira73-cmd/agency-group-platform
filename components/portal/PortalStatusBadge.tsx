import type { JSX } from 'react'

type StatusLevel = 'operational' | 'degraded' | 'outage' | 'maintenance' | 'unknown'

interface PortalStatusBadgeProps {
  status: StatusLevel
  label?: string
  showDot?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const STATUS_CONFIG: Record<
  StatusLevel,
  { color: string; bg: string; dot: string; defaultLabel: string }
> = {
  operational: {
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-100 dark:bg-green-900',
    dot: 'bg-green-500',
    defaultLabel: 'Operational',
  },
  degraded: {
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-900',
    dot: 'bg-amber-500',
    defaultLabel: 'Degraded',
  },
  outage: {
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-100 dark:bg-red-900',
    dot: 'bg-red-500 animate-pulse',
    defaultLabel: 'Outage',
  },
  maintenance: {
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-900',
    dot: 'bg-blue-500',
    defaultLabel: 'Maintenance',
  },
  unknown: {
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800',
    dot: 'bg-gray-400',
    defaultLabel: 'Unknown',
  },
}

export function PortalStatusBadge({
  status,
  label,
  showDot = true,
  size = 'sm',
}: PortalStatusBadgeProps): JSX.Element {
  const cfg = STATUS_CONFIG[status]
  const sizeClass = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }[size]
  const dotSize = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }[size]

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${cfg.color} ${cfg.bg} ${sizeClass}`}
      role="status"
      aria-label={`Status: ${label ?? cfg.defaultLabel}`}
    >
      {showDot && (
        <span
          className={`rounded-full ${cfg.dot} ${dotSize}`}
          aria-hidden="true"
        />
      )}
      {label ?? cfg.defaultLabel}
    </span>
  )
}
