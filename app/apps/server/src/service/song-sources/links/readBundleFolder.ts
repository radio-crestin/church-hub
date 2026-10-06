import { fetchLink } from './fetchLink'
import { getRawDatabase } from '../../../db'
import { parseManifest } from '../bundle/parseManifest'
import type { SongBundleManifestEntry, SongBundleSong } from '../bundle/types'

/** Downloads at a time; a first read of a large folder stays quick. */
const CONCURRENCY = 16

interface CachedSong {
  song_id: string
  hash: string
  contents: string
}

/** A song file's URL, refusing paths that leave the manifest's site. */
function songUrl(manifestUrl: string, entry: SongBundleManifestEntry): string {
  const url = new URL(entry.path, manifestUrl)
  if (url.origin !== new URL(manifestUrl).origin) {
    throw new Error(`Song path leaves the source: ${entry.path}`)
  }
  return url.toString()
}

/**
 * Every song of a shared folder. The manifest says each song's hash, so only
 * songs that are new or changed since the last read are downloaded; the rest
 * come from the local cache. Songs gone from the manifest leave the cache.
 */
export async function readBundleFolder(
  manifestUrl: string,
): Promise<SongBundleSong[]> {
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
  const queue = [...stale]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        const contents = new TextDecoder().decode(
          await fetchLink(songUrl(manifestUrl, entry)),
        )
        upsert.run(manifestUrl, entry.id, entry.hash, contents)
        cached.set(entry.id, {
          song_id: entry.id,
          hash: entry.hash,
          contents,
        })
      }
    }),
  )

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
    return JSON.parse(song.contents)
  })
}
