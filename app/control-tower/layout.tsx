// AGENCY GROUP — SH-ROS Control Tower: Layout | AMI: 22506
import type { Metadata } from 'next'
import { SidebarNav } from './_components/SidebarNav'

export const metadata: Metadata = {
  title: 'Control Tower — SH-ROS | Agency Group',
  description: 'SH-ROS Institutional Command Center',
}

export default function ControlTowerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-[#111118] border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
              <span className="text-xs font-bold text-white">AG</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-100 leading-none">Control Tower</p>
              <p className="text-[10px] text-slate-500 mt-0.5">SH-ROS · AMI 22506</p>
            </div>
          </div>
        </div>

        <SidebarNav />

        {/* Footer */}
        <div className="mt-auto px-4 py-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-600 font-mono">v∞ · {process.env.NODE_ENV}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        {/* Header */}
        <header className="h-10 bg-[#111118] border-b border-slate-800 flex items-center px-6 gap-4 sticky top-0 z-10">
          <span className="text-xs text-slate-500 font-mono">SH-ROS</span>
          <span className="text-slate-700">·</span>
          <span className="text-xs text-slate-400">Autonomous Revenue Operating System</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded font-mono">LIVE</span>
            <span className="text-[10px] text-slate-600 font-mono">{new Date().toISOString().slice(0, 10)}</span>
          </div>
        </header>

        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
