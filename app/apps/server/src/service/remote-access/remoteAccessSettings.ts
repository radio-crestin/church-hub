import { randomBytes } from 'node:crypto'

import { getSetting, upsertSetting } from '../settings'

const ENABLED_KEY = 'remote_access_enabled'
const SECRET_KEY = 'remote_access_secret'

export interface RemoteAccessSettings {
  enabled: boolean
  /** The signaling room phones look for this computer in (in their QR code). */
  secret: string
}

const newSecret = () => randomBytes(24).toString('base64url')

export function getRemoteAccessSettings(): RemoteAccessSettings {
  let secret = getSetting('app_settings', SECRET_KEY)?.value
  if (!secret) {
    secret = newSecret()
    upsertSetting('app_settings', { key: SECRET_KEY, value: secret })
  }
  return {
    enabled: getSetting('app_settings', ENABLED_KEY)?.value === 'true',
    secret,
  }
}

export function setRemoteAccessEnabled(enabled: boolean) {
  upsertSetting('app_settings', { key: ENABLED_KEY, value: String(enabled) })
}

/** A new room: phones paired before must scan the code again. */
export function resetRemoteAccessSecret() {
  upsertSetting('app_settings', { key: SECRET_KEY, value: newSecret() })
}
