'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
  badge?: number | null
}

const NAV_ITEMS: NavItem[] = [
  { href: '/control-tower',             label: 'Overview',    icon: '⬡' },
  { href: '/control-tower/events',      label: 'Events',      icon: '⚡' },
  { href: '/control-tower/agents',      label: 'Agents',      icon: '🤖' },
  { href: '/control-tower/queue',       label: 'Queue',       icon: '⏳' },
  { href: '/control-tower/memory',      label: 'Memory',      icon: '🧠' },
  { href: '/control-tower/workflows',   label: 'Workflows',   icon: '🔗' },
  { href: '/control-tower/learning',    label: 'Learning',    icon: '📈' },
  { href: '/control-tower/economics',   label: 'Economics',   icon: '💰' },
  { href: '/control-tower/forensics',   label: 'Forensics',   icon: '🔬' },
  { href: '/control-tower/observability', label: 'Observability', icon: '📡' },
  { href: '/control-tower/security',     label: 'Security',     icon: '🔐' },
  { href: '/control-tower/incidents',    label: 'Incidents',    icon: '🚨' },
  { href: '/control-tower/compliance',   label: 'Compliance',   icon: '🛡' },
  { href: '/control-tower/recovery',     label: 'Recovery',     icon: '🔧' },
  { href: '/control-tower/settings',     label: 'Settings',     icon: '⚙' },
]

interface SidebarNavProps {
  dlqCount?: number
  criticalCount?: number
}

export function SidebarNav({ dlqCount = 0, criticalCount = 0 }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/control-tower'
          ? pathname === '/control-tower'
          : pathname.startsWith(item.href)

        const badge = item.label === 'Events' && dlqCount > 0 ? dlqCount
          : item.label === 'Queue' && dlqCount > 0 ? dlqCount
          : null

        return (
          <Link key={item.href} href={item.href}>
            <div className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
              isActive
                ? 'bg-[#1A1A24] text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#111118]'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="text-base w-4 text-center leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
              </div>
              {badge !== null && badge > 0 && (
                <span className="bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </nav>
  )
}
