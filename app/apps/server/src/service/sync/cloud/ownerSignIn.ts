import { randomBytes } from 'node:crypto'

import { claimCloudChurch } from './claimCloudChurch'
import { getCloudIdentity } from './cloudIdentityStore'
import { connectCloudSync } from './connectCloudSync'
import { getSyncServiceUrl } from './getSyncServiceUrl'
import { readTicketEmail, setOwnerSession } from './ownerSession'
import { getServerPort } from '../../../utils/serverPort'

/**
 * Why the owner signs in: turn cloud sync on as the owner, claim this guest
 * church, manage (recover, revoke all, transfer) their churches, or curate
 * the Church Hub Library (T-177).
 */
export type OwnerSignInIntent = 'connect' | 'claim' | 'manage' | 'curate'

const CALLBACK_PATH = '/api/sync/cloud/owner/callback'
/** A sign-in left unfinished this long is forgotten. */
const PENDING_MAX_AGE_MS = 10 * 60 * 1000

interface PendingSignIn {
  intent: OwnerSignInIntent
  serviceUrl: string
  createdAt: number
}

/** Sign-ins this PC started, by nonce: only these are accepted back. */
const pending = new Map<string, PendingSignIn>()

/**
 * Starts the owner's Google sign-in through the sync service: a nonce only
 * this PC knows rides along and must come back, so a ticket arriving at the
 * local callback from a sign-in someone else started is refused.
 */
export async function startOwnerSignIn(
  intent: OwnerSignInIntent,
  serviceUrl?: string,
): Promise<{ authUrl: string }> {
  const identity = await getCloudIdentity()
  const base = identity?.serviceUrl ?? serviceUrl ?? getSyncServiceUrl()
  const nonce = randomBytes(24).toString('base64url')
  const now = Date.now()
  for (const [key, entry] of pending) {
    if (now - entry.createdAt > PENDING_MAX_AGE_MS) pending.delete(key)
  }
  pending.set(nonce, { intent, serviceUrl: base, createdAt: now })

  const url = new URL('/sync/owner/sign-in', base)
  url.searchParams.set(
    'returnUrl',
    `http://localhost:${getServerPort()}${CALLBACK_PATH}`,
  )
  url.searchParams.set('nonce', nonce)
  return { authUrl: url.toString() }
}

/**
 * The sign-in's return to this PC: checks the nonce, keeps the owner's
 * session and does what the sign-in was for. Returns the account, or
 * throws the reason it was refused.
 */
export async function completeOwnerSignIn(query: {
  nonce: string | null
  ticket: string | null
  expiresAt: string | null
  error: string | null
}): Promise<{ email: string; intent: OwnerSignInIntent }> {
  const entry = query.nonce ? pending.get(query.nonce) : undefined
  if (!entry || Date.now() - entry.createdAt > PENDING_MAX_AGE_MS) {
    throw new Error('unknown_sign_in')
  }
  pending.delete(query.nonce as string)
  if (query.error) throw new Error(query.error)
  const ticket = query.ticket ?? ''
  const email = readTicketEmail(ticket)
  const expiresAt = Number(query.expiresAt)
  if (!email || !Number.isFinite(expiresAt)) throw new Error('invalid_ticket')

  setOwnerSession({ ticket, email, expiresAt })
  if (entry.intent === 'connect') {
    await connectCloudSync(entry.serviceUrl, ticket)
  } else if (entry.intent === 'claim') {
    await claimCloudChurch(ticket)
  }
  return { email, intent: entry.intent }
}
