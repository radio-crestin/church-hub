import { SCREEN_LINKS_KEY } from './constants'
import type { ScreenLink } from './types'
import { getSetting, upsertSetting } from '../settings'

/**
 * The church's screen links that still stand, from their synced setting:
 * the PC learns the ones a phone made while it was off, and their removal.
 */
export function readScreenLinks(now = Date.now()): ScreenLink[] {
  const value = getSetting('app_settings', SCREEN_LINKS_KEY)?.value
  if (!value) return []
  const links = JSON.parse(value) as ScreenLink[]
  return links.filter((link) => link.expiresAt > now)
}

/** Keeps `links` (expired ones dropped on the way). */
export function writeScreenLinks(links: ScreenLink[]): void {
  const now = Date.now()
  const result = upsertSetting('app_settings', {
    key: SCREEN_LINKS_KEY,
    value: JSON.stringify(links.filter((link) => link.expiresAt > now)),
  })
  if (!result.success) {
    throw new Error(`Screen links not saved: ${result.error}`)
  }
}
