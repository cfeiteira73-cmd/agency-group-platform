export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID()

  let sessionId = sessionStorage.getItem('ag_sofia_session')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem('ag_sofia_session', sessionId)
  }
  return sessionId
}
