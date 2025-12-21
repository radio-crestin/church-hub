/**
 * Temporary storage for PKCE code_verifier during OAuth flow.
 * Used when the OAuth callback can't communicate with the original window
 * (e.g., when auth is initiated from Tauri and opens in external browser).
 */

interface PKCESession {
  codeVerifier: string
  codeChallenge: string
  createdAt: number
}

// In-memory store for PKCE sessions (expires after 10 minutes)
const sessions = new Map<string, PKCESession>()
const SESSION_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Generates a unique session ID
 */
function generateSessionId(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Stores a PKCE session and returns the session ID
 */
export function storePKCESession(
  codeVerifier: string,
  codeChallenge: string,
): string {
  // Clean up expired sessions
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }

  const sessionId = generateSessionId()
  sessions.set(sessionId, {
    codeVerifier,
    codeChallenge,
    createdAt: now,
  })

  return sessionId
}

/**
 * Retrieves and removes a PKCE session by ID
 */
export function consumePKCESession(sessionId: string): PKCESession | null {
  const session = sessions.get(sessionId)
  if (!session) {
    return null
  }

  // Check if expired
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId)
    return null
  }

  // Remove the session (one-time use)
  sessions.delete(sessionId)
  return session
}
