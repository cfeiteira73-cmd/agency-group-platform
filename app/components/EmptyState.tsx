interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon = '📋', title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '64px 24px', gap: '16px', textAlign: 'center'
    }}>
      <span style={{ fontSize: '48px', opacity: 0.5 }}>{icon}</span>
      <h3 style={{ color: '#f5f0e8', fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', margin: 0 }}>{title}</h3>
      {description && <p style={{ color: '#9ca3af', fontFamily: 'DM Mono, monospace', fontSize: '13px', maxWidth: '360px' }}>{description}</p>}
      {action && (
        <button onClick={action.onClick} style={{
          background: '#c9a96e', color: '#0c1f15', border: 'none',
          padding: '10px 24px', fontFamily: 'DM Mono, monospace', fontSize: '12px',
          letterSpacing: '1px', cursor: 'pointer', marginTop: '8px'
        }}>
          {action.label}
        </button>
      )}
    </div>
  )
}
