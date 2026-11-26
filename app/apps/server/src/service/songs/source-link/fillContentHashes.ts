import { lyricsHash } from './lyricsHash'
import { getRawDatabase } from '../../../db'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('songs:content-hash')

/**
 * Computes `content_hash` for every song that has none: the ones added or
 * whose slides changed since (a trigger clears it on every slide write).
 * A song without lyrics keeps an empty hash, so it is not read again.
 */
export function fillContentHashes(): number {
  const db = getRawDatabase()
  const slides = db
    .query(
      `SELECT s.id AS song_id, sl.content AS content
       FROM songs s LEFT JOIN song_slides sl ON sl.song_id = s.id
       WHERE s.content_hash IS NULL
       ORDER BY s.id, sl.sort_order`,
    )
    .all() as { song_id: number; content: string | null }[]
  if (slides.length === 0) return 0

  const lyrics = new Map<number, string[]>()
  for (const { song_id, content } of slides) {
    const blocks = lyrics.get(song_id) ?? []
    if (content) blocks.push(content)
    lyrics.set(song_id, blocks)
  }
  const update = db.query('UPDATE songs SET content_hash = ? WHERE id = ?')
  db.transaction(() => {
    for (const [id, blocks] of lyrics) update.run(lyricsHash(blocks) ?? '', id)
  })()
  logger.debug(`Content hashes computed for ${lyrics.size} songs`)
  return lyrics.size
}
