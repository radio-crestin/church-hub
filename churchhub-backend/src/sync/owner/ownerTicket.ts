import { hashToken } from '../hashToken'
import { SyncError } from '../SyncError'
import { fromBase64url, toBase64url } from './base64url'
import { constantTimeEqual } from '../../utils/constantTimeEqual'
import type { OwnerIdentity } from './OwnerIdentity'

/** How long a sign-in lets the owner act (recover, reset, transfer). */
export const OWNER_TICKET_TTL_SECONDS = 60 * 60

const PREFIX = 'cho_'

interface TicketPayload {
  sub: string
  email: string
  /** Unix seconds it expires at. */
  exp: number
}

function sign(payload: string, secret: string): Promise<string> {
  return hashToken(`owner-ticket:${payload}`, secret)
}

/**
 * What the service hands the PC after a Google sign-in: the account's
 * verified id and email, signed with SYNC_SECRET, valid for an hour. The
 * service keeps no session: the ticket is the proof.
 */
export async function createOwnerTicket(
  owner: OwnerIdentity,
  secret: string,
  now = Math.floor(Date.now() / 1000)
): Promise<{ ticket: string; expiresAt: number }> {
  const exp = now + OWNER_TICKET_TTL_SECONDS
  const payload = toBase64url(
    JSON.stringify({ sub: owner.googleSub, email: owner.email, exp })
  )
  return {
    ticket: `${PREFIX}${payload}.${await sign(payload, secret)}`,
    expiresAt: exp,
  }
}

/** The account behind a ticket; 401 when it is forged or expired. */
export async function verifyOwnerTicket(
  ticket: string | undefined | null,
  secret: string
): Promise<OwnerIdentity> {
  const refused = new SyncError(
    401,
    'owner_unauthorized',
    'Sign in with Google again'
  )
  const match = ticket?.match(/^cho_([A-Za-z0-9_-]+)\.([0-9a-f]{64})$/)
  if (!match) throw refused
  const [, payload, signature] = match
  if (!constantTimeEqual(signature, await sign(payload, secret))) throw refused
  const data = JSON.parse(fromBase64url(payload)) as TicketPayload
  if (data.exp < Math.floor(Date.now() / 1000)) throw refused
  return { googleSub: data.sub, email: data.email }
}

/** The ticket of an `Authorization: Bearer cho_…` header. */
export function ticketFromHeader(header: string | undefined): string | null {
  return header?.match(/^Bearer\s+(cho_\S+)$/i)?.[1] ?? null
}
