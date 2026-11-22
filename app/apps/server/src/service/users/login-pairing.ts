import { createLogger } from '../../utils/logger'

const logger = createLogger('login-pairing')

/**
 * Pairing codes let a passwordless account sign in from another device on the
 * LAN: the server shows a 6-digit code on this machine's desktop app (only
 * local sockets receive it) and the remote browser must type it back. A code
 * lives 2 minutes, takes 5 guesses, and a new request for the same user
 * replaces the old one.
 */
const PAIRING_TTL_MS = 2 * 60_000
const MAX_ATTEMPTS = 5
const MAX_PAIRINGS_PER_MINUTE = 10

export interface LoginPairing {
  id: string
  userId: number
  userName: string
  code: string
  requesterIp: string
  expiresAt: number
  attempts: number
}

const pairings = new Map<string, LoginPairing>()
let recentCreations: number[] = []

function generateCode(): string {
  const [n] = crypto.getRandomValues(new Uint32Array(1))
  return String(n % 1_000_000).padStart(6, '0')
}

function removeExpired(now: number) {
  for (const [id, pairing] of pairings) {
    if (pairing.expiresAt < now) pairings.delete(id)
  }
}

/**
 * Opens a pairing for a user, replacing any earlier one of theirs. Returns
 * null when too many were opened in the last minute.
 */
export function createLoginPairing(
  userId: number,
  userName: string,
  requesterIp: string,
): LoginPairing | null {
  const now = Date.now()
  removeExpired(now)
  recentCreations = recentCreations.filter((t) => now - t < 60_000)
  if (recentCreations.length >= MAX_PAIRINGS_PER_MINUTE) {
    logger.warning('Pairing refused: too many requests in the last minute')
    return null
  }
  recentCreations.push(now)

  for (const [id, pairing] of pairings) {
    if (pairing.userId === userId) pairings.delete(id)
  }
  const pairing: LoginPairing = {
    id: crypto.randomUUID(),
    userId,
    userName,
    code: generateCode(),
    requesterIp,
    expiresAt: now + PAIRING_TTL_MS,
    attempts: 0,
  }
  pairings.set(pairing.id, pairing)
  logger.info(`Pairing opened for user ${userId} from ${requesterIp}`)
  return pairing
}

/**
 * Checks a code against an open pairing of that user. A right code consumes
 * the pairing; the fifth wrong one closes it. Returns the pairing when the
 * code is right, plus whether it was closed (so the desktop can hide it).
 */
export function verifyLoginPairing(
  pairingId: string,
  userId: number,
  code: string,
): { ok: boolean; closed: LoginPairing | null } {
  const pairing = pairings.get(pairingId)
  if (!pairing || pairing.userId !== userId || pairing.expiresAt < Date.now()) {
    if (pairing) pairings.delete(pairingId)
    return { ok: false, closed: pairing ?? null }
  }
  if (pairing.code === code.trim()) {
    pairings.delete(pairingId)
    return { ok: true, closed: pairing }
  }
  pairing.attempts += 1
  logger.info(`Wrong pairing code for user ${userId} (${pairing.attempts})`)
  if (pairing.attempts >= MAX_ATTEMPTS) {
    pairings.delete(pairingId)
    return { ok: false, closed: pairing }
  }
  return { ok: false, closed: null }
}

/** The open pairings, for a desktop app that connects while one is pending. */
export function getOpenLoginPairings(): LoginPairing[] {
  removeExpired(Date.now())
  return [...pairings.values()]
}
