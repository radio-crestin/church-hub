import { openSecret } from './openSecret'
import {
  parseSettingObject,
  SECRET_SETTING_FIELDS,
  settingPlace,
} from './secretSettingFields'

/**
 * A stored settings value with its secret fields opened, for the server's
 * own use. A secret it can't open reads as empty (not set).
 */
export function openSettingValue(key: string, stored: string): string {
  const fields = SECRET_SETTING_FIELDS[key]
  const value = fields && parseSettingObject(stored)
  if (!fields || !value) return stored
  for (const field of fields) {
    const secret = value[field]
    if (typeof secret === 'string') {
      value[field] = openSecret(secret, settingPlace(key, field)) ?? ''
    }
  }
  return JSON.stringify(value)
}
