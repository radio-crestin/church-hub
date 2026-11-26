import { isServerSecretKey } from './isServerSecretKey'
import { SECRET_SETTINGS } from '../secret-store'

/**
 * Whether a settings row holds a secret: a server secret key, or a row with
 * secret fields (secret-store/secretSettingFields). Such a row never leaves
 * this computer: anything that copies settings elsewhere (cloud sync's
 * allow-list) refuses it, whatever else it holds.
 */
export const isSecretSettingKey = (key: string) =>
  isServerSecretKey(key) || Object.hasOwn(SECRET_SETTINGS, key)
