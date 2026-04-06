export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return `server-${Date.now()}`

  let sessionId = sessionStorage.getItem('ag_sofia_session')
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem('ag_sofia_session', sessionId)
  }
  return sessionId
}
