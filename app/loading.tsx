// Loading state — transparent/invisible so ZERO green flash on mobile
// The hero section renders immediately from SSR — no spinner needed
export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f0e6',
    }} />
  )
}
