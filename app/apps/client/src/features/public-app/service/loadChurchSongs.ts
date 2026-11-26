import { readGzipJson } from './readGzipJson'
import type { ChurchSong, Head, Segment, Snapshot } from './types'

/**
 * The church's songs, read straight from the bucket (never through the
 * service): head.json, then its snapshot and the segments after it, later
 * ones winning. Sorted by title.
 */
export async function loadChurchSongs(readUrl: string): Promise<ChurchSong[]> {
  const response = await fetch(`${readUrl}/head.json`, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`head.json: HTTP ${response.status}`)
  const head = (await response.json()) as Head

  const songs = new Map<string, ChurchSong>()
  if (head.snapshot) {
    const snapshot = await readGzipJson<Snapshot>(
      `${readUrl}/${head.snapshot.key}`,
    )
    for (const song of snapshot.songs) songs.set(song.uuid, song)
  }
  const segments = await Promise.all(
    head.segments.map((ref) => readGzipJson<Segment>(`${readUrl}/${ref.key}`)),
  )
  for (const segment of segments) {
    for (const change of segment.changes) {
      if (change.type !== 'song') continue
      if (change.op === 'delete') songs.delete(change.uuid)
      else if (change.data) songs.set(change.uuid, change.data)
    }
  }
  return [...songs.values()].sort((a, b) => a.title.localeCompare(b.title))
}
