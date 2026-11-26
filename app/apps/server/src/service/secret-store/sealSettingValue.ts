import { sealSecret } from './sealSecret'
import { isSecretMask } from './secretMask'
import {
  parseSettingObject,
  SECRET_SETTING_FIELDS,
  settingPlace,
} from './secretSettingFields'

/**
 * A settings value ready to store: its secret fields sealed. A field sent
 * back as the mask keeps the secret stored before (`stored`, as it is in
 * the database).
 */
export function sealSettingValue(
  key: string,
  value: string,
  stored: string | null,
): string {
  const fields = SECRET_SETTING_FIELDS[key]
  const next = fields && parseSettingObject(value)
  if (!fields || !next) return value
  const previous = (stored && parseSettingObject(stored)) || {}
  for (const field of fields) {
    const secret = next[field]
    if (isSecretMask(secret)) next[field] = previous[field] ?? ''
    else if (typeof secret === 'string') {
      next[field] = sealSecret(secret, settingPlace(key, field))
    }
  }
  return JSON.stringify(next)
}
