import { redactSecrets } from './redact-secrets'
import { SAFE_SETTING_KEYS } from './safe-setting-keys'
import { SECRET_NAME, SECRET_VALUE } from './secret-patterns'

/**
 * Makes an app setting safe to ship as a fixture.
 *
 * Returns null when the setting must stay out: it is not on the allow-list,
 * its name looks secret, or its plain value is shaped like a key. Otherwise
 * returns the value with secret fields set to null.
 */
export function sanitizeSettingValue(
  settingKey: string,
  value: string,
): string | null {
  if (!SAFE_SETTING_KEYS.has(settingKey)) return null
  if (SECRET_NAME.test(settingKey)) return null

  const parsed = parseJson(value)
  if (parsed === undefined) return SECRET_VALUE.test(value) ? null : value

  const redacted = redactSecrets(parsed)
  const changed = JSON.stringify(redacted) !== JSON.stringify(parsed)
  return changed ? JSON.stringify(redacted) : value
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}
