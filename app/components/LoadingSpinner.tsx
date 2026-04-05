interface LoadingSpinnerProps {
  size?: number
  color?: string
  label?: string
}

export function LoadingSpinner({ size = 32, color = '#c9a96e', label }: LoadingSpinnerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div
        role="status"
        aria-label={label ?? 'A carregar...'}
        style={{
          width: size, height: size,
          border: `2px solid ${color}33`,
          borderTop: `2px solid ${color}`,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}
      />
      {label && <span style={{ color: '#9ca3af', fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>{label}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
