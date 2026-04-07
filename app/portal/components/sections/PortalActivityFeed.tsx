'use client'

interface Activity {
  id: string
  type: 'deal_created' | 'deal_updated' | 'contact_added' | 'property_added' | 'task_completed' | 'agent_action'
  title: string
  description?: string
  timestamp: string
  user?: string
}

interface Props {
  activities: Activity[]
  loading?: boolean
}

const ACTIVITY_ICONS: Record<Activity['type'], string> = {
  deal_created: '🤝',
  deal_updated: '📝',
  contact_added: '👤',
  property_added: '🏠',
  task_completed: '✅',
  agent_action: '🤖',
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (seconds < 60) return 'agora'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

export function PortalActivityFeed({ activities, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-2xl mb-2" aria-hidden="true">📊</p>
        <p className="text-sm">Sem actividade recente</p>
      </div>
    )
  }

  return (
    <ol className="space-y-2" aria-label="Actividade recente">
      {activities.map(activity => (
        <li key={activity.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
          <span className="text-lg flex-shrink-0 mt-0.5" aria-hidden="true">
            {ACTIVITY_ICONS[activity.type] || '📋'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{activity.title}</p>
            {activity.description && (
              <p className="text-xs text-gray-500 truncate">{activity.description}</p>
            )}
          </div>
          <time
            dateTime={activity.timestamp}
            className="text-xs text-gray-400 flex-shrink-0"
          >
            {timeAgo(activity.timestamp)}
          </time>
        </li>
      ))}
    </ol>
  )
}
