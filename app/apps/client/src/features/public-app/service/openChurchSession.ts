import { forgetChurchDatabase } from '~/features/browser-server'
import { createLogger } from '~/utils/logger'
import { type ChurchBinding, getChurchBinding } from './churchBinding'
import { DeviceRefusedError } from './fetchReadUrl'
import { joinChurch } from './joinChurch'
import { parseJoinLink } from './parseJoinLink'
import { refreshBinding } from './refreshBinding'

const logger = createLogger('public-app')

export type JoinFailure = 'invalid' | 'refused' | 'offline'

export type ChurchSession =
  | { kind: 'notJoined' }
  | { kind: 'removed' }
  | { kind: 'joinFailed'; reason: JoinFailure }
  | { kind: 'joined'; binding: ChurchBinding }

const BASE = import.meta.env.BASE_URL

/** Drops the link's fragment from the address bar and the history. */
function forgetJoinLink() {
  window.history.replaceState(null, '', BASE)
}

async function openJoinLink(hash: string): Promise<ChurchSession> {
  const link = parseJoinLink(hash)
  if (!link) {
    forgetJoinLink()
    return { kind: 'joinFailed', reason: 'invalid' }
  }
  try {
    const binding = await joinChurch(link)
    forgetJoinLink()
    return { kind: 'joined', binding }
  } catch (error) {
    if (error instanceof DeviceRefusedError) {
      forgetJoinLink()
      return { kind: 'joinFailed', reason: 'refused' }
    }
    // Kept in the address bar, so "Try again" opens it again.
    logger.warn('Could not reach the sync service to join', error)
    return { kind: 'joinFailed', reason: 'offline' }
  }
}

/**
 * The web app's church, as it starts: joining with the link it was opened
 * with, the church this device is bound to, or none (never joined, or
 * removed).
 */
export async function openChurchSession(): Promise<ChurchSession> {
  const { pathname, hash } = window.location
  if (pathname === `${BASE}join` && hash.length > 1) return openJoinLink(hash)
  const saved = getChurchBinding()
  if (!saved) return { kind: 'notJoined' }
  const binding = await refreshBinding(saved)
  if (binding) return { kind: 'joined', binding }
  // Removed by the church: nothing of it stays on this device.
  await forgetChurchDatabase(saved.churchId)
  return { kind: 'removed' }
}
