import {
  type LibrarySongInput,
  upsertLibrarySong,
} from '@church-hub/song-formats'

import { libraryRequest } from './libraryRequest'
import { readCuratedLibrary } from './readCuratedLibrary'
import { CURATED_LIBRARY_INFO } from './types'

/** Another curator publishing at the same moment: build again from theirs. */
const MAX_ATTEMPTS = 4

/**
 * Publishes a song in the curated library, new or (`replace`) as the new
 * version of the song with its id: only its shard is rebuilt here and uploaded, then
 * the manifest, based on the one read. When another curator published
 * first (409 library_changed), it is built again from theirs.
 */
export async function publishCuratedSong(
  ticket: string,
  song: LibrarySongInput,
  replace: boolean,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const { manifest, readShard } = await readCuratedLibrary()
    if (replace && !manifest?.songs.some((entry) => entry.id === song.id)) {
      throw new Error('library_song_not_found')
    }
    const next = await upsertLibrarySong(
      manifest,
      CURATED_LIBRARY_INFO,
      song,
      readShard,
    )
    for (const [path, bytes] of next.shards) {
      const entry = next.manifest.shards.find((shard) => shard.path === path)
      if (entry) {
        await libraryRequest('PUT', `/shards/${entry.hash}`, {
          ticket,
          body: bytes,
        })
      }
    }
    try {
      await libraryRequest('PUT', '/manifest', {
        ticket,
        body: {
          baseChecksum: manifest?.checksum ?? null,
          manifest: next.manifest,
        },
      })
      return
    } catch (error) {
      const changed = String(error).includes('409 library_changed')
      if (!changed || attempt >= MAX_ATTEMPTS) throw error
    }
  }
}
