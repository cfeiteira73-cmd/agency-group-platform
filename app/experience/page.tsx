// AGENCY GROUP — SH-ROS | AMI: 22506
// Experience Hub — Choose operational mode

export default function ExperienceHubPage() {
  const modes = [
    {
      href: '/experience/executive',
      icon: '🎯',
      title: 'Executive Mode',
      description: 'Daily brief, KPI overview, opportunity radar, and strategic forecast. For Managing Directors and Partners.',
      roles: ['Managing Director', 'Partner', 'CRO'],
      color: 'border-blue-800/40 hover:border-blue-600/60',
      badge: 'bg-blue-500/10 text-blue-400',
    },
    {
      href: '/experience/operator',
      icon: '⚙️',
      title: 'Operator Mode',
      description: 'Pipeline management, team activity, deal progression, and operational health. For senior brokers.',
      roles: ['Senior Broker', 'Team Lead', 'Operations'],
      color: 'border-emerald-800/40 hover:border-emerald-600/60',
      badge: 'bg-emerald-500/10 text-emerald-400',
    },
    {
      href: '/experience/digest',
      icon: '📰',
      title: 'AI Digest',
      description: 'Morning briefing, revenue narrative, and 30/90-day forecast. Delivered daily.',
      roles: ['All roles'],
      color: 'border-purple-800/40 hover:border-purple-600/60',
      badge: 'bg-purple-500/10 text-purple-400',
    },
    {
      href: '/experience/broker',
      icon: '🏠',
      title: 'Broker Mode',
      description: "My hot leads, today's actions, pipeline position, and commission tracker. Mobile-first.",
      roles: ['Agent', 'Broker', 'Field'],
      color: 'border-orange-800/40 hover:border-orange-600/60',
      badge: 'bg-orange-500/10 text-orange-400',
    },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">SH-ROS · AMI 22506</p>
        <h1 className="text-3xl font-bold text-white">Command Center</h1>
        <p className="text-slate-400 mt-1">Choose your operational mode</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modes.map(mode => (
          <a
            key={mode.href}
            href={mode.href}
            className={`block bg-[#111118] border ${mode.color} rounded-xl p-6 transition-all group`}
          >
            <div className="text-3xl mb-3">{mode.icon}</div>
            <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-slate-100 transition-colors">
              {mode.title}
            </h2>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">{mode.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {mode.roles.map(r => (
                <span key={r} className={`text-[10px] ${mode.badge} px-2 py-0.5 rounded-full font-medium`}>
                  {r}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>

      <div className="mt-8 p-4 bg-[#111118] border border-slate-800/50 rounded-lg">
        <p className="text-xs text-slate-500">
          <span className="text-slate-400 font-medium">SH-ROS</span> — Autonomous Revenue Operating System ·
          Portugal market calibrated · λ=0.95 attribution · 210-day cycle · +35% close rate uplift
        </p>
      </div>
    </div>
  )
}
