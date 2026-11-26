import { SECRET_MASK } from './secretMask'
import { parseSettingObject, SECRET_SETTINGS } from './secretSettingFields'

/**
 * An opened settings value as the settings API returns it: each saved
 * secret replaced by the mask, so it never leaves the server. A value of a
 * secret row that isn't a JSON object can't be checked and isn't returned.
 */
export function maskSettingValue(key: string, value: string): string {
  const fields = SECRET_SETTINGS[key]?.secrets
  if (!fields) return value
  const masked = parseSettingObject(value)
  if (!masked) return ''
  for (const field of fields) {
    if (typeof masked[field] === 'string' && masked[field] !== '') {
      masked[field] = SECRET_MASK
    }
  }
  return JSON.stringify(masked)
}
