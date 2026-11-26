import { deleteSetting, getSetting } from '../settings'
import { hostedRoomId, hostKeyFor, renewHostKey } from '../signaling/hostedRoom'

const HOST_KEY_NAME = 'live_translation_host_key'
/**
 * Set by migration 0035 on an install that had shared a listener link of an
 * earlier version: that link stopped, and the dashboard says so once.
 */
const LINK_CHANGED_KEY = 'live_translation_link_changed'

export interface StreamRoom {
  secret: string
  hostKey: string
}

/** The listeners' room: its id is in the listener link (/listen/<id>). */
export function getStreamRoom(): StreamRoom {
  const hostKey = hostKeyFor(HOST_KEY_NAME)
  return { secret: hostedRoomId(hostKey), hostKey }
}

export const getStreamSecret = () => getStreamRoom().secret

/** A new listener link: the one shared before stops working. */
export const renewStreamLink = () => hostedRoomId(renewHostKey(HOST_KEY_NAME))

/** Whether to tell the user their listener link changed with the update. */
export const isLinkChangeUnseen = () =>
  getSetting('app_settings', LINK_CHANGED_KEY)?.value === 'true'

export function dismissLinkChange(): void {
  if (isLinkChangeUnseen()) deleteSetting('app_settings', LINK_CHANGED_KEY)
}
