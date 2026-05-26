import type { JSX } from 'react'

interface SkeletonProps {
  className?: string
  width?: string
  height?: string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

export function Skeleton({
  className = '',
  width = 'w-full',
  height = 'h-4',
  rounded = 'md',
}: SkeletonProps): JSX.Element {
  const roundedClass = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }[rounded]
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${width} ${height} ${roundedClass} ${className}`}
      role="status"
      aria-label="Loading..."
    />
  )
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <Skeleton height="h-5" width="w-2/3" />
      <Skeleton height="h-4" width="w-full" />
      <Skeleton height="h-4" width="w-4/5" />
      <div className="flex gap-2 pt-1">
        <Skeleton height="h-8" width="w-24" rounded="full" />
        <Skeleton height="h-8" width="w-20" rounded="full" />
      </div>
    </div>
  )
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number
  cols?: number
}): JSX.Element {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="h-4" width={i === 0 ? 'w-1/4' : 'flex-1'} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} height="h-4" width={colIdx === 0 ? 'w-1/4' : 'flex-1'} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonDashboard(): JSX.Element {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading dashboard...">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2"
          >
            <Skeleton height="h-3" width="w-3/4" />
            <Skeleton height="h-8" width="w-1/2" />
            <Skeleton height="h-3" width="w-2/3" />
          </div>
        ))}
      </div>
      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonTable rows={6} cols={5} />
        </div>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}

export function SkeletonChart({ height = 'h-48' }: { height?: string }): JSX.Element {
  const barHeights = [
    'h-1/4',
    'h-1/3',
    'h-1/2',
    'h-2/3',
    'h-3/4',
    'h-1/2',
    'h-1/3',
    'h-2/3',
    'h-full',
    'h-3/4',
    'h-1/2',
    'h-2/3',
  ] as const

  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${height}`}
    >
      <Skeleton height="h-4" width="w-1/3" className="mb-4" />
      <div className="h-full flex items-end gap-2 pb-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-sm ${barHeights[i % barHeights.length]}`}
          />
        ))}
      </div>
    </div>
  )
}
