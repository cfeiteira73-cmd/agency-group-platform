// AGENCY GROUP — SH-ROS | AMI: 22506
// Experience Layer — Adaptive operational modes
import Link from 'next/link'

export default function ExperienceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-100">
      <nav className="border-b border-slate-800 bg-[#111118] px-6 py-3 flex items-center gap-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-white">AG</span>
          </div>
          <span className="text-xs text-slate-500 uppercase tracking-widest">Command Center</span>
        </div>
        {[
          { href: '/experience/executive', label: 'Executive', icon: '🎯' },
          { href: '/experience/operator',  label: 'Operator',  icon: '⚙️' },
          { href: '/experience/digest',    label: 'Digest',    icon: '📰' },
          { href: '/experience/broker',    label: 'Broker',    icon: '🏠' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1.5"
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <div className="ml-auto">
          <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded font-mono">LIVE</span>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
