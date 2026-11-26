import { musicFileIds } from './musicFileIds'
import type { MusicItemConfig, ScheduleMusicSummary } from './types'
import { getFolderById } from '../music'

/** What a music item plays, as the presentation's list shows it. */
export function musicSummary(config: MusicItemConfig): ScheduleMusicSummary {
  return {
    folderName:
      config.source === 'folder'
        ? (getFolderById(config.folderId)?.name ?? null)
        : null,
    trackCount: musicFileIds(config).length,
  }
}
