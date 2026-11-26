import { LIBRARY_BUNDLE_VERSION } from '@church-hub/song-formats'

import { downloadStaleSongs } from './downloadStaleSongs'
import { fetchLink } from './fetchLink'
import { getRawDatabase } from '../../../db'
import { parseManifest } from '../bundle/parseManifest'
import type { SongBundleFile } from '../bundle/types'

interface CachedSong {
  song_id: string
  hash: string
  contents: string
}

/**
 * Every song file of a shared folder or library. The manifest says each
 * song's hash, so only songs that are new or changed since the last read
 * are downloaded (in a library, only the shards holding them); the rest
 * come from the local cache. Songs gone from the manifest leave the cache.
 */
export async function readBundleFolder(
  manifestUrl: string,
): Promise<SongBundleFile[]> {
  const db = getRawDatabase()
  const manifest = parseManifest(
    new TextDecoder().decode(await fetchLink(manifestUrl)),
  )
  const cached = new Map(
    db
      .query<CachedSong, [string]>(
        'SELECT song_id, hash, contents FROM song_source_song_cache WHERE manifest_url = ?',
      )
      .all(manifestUrl)
      .map((row) => [row.song_id, row]),
  )

  const stale = manifest.songs.filter(
    (entry) => cached.get(entry.id)?.hash !== entry.hash,
  )
  const upsert = db.query(
    `INSERT INTO song_source_song_cache (manifest_url, song_id, hash, contents)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(manifest_url, song_id) DO UPDATE SET hash = excluded.hash,
       contents = excluded.contents`,
  )
  await downloadStaleSongs(manifestUrl, manifest, stale, (entry, contents) => {
    upsert.run(manifestUrl, entry.id, entry.hash, contents)
    cached.set(entry.id, { song_id: entry.id, hash: entry.hash, contents })
  })

  const sharded = manifest.version >= LIBRARY_BUNDLE_VERSION
  const listed = new Set(manifest.songs.map((entry) => entry.id))
  const remove = db.query(
    'DELETE FROM song_source_song_cache WHERE manifest_url = ? AND song_id = ?',
  )
  for (const songId of cached.keys()) {
    if (!listed.has(songId)) remove.run(manifestUrl, songId)
  }

  return manifest.songs.map((entry) => {
    const song = cached.get(entry.id)
    if (!song) throw new Error(`Song ${entry.id} was not downloaded`)
    // A library's path is its shard: the song's own file name is its id.
    const path = sharded ? `${entry.id}.opensong` : entry.path
    return { id: entry.id, path, xml: song.contents }
  })
}
