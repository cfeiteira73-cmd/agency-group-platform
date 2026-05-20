// AGENCY GROUP — SH-ROS Control Tower: Settings | AMI: 22506
export const revalidate = 30

interface ConfigSection {
  title: string
  icon: string
  fields: Array<{
    key: string
    value: string | number | boolean
    sensitive?: boolean
    note?: string
  }>
}

function buildConfig(): ConfigSection[] {
  const env = (k: string, fallback = '—') => {
    const v = process.env[k]
    if (!v) return fallback
    return v
  }
  const envSet = (k: string) => !!process.env[k]
  const envMask = (k: string) => envSet(k) ? '●●●●●●●●' : '— not set'

  return [
    {
      title: 'Queue',
      icon: '⏳',
      fields: [
        { key: 'QUEUE_PROVIDER', value: env('QUEUE_PROVIDER', 'db (default)'), note: 'db | redis | kafka' },
        { key: 'REDIS_URL', value: envMask('REDIS_URL'), sensitive: true },
        { key: 'KAFKA_BROKERS', value: envMask('KAFKA_BROKERS'), sensitive: true },
        { key: 'MAX_RETRIES', value: env('MAX_RETRIES', '3') },
      ],
    },
    {
      title: 'Temporal',
      icon: '🔗',
      fields: [
        { key: 'TEMPORAL_ADDRESS', value: env('TEMPORAL_ADDRESS', '— using DB engine'), note: 'Set to use Temporal Cloud' },
        { key: 'TEMPORAL_NAMESPACE', value: env('TEMPORAL_NAMESPACE', 'default') },
      ],
    },
    {
      title: 'Database',
      icon: '🗄',
      fields: [
        { key: 'SUPABASE_URL', value: envSet('NEXT_PUBLIC_SUPABASE_URL') ? env('NEXT_PUBLIC_SUPABASE_URL').replace(/https?:\/\//, '').slice(0, 40) + '…' : '— not set' },
        { key: 'SUPABASE_ANON_KEY', value: envMask('NEXT_PUBLIC_SUPABASE_ANON_KEY'), sensitive: true },
        { key: 'SUPABASE_SERVICE_KEY', value: envMask('SUPABASE_SERVICE_ROLE_KEY'), sensitive: true },
      ],
    },
    {
      title: 'Observability',
      icon: '📡',
      fields: [
        { key: 'OTEL_EXPORTER_OTLP_ENDPOINT', value: env('OTEL_EXPORTER_OTLP_ENDPOINT', '— not set'), note: 'OpenTelemetry collector' },
        { key: 'OTEL_SERVICE_NAME', value: env('OTEL_SERVICE_NAME', 'sh-ros') },
        { key: 'OTEL_SDK_DISABLED', value: env('OTEL_SDK_DISABLED', 'false') },
      ],
    },
    {
      title: 'Auth & Security',
      icon: '🔐',
      fields: [
        { key: 'INTERNAL_API_TOKEN', value: envMask('INTERNAL_API_TOKEN'), sensitive: true },
        { key: 'CRON_SECRET', value: envMask('CRON_SECRET'), sensitive: true },
        { key: 'AUTH_SECRET', value: envMask('AUTH_SECRET'), sensitive: true },
        { key: 'NODE_ENV', value: process.env.NODE_ENV ?? 'development' },
      ],
    },
    {
      title: 'AI / LLM',
      icon: '🧠',
      fields: [
        { key: 'ANTHROPIC_API_KEY', value: envMask('ANTHROPIC_API_KEY'), sensitive: true },
        { key: 'OPENAI_API_KEY', value: envMask('OPENAI_API_KEY'), sensitive: true },
        { key: 'OPENAI_EMBEDDING_MODEL', value: env('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small') },
      ],
    },
    {
      title: 'Runtime',
      icon: '⚙',
      fields: [
        { key: 'INTERNAL_API_BASE', value: env('INTERNAL_API_BASE', 'http://localhost:3000') },
        { key: 'VERCEL_URL', value: env('VERCEL_URL', '— not set') },
        { key: 'VERCEL_ENV', value: env('VERCEL_ENV', '— not set') },
      ],
    },
  ]
}

export default function SettingsPage() {
  const sections = buildConfig()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">System Configuration</h1>
        <p className="text-xs text-slate-500 font-mono mt-0.5">
          Read-only view of active environment configuration · AMI: 22506
        </p>
      </div>

      <div className="bg-[#111118] border border-amber-900/30 rounded-lg p-3 flex items-center gap-2">
        <span className="text-amber-400 text-sm">⚠</span>
        <p className="text-xs text-amber-400/80">Sensitive values are masked. Changes require redeployment via Vercel environment variables.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="bg-[#111118] border border-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{section.icon}</span>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest">{section.title}</p>
            </div>
            <div className="space-y-2">
              {section.fields.map(({ key, value, sensitive, note }) => (
                <div key={key} className="border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">{key}</span>
                    <span className={`text-[11px] font-mono text-right break-all ${
                      sensitive ? 'text-slate-600' : 'text-slate-200'
                    }`}>
                      {String(value)}
                    </span>
                  </div>
                  {note && (
                    <p className="text-[10px] text-slate-700 mt-0.5">{note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Architecture snapshot */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
        <p className="text-xs text-slate-400 font-medium mb-3">SH-ROS Architecture Snapshot</p>
        <div className="grid grid-cols-3 gap-4 text-xs">
          {[
            { label: 'Version', value: 'Ω∞ vFINAL' },
            { label: 'AMI', value: '22506' },
            { label: 'Stack', value: 'Next.js 15 + Supabase + n8n' },
            { label: 'Queue', value: process.env.QUEUE_PROVIDER ?? 'db (fallback)' },
            { label: 'Workflow Engine', value: process.env.TEMPORAL_ADDRESS ? 'Temporal.io' : 'DB-backed' },
            { label: 'Memory', value: 'HOT (LRU) → WARM (90d) → COLD (∞)' },
            { label: 'Observability', value: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? 'OpenTelemetry (wired)' : 'Console (local)' },
            { label: 'Compliance', value: 'GDPR Art.17+20 · Legal Hold · SHA-256 Audit' },
            { label: 'Agents', value: '16 autonomous agents' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
              <p className="text-xs text-slate-300 font-mono mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
