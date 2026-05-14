'use client'

interface SparklineBarProps {
  data: number[]
  height?: number
  color?: string
  label?: string
}

export function SparklineBar({ data, height = 48, color = '#3B82F6', label }: SparklineBarProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-600 text-xs" style={{ height }}>
        No data
      </div>
    )
  }

  const max = Math.max(...data, 1)
  const barWidth = Math.floor(100 / data.length)

  return (
    <div className="w-full">
      {label && <p className="text-xs text-slate-500 mb-1">{label}</p>}
      <div className="flex items-end gap-px" style={{ height }}>
        {data.map((val, i) => {
          const pct = Math.max((val / max) * 100, 2)
          const isLast = i === data.length - 1
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-300"
              style={{
                height: `${pct}%`,
                backgroundColor: isLast ? color : `${color}80`,
                minWidth: 2,
              }}
              title={`${val}`}
            />
          )
        })}
      </div>
    </div>
  )
}
