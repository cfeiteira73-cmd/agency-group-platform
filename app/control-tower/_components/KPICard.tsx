'use client'

interface KPICardProps {
  title: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'default' | 'green' | 'red' | 'amber' | 'blue' | 'purple'
  mono?: boolean
}

const COLOR_MAP = {
  default: 'text-slate-100',
  green:   'text-green-400',
  red:     'text-red-400',
  amber:   'text-amber-400',
  blue:    'text-blue-400',
  purple:  'text-purple-400',
}

const TREND_ICON = {
  up:      '↑',
  down:    '↓',
  neutral: '→',
}

const TREND_COLOR = {
  up:      'text-green-400',
  down:    'text-red-400',
  neutral: 'text-slate-400',
}

export function KPICard({ title, value, sub, trend, trendValue, color = 'default', mono = false }: KPICardProps) {
  return (
    <div className="bg-[#111118] border border-slate-800 rounded-lg p-4 flex flex-col gap-1 min-w-0">
      <p className="text-xs text-slate-500 uppercase tracking-widest font-medium truncate">{title}</p>
      <p className={`text-3xl font-bold leading-none ${mono ? 'font-mono' : ''} ${COLOR_MAP[color]}`}>
        {value}
      </p>
      {(sub || trend) && (
        <div className="flex items-center gap-2 mt-1">
          {trend && trendValue && (
            <span className={`text-xs font-mono ${TREND_COLOR[trend]}`}>
              {TREND_ICON[trend]} {trendValue}
            </span>
          )}
          {sub && <span className="text-xs text-slate-500 truncate">{sub}</span>}
        </div>
      )}
    </div>
  )
}
