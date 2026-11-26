import { createHash, randomBytes } from 'node:crypto'

import { CloudBackupError } from './CloudBackupError'
import { cloudBackupFetch } from './cloudBackupFetch'
import { keepServiceSession, type ServiceSession } from './cloudBackupSession'
import { getCloudBackupUrl, isCloudBackupAvailable } from './getCloudBackupUrl'
import { getServerPort } from '../../../utils/serverPort'

const CALLBACK_PATH = '/api/backup/cloud/callback'
/** A sign-in left unfinished this long is forgotten. */
const PENDING_MAX_AGE_MS = 10 * 60 * 1000

interface PendingSignIn {
  verifier: string
  serviceUrl: string
  createdAt: number
}

/** Sign-ins this PC started, by nonce: only these are accepted back. */
const pending = new Map<string, PendingSignIn>()

/**
 * Starts the Google sign-in through the backup service. The nonce lets
 * this PC accept only its own sign-in back; the verifier, whose hash rides
 * along, never leaves this server, so the grant the browser carries back
 * is useless to anyone else.
 */
export function startCloudBackupSignIn(): { authUrl: string } {
  if (!isCloudBackupAvailable())
    throw new CloudBackupError('not_available', 409)
  const serviceUrl = getCloudBackupUrl()
  const nonce = randomBytes(24).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const now = Date.now()
  for (const [key, entry] of pending) {
    if (now - entry.createdAt > PENDING_MAX_AGE_MS) pending.delete(key)
  }
  pending.set(nonce, { verifier, serviceUrl, createdAt: now })

  const url = new URL('/backup/sign-in', serviceUrl)
  url.searchParams.set(
    'returnUrl',
    `http://localhost:${getServerPort()}${CALLBACK_PATH}`,
  )
  url.searchParams.set('nonce', nonce)
  url.searchParams.set(
    'challenge',
    createHash('sha256').update(verifier).digest('base64url'),
  )
  return { authUrl: url.toString() }
}

/**
 * The sign-in's return: checks the nonce, swaps the grant and the
 * verifier for a session and keeps it. Returns the account's email.
 */
export async function completeCloudBackupSignIn(query: {
  nonce: string | null
  grant: string | null
  error: string | null
}): Promise<string> {
  const entry = query.nonce ? pending.get(query.nonce) : undefined
  if (!entry || Date.now() - entry.createdAt > PENDING_MAX_AGE_MS) {
    throw new CloudBackupError('unknown_sign_in', 400)
  }
  pending.delete(query.nonce as string)
  if (query.error || !query.grant) {
    throw new CloudBackupError(
      /^[a-z_]{1,40}$/.test(query.error ?? '')
        ? (query.error as string)
        : 'sign_in_failed',
      400,
    )
  }
  const session = await cloudBackupFetch<ServiceSession>(
    entry.serviceUrl,
    'POST',
    '/backup/session',
    { body: { grant: query.grant, verifier: entry.verifier } },
  )
  keepServiceSession(entry.serviceUrl, session)
  return session.email
}
