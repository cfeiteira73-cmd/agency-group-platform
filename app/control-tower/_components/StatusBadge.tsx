// Pure render component — no hooks/state, intentionally omits 'use client'
// Renders server-side in RSC pages, avoiding unnecessary client hydration.

type EventStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'
type EventPriority = 'critical' | 'high' | 'medium' | 'low'

type BadgeVariant = EventStatus | EventPriority | 'healthy' | 'degraded' | 'idle' | 'failed' | 'ok' | 'warning' | 'critical'

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  // Event status
  pending:    'bg-slate-800 text-slate-300 border border-slate-600',
  processing: 'bg-blue-950 text-blue-300 border border-blue-700',
  completed:  'bg-green-950 text-green-300 border border-green-700',
  failed:     'bg-red-950 text-red-300 border border-red-700',
  dlq:        'bg-orange-950 text-orange-300 border border-orange-700',
  // Priority
  critical:   'bg-red-950 text-red-200 border border-red-600',
  high:       'bg-amber-950 text-amber-300 border border-amber-700',
  medium:     'bg-blue-950 text-blue-300 border border-blue-700',
  low:        'bg-slate-800 text-slate-400 border border-slate-600',
  // Agent health
  healthy:    'bg-green-950 text-green-300 border border-green-700',
  degraded:   'bg-amber-950 text-amber-300 border border-amber-700',
  idle:       'bg-slate-800 text-slate-400 border border-slate-600',
  // System
  ok:         'bg-green-950 text-green-300 border border-green-700',
  warning:    'bg-amber-950 text-amber-300 border border-amber-700',
}

const VARIANT_LABELS: Partial<Record<BadgeVariant, string>> = {
  dlq: 'DLQ',
}

interface StatusBadgeProps {
  variant: BadgeVariant
  label?: string
  size?: 'xs' | 'sm'
}

export function StatusBadge({ variant, label, size = 'sm' }: StatusBadgeProps) {
  const styles = VARIANT_STYLES[variant] ?? 'bg-slate-800 text-slate-300 border border-slate-600'
  const displayLabel = label ?? VARIANT_LABELS[variant] ?? variant

  const sizeClass = size === 'xs'
    ? 'px-1.5 py-0.5 text-[10px] leading-none'
    : 'px-2 py-0.5 text-xs leading-none'

  return (
    <span className={`inline-flex items-center rounded font-mono font-medium uppercase tracking-wide ${sizeClass} ${styles}`}>
      {displayLabel}
    </span>
  )
}
