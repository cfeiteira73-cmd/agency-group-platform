export default function PortalLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0c1f15',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        width: '48px', height: '48px',
        border: '3px solid #1e3a28',
        borderTop: '3px solid #c9a96e',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{ color: '#c9a96e', fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', letterSpacing: '2px' }}>
        A carregar portal...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
