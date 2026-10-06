import { isSongUpdatesRunning } from './songUpdatesRunner'
import {
  getAutoUpdateSongs,
  getStoredSourceUpdates,
} from './sourceUpdatesStore'
import type { SongUpdatesState } from './types'
import { listSongSources } from '../listSongSources'

/** The song updates as the app shows them: each current source's last check. */
export function getSongUpdatesState(): SongUpdatesState {
  const stored = new Map(getStoredSourceUpdates().map((u) => [u.sourceId, u]))
  const sources = listSongSources().flatMap((source) => {
    const update = stored.get(source.id)
    return update ? [{ ...update, name: source.name }] : []
  })
  const checkedAt = sources.map((u) => u.checkedAt).filter((t) => t > 0)
  return {
    running: isSongUpdatesRunning(),
    autoUpdate: getAutoUpdateSongs(),
    finishedAt: checkedAt.length > 0 ? Math.max(...checkedAt) : null,
    sources,
  }
}
