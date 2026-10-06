import type { SourceUpdate } from './types'
import { getSetting, upsertSetting } from '../../settings'

const UPDATES_KEY = 'song_sources_updates'
const AUTO_UPDATE_KEY = 'song_sources_auto_update'

/** Each source's last check, kept across restarts (its checksum skips work). */
export function getStoredSourceUpdates(): SourceUpdate[] {
  const raw = getSetting('app_settings', UPDATES_KEY)?.value
  return raw ? (JSON.parse(raw) as SourceUpdate[]) : []
}

export function saveSourceUpdates(updates: SourceUpdate[]): void {
  upsertSetting('app_settings', {
    key: UPDATES_KEY,
    value: JSON.stringify(updates),
  })
}

/** Update songs automatically; on unless the user turned it off. */
export function getAutoUpdateSongs(): boolean {
  return getSetting('app_settings', AUTO_UPDATE_KEY)?.value !== 'false'
}

export function setAutoUpdateSongs(enabled: boolean): void {
  upsertSetting('app_settings', {
    key: AUTO_UPDATE_KEY,
    value: String(enabled),
  })
}
