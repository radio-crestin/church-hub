import { parseHttpOrigin } from './parseHttpOrigin'
import { getSetting } from '../../service/settings'

/** App setting: more origins to trust, separated by commas or whitespace. */
export const TRUSTED_ORIGINS_SETTING_KEY = 'trusted_origins'

/**
 * Origins a deployment trusts on top of the app's own, for a page served
 * elsewhere that calls this server (e.g. behind a reverse proxy under
 * another name). Empty unless the `trusted_origins` app setting is set.
 */
export function getExtraTrustedOrigins(): string[] {
  const value = getSetting('app_settings', TRUSTED_ORIGINS_SETTING_KEY)?.value
  if (!value) return []
  return value
    .split(/[\s,]+/)
    .map(parseHttpOrigin)
    .filter((origin): origin is string => origin !== null)
}
