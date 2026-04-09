export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f0e6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        width: '40px', height: '40px',
        border: '2px solid rgba(201,169,110,0.2)',
        borderTop: '2px solid #c9a96e',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{ color: '#c9a96e', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', letterSpacing: '3px', opacity: 0.8 }}>
        AGENCY GROUP
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
