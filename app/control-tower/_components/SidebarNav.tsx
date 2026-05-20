'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
}

interface NavSection {
  label: string
  accentClass: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'INCIDENTS',
    accentClass: 'text-red-500',
    items: [
      { href: '/control-tower/incidents',    label: 'Incidents',    icon: '🚨' },
      { href: '/control-tower/self-healing', label: 'Self-Healing', icon: '⚕' },
      { href: '/control-tower/recovery',     label: 'Recovery',     icon: '🔧' },
      { href: '/control-tower/governance',   label: 'Governance',   icon: '⚖' },
    ],
  },
  {
    label: 'OBSERVABILITY',
    accentClass: 'text-slate-500',
    items: [
      { href: '/control-tower/events',      label: 'Events',       icon: '⚡' },
      { href: '/control-tower/observability', label: 'Observability', icon: '📡' },
      { href: '/control-tower/forensics',   label: 'Forensics',    icon: '🔬' },
      { href: '/control-tower/graph',       label: 'Graph',        icon: '🕸' },
      { href: '/control-tower/ai-timeline', label: 'AI Timeline',  icon: '🕐' },
      { href: '/control-tower/replay',      label: 'Replay',       icon: '⏮' },
    ],
  },
  {
    label: 'AI AGENTS',
    accentClass: 'text-slate-500',
    items: [
      { href: '/control-tower',           label: 'Overview',   icon: '⬡' },
      { href: '/control-tower/dashboard', label: 'Dashboard',  icon: '◉' },
      { href: '/control-tower/agents',    label: 'Agents',     icon: '🤖' },
      { href: '/control-tower/learning',  label: 'Learning',   icon: '📈' },
      { href: '/control-tower/economics', label: 'Economics',  icon: '💰' },
    ],
  },
  {
    label: 'INFRASTRUCTURE',
    accentClass: 'text-slate-500',
    items: [
      { href: '/control-tower/queue',         label: 'Queue',         icon: '⏳' },
      { href: '/control-tower/memory',        label: 'Memory',        icon: '🧠' },
      { href: '/control-tower/workflows',     label: 'Workflows',     icon: '🔗' },
      { href: '/control-tower/distributed',   label: 'Distributed',   icon: '🌐' },
      { href: '/control-tower/orchestration', label: 'Orchestration', icon: '⬡' },
      { href: '/control-tower/infra',         label: 'Infra',         icon: '🏗' },
    ],
  },
  {
    label: 'PLATFORM',
    accentClass: 'text-slate-500',
    items: [
      { href: '/control-tower/security',   label: 'Security',   icon: '🔐' },
      { href: '/control-tower/compliance', label: 'Compliance', icon: '🛡' },
      { href: '/control-tower/tenants',    label: 'Tenants',    icon: '🏢' },
      { href: '/control-tower/ceo',        label: 'CEO View',   icon: '👑' },
      { href: '/control-tower/settings',   label: 'Settings',   icon: '⚙' },
      { href: '/control-tower/revenue',    label: 'Revenue',    icon: '💶' },
    ],
  },
]

interface SidebarNavProps {
  dlqCount?: number
  criticalCount?: number
}

export function SidebarNav({ dlqCount = 0, criticalCount = 0 }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col px-2">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-1">
          <p className={`px-3 pt-3 pb-1 text-[10px] font-semibold tracking-widest uppercase ${section.accentClass}`}>
            {section.label}
          </p>
          {section.items.map((item) => {
            const isActive = item.href === '/control-tower'
              ? pathname === '/control-tower'
              : pathname.startsWith(item.href)

            const badge = item.label === 'Events' && dlqCount > 0 ? dlqCount
              : item.label === 'Queue' && dlqCount > 0 ? dlqCount
              : item.label === 'Incidents' && criticalCount > 0 ? criticalCount
              : item.label === 'Self-Healing' && criticalCount > 0 ? criticalCount
              : null

            const isCriticalBadge = item.label === 'Incidents' || item.label === 'Self-Healing'

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
                    <span className={`${
                      isCriticalBadge ? 'bg-red-600' : 'bg-orange-600'
                    } text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none`}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
