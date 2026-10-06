import { readChangedSongs } from './changedSongsStore'
import { readLackingSongs } from './lackingSongsStore'
import type { SongRef, SongSet, SourceSongChanges } from './types'
import {
  deleteNotificationsOfKind,
  upsertNotification,
} from '../../notifications'
import { listSongSources } from '../listSongSources'

/** A notification names this many songs per source and kind, then counts. */
const MAX_NAMED = 100

export function toSongSet(songs: SongRef[]): SongSet {
  return { count: songs.length, songs: songs.slice(0, MAX_NAMED) }
}

const hasChanges = (s: SourceSongChanges) =>
  s.added.count > 0 || s.updated.count > 0

/**
 * "The sync added and updated these songs", when it changed any. A run
 * records it after each source under one id, so a cancelled run's
 * notification still tells what it did.
 */
export function recordSyncedNotification(
  id: string,
  changes: SourceSongChanges[],
): void {
  const sources = changes.filter(hasChanges)
  if (sources.length === 0) return
  upsertNotification({ id, kind: 'songs-synced', data: { sources } })
}

/** Each source's songs waiting for the user's approval. */
function pendingChanges(): SourceSongChanges[] {
  return listSongSources().map((source) => ({
    sourceId: source.id,
    name: source.name,
    added: toSongSet(
      readLackingSongs(source.id)
        .filter((song) => song.verdict === 'new')
        .map((song) => ({ title: song.parsed.title })),
    ),
    updated: toSongSet(
      readChangedSongs(source.id).map(({ songId, song }) => ({
        id: songId,
        title: song.parsed.title,
      })),
    ),
  }))
}

/**
 * The one "songs waiting for your approval" notification, matching what
 * waits now: a new one when more songs wait, none when nothing does.
 */
export function refreshPendingNotification(): void {
  const sources = pendingChanges().filter(hasChanges)
  if (sources.length === 0) {
    deleteNotificationsOfKind('songs-pending')
    return
  }
  const id = `songs-pending:${Bun.hash(JSON.stringify(sources)).toString(36)}`
  upsertNotification({ id, kind: 'songs-pending', data: { sources } })
  deleteNotificationsOfKind('songs-pending', id)
}
