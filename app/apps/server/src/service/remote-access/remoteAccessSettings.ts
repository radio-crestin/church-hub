import { getSetting, upsertSetting } from '../settings'
import { hostedRoomId, newHostKey } from '../signaling/hostedRoom'

const ENABLED_KEY = 'remote_access_enabled'
const HOST_KEY = 'remote_access_host_key'

export interface RemoteAccessSettings {
  enabled: boolean
  /** The signaling room phones look for this computer in (in their QR code). */
  secret: string
  /** What this computer hosts that room with; never leaves the computer. */
  hostKey: string
}

export function getRemoteAccessSettings(): RemoteAccessSettings {
  let hostKey = getSetting('app_settings', HOST_KEY)?.value
  if (!hostKey) {
    hostKey = newHostKey()
    upsertSetting('app_settings', { key: HOST_KEY, value: hostKey })
  }
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
  upsertSetting('app_settings', { key: HOST_KEY, value: newHostKey() })
}
