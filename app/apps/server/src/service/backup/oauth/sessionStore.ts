/**
 * In-memory store mapping an OAuth `state` to its PKCE `code_verifier` during
 * the (short-lived) Drive connect flow. The verifier never leaves the server;
 * only the state travels through the browser. One-time use, 10-minute TTL.
 */
interface StateSession {
  codeVerifier: string
  createdAt: number
}

const sessions = new Map<string, StateSession>()
const SESSION_TTL_MS = 10 * 60 * 1000

export function storeState(state: string, codeVerifier: string): void {
  const now = Date.now()
  for (const [key, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(key)
    }
  }
  sessions.set(state, { codeVerifier, createdAt: now })
}

/** Retrieves and removes the verifier for a state (one-time use). */
export function consumeState(state: string): string | null {
  const session = sessions.get(state)
  if (!session) return null
  sessions.delete(state)
  if (Date.now() - session.createdAt > SESSION_TTL_MS) return null
  return session.codeVerifier
}
