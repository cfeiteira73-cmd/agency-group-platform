'use client'

type EmptyVariant = 'no-data' | 'error' | 'search-empty' | 'no-deals' | 'no-contacts' | 'no-imoveis' | 'no-signals' | 'loading-failed'

interface EmptyStateProps {
  variant: EmptyVariant
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  darkMode?: boolean
}

const VARIANTS: Record<EmptyVariant, { icon: string; defaultTitle: string; defaultDesc: string; color: string }> = {
  'no-data': {
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    defaultTitle: 'Sem dados',
    defaultDesc: 'Ainda não existem registos aqui.',
    color: '#1c4a35',
  },
  'error': {
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    defaultTitle: 'Erro ao carregar',
    defaultDesc: 'Não foi possível carregar os dados. Tenta novamente.',
    color: '#991b1b',
  },
  'search-empty': {
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    defaultTitle: 'Sem resultados',
    defaultDesc: 'Nenhum resultado encontrado para a tua pesquisa.',
    color: '#1c4a35',
  },
  'no-deals': {
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    defaultTitle: 'Pipeline vazio',
    defaultDesc: 'Cria o teu primeiro deal e começa a acompanhar o progresso.',
    color: '#c9a96e',
  },
  'no-contacts': {
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    defaultTitle: 'Sem contactos',
    defaultDesc: 'Adiciona o teu primeiro cliente ao CRM.',
    color: '#c9a96e',
  },
  'no-imoveis': {
    icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
    defaultTitle: 'Sem imóveis',
    defaultDesc: 'Adiciona o teu primeiro imóvel ao portfólio.',
    color: '#1c4a35',
  },
  'no-signals': {
    icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
    defaultTitle: 'Sem sinais detectados',
    defaultDesc: 'O radar está activo. Os sinais off-market aparecerão aqui.',
    color: '#1c4a35',
  },
  'loading-failed': {
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    defaultTitle: 'Falha na ligação',
    defaultDesc: 'Não foi possível ligar ao servidor. Verifica a ligação.',
    color: '#92400e',
  },
}

export default function PortalEmptyState({
  variant,
  title,
  description,
  action,
  darkMode,
}: EmptyStateProps) {
  const v = VARIANTS[variant]
  const textPrimary = darkMode ? 'rgba(240,237,228,.88)' : '#0e0e0d'
  const textMuted = darkMode ? 'rgba(240,237,228,.45)' : 'rgba(14,14,13,.45)'
  const iconBg = darkMode ? 'rgba(240,237,228,.04)' : 'rgba(14,14,13,.04)'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      minHeight: 200,
    }}>
      {/* Icon circle */}
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke={v.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={v.icon} />
        </svg>
      </div>

      {/* Title */}
      <div style={{
        fontFamily: 'var(--font-cormorant), serif',
        fontSize: '1.3rem',
        fontWeight: 300,
        color: textPrimary,
        marginBottom: 6,
        letterSpacing: '-.01em',
      }}>
        {title ?? v.defaultTitle}
      </div>

      {/* Description */}
      <div style={{
        fontFamily: 'var(--font-jost), sans-serif',
        fontSize: '.78rem',
        color: textMuted,
        maxWidth: 280,
        lineHeight: 1.6,
        marginBottom: action ? 20 : 0,
      }}>
        {description ?? v.defaultDesc}
      </div>

      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          className="p-btn"
          style={{ marginTop: 4 }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// Named export for convenience
export { PortalEmptyState }
