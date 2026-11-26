import { requireSameDestination } from './requireSameDestination'
import { sealSecret } from './sealSecret'
import { isSecretMask } from './secretMask'
import {
  parseSettingObject,
  SECRET_SETTINGS,
  settingPlace,
} from './secretSettingFields'

/**
 * A settings value ready to store: its secret fields sealed. A field sent
 * back as the mask keeps the secret stored before (`stored`, as it is in
 * the database), but only while the setting's destination fields are
 * unchanged: otherwise it throws SecretDestinationChangedError, and the key
 * must be entered again for the new address.
 */
export function sealSettingValue(
  key: string,
  value: string,
  stored: string | null,
): string {
  const setting = SECRET_SETTINGS[key]
  const next = setting && parseSettingObject(value)
  if (!setting || !next) return value
  const previous = (stored && parseSettingObject(stored)) || {}
  for (const field of setting.secrets) {
    const secret = next[field]
    if (isSecretMask(secret)) {
      const kept = previous[field] ?? ''
      if (kept !== '')
        requireSameDestination(previous, next, setting.destination)
      next[field] = kept
    } else if (typeof secret === 'string') {
      next[field] = sealSecret(secret, settingPlace(key, field))
    }
  }
  return JSON.stringify(next)
}
