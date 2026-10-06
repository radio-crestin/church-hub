import type { SourceUpdate } from './types'
import { getSetting, upsertSetting } from '../../settings'

const UPDATES_KEY = 'song_sources_updates'
const AUTO_UPDATE_KEY = 'song_sources_auto_update'

/**
 * A check saved before new and similar songs were counted apart is checked
 * again in full: its checksum is dropped.
 */
function upgrade(update: SourceUpdate): SourceUpdate {
  if (update.similarCount !== undefined) return update
  return {
    ...update,
    checksum: '',
    newCount: 0,
    similarCount: 0,
    changedCount: 0,
    updated: 0,
  }
}

/** Each source's last check, kept across restarts (its checksum skips work). */
export function getStoredSourceUpdates(): SourceUpdate[] {
  const raw = getSetting('app_settings', UPDATES_KEY)?.value
  return raw ? (JSON.parse(raw) as SourceUpdate[]).map(upgrade) : []
}

export function saveSourceUpdates(updates: SourceUpdate[]): void {
  upsertSetting('app_settings', {
    key: UPDATES_KEY,
    value: JSON.stringify(updates),
  })
}

/** Sync without approval; on unless the user turned it off. */
export function getAutoUpdateSongs(): boolean {
  return getSetting('app_settings', AUTO_UPDATE_KEY)?.value !== 'false'
}

export function setAutoUpdateSongs(enabled: boolean): void {
  upsertSetting('app_settings', {
    key: AUTO_UPDATE_KEY,
    value: String(enabled),
  })
}
