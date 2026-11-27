import { isServerSecretKey } from './isServerSecretKey'

/**
 * Settings rows the server keeps for itself: they sync with the church like
 * any church-wide setting, but nobody sets them by hand. The church's
 * screen links (T-214): only their hashes, managed by /api/screen-links.
 */
const SERVER_STATE_KEYS = new Set(['screen_links'])

/**
 * Whether the settings API leaves a key alone (never reads, lists, writes
 * or deletes it): a server secret (isServerSecretKey), or state the server
 * keeps itself.
 */
export const isServerOwnedSettingKey = (key: string) =>
  isServerSecretKey(key) || SERVER_STATE_KEYS.has(key)
