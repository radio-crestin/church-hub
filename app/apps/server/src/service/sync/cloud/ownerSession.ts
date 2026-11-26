/**
 * The owner signed in on this PC (T-172): the service's one-hour ticket and
 * the account it names. In memory only: it is never saved or backed up, so
 * a backup file can't act as the owner.
 */
export interface OwnerSession {
  ticket: string
  email: string
  /** Unix seconds. */
  expiresAt: number
}

let session: OwnerSession | null = null

/** The signed-in owner, or null once the ticket has expired. */
export function getOwnerSession(): OwnerSession | null {
  if (session && session.expiresAt <= Math.floor(Date.now() / 1000)) {
    session = null
  }
  return session
}

export function setOwnerSession(next: OwnerSession | null): void {
  session = next
}

/** The signed-in owner, or the error the routes answer 401 with. */
export function requireOwnerSession(): OwnerSession {
  const current = getOwnerSession()
  if (!current) throw new Error('owner_sign_in_required')
  return current
}

/** The account a ticket names (its payload; the service checks the signature). */
export function readTicketEmail(ticket: string): string | null {
  const payload = ticket.match(/^cho_([A-Za-z0-9_-]+)\./)?.[1]
  if (!payload) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof data.email === 'string' ? data.email : null
  } catch {
    return null
  }
}
