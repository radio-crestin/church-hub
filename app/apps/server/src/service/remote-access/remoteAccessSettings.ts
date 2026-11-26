import { getSetting, upsertSetting } from '../settings'
import { hostedRoomId, hostKeyFor, renewHostKey } from '../signaling/hostedRoom'

const ENABLED_KEY = 'remote_access_enabled'
const HOST_KEY_NAME = 'remote_access_host_key'

export interface RemoteAccessSettings {
  enabled: boolean
  /** The signaling room phones look for this computer in (in their QR code). */
  secret: string
  /** What this computer hosts that room with; never leaves the computer. */
  hostKey: string
}

export function getRemoteAccessSettings(): RemoteAccessSettings {
  const hostKey = hostKeyFor(HOST_KEY_NAME)
  return {
    enabled: getSetting('app_settings', ENABLED_KEY)?.value === 'true',
    secret: hostedRoomId(hostKey),
    hostKey,
  }
}

export function setRemoteAccessEnabled(enabled: boolean) {
  upsertSetting('app_settings', { key: ENABLED_KEY, value: String(enabled) })
}

/** A new room: phones paired before must scan the code again. */
export function resetRemoteAccessSecret() {
  renewHostKey(HOST_KEY_NAME)
}
