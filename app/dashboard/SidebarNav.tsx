'use client'

// AGENCY GROUP — Dashboard Sidebar Navigation with active state
// Client component — needs usePathname() to highlight the current route.

import { usePathname } from 'next/navigation'

interface NavItem {
  icon: string
  label: string
  href: string
}

export default function SidebarNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname()

  return (
    <>
      <style>{`
        .ag-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 9px;
          text-decoration: none;
          color: rgba(244,240,230,0.55);
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.01em;
          font-family: var(--font-jost, system-ui);
          transition: all 0.15s;
          margin-bottom: 2px;
        }
        .ag-nav-item:hover {
          background: rgba(201,169,110,0.08);
          color: rgba(244,240,230,0.85);
        }
        .ag-nav-item.active {
          background: rgba(201,169,110,0.10);
          color: #c9a96e;
          border-left: 2px solid #c9a96e;
          padding-left: 10px;
        }
        .ag-nav-item-icon {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
          background: transparent;
          transition: background 0.15s;
        }
        .ag-nav-item:hover .ag-nav-item-icon,
        .ag-nav-item.active .ag-nav-item-icon {
          background: rgba(201,169,110,0.1);
        }
        .ag-back-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 9px;
          text-decoration: none;
          color: rgba(244,240,230,0.28);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-family: var(--font-jost, system-ui);
          transition: color 0.15s;
          margin-top: 4px;
        }
        .ag-back-link:hover {
          color: rgba(244,240,230,0.55);
        }
      `}</style>

      {items.map((item) => {
        // Exact match for dashboard root; prefix match for sub-pages
        const isActive = item.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname.startsWith(item.href)

        return (
          <a
            key={item.href}
            href={item.href}
            className={`ag-nav-item${isActive ? ' active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="ag-nav-item-icon">{item.icon}</span>
            {item.label}
          </a>
        )
      })}
    </>
  )
}
