import { getSetting, upsertSetting } from '../settings/settings'

/**
 * Keys for persisted resizable-divider positions.
 *
 * All keys live under the `divider.` namespace so the server treats them as
 * personal layout preferences that any authenticated user can read/write,
 * rather than gating them behind `settings.edit` (see the settings routes in
 * apps/server/src/index.ts).
 */
export const DIVIDER_KEYS = {
  songsList: 'divider.songs_list',
  songDetailLeft: 'divider.song_detail_left',
  songDetailRight: 'divider.song_detail_right',
  bibleLeft: 'divider.bible_left',
  bibleRight: 'divider.bible_right',
  music: 'divider.music',
  scheduleList: 'divider.schedule_list',
} as const

/**
 * Reads a divider position (a percentage) from the database.
 * Returns `fallback` when the setting is missing or not a finite number.
 */
export async function getDividerPosition(
  key: string,
  fallback: number,
): Promise<number> {
  const setting = await getSetting('app_settings', key)
  if (!setting) return fallback
  const parsed = Number(setting.value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Persists a divider position (a percentage) to the database.
 */
export async function saveDividerPosition(
  key: string,
  value: number,
): Promise<boolean> {
  return upsertSetting('app_settings', { key, value: String(value) })
}
