import { getRawDatabase } from '../../db'
import {
  BACKGROUND_MEDIA_ID_REGEX,
  BACKGROUND_MEDIA_URL_PREFIX,
} from '../background-media/constants'

/** Keys under which slides decks and video items name a media id. */
const ID_KEYS = new Set(['mediaId', 'posterMediaId'])

/** Every media id a JSON value names: by id, or by its background URL. */
function collect(value: unknown, key: string, into: Set<string>): void {
  if (typeof value === 'string') {
    const id = ID_KEYS.has(key)
      ? value
      : value.startsWith(`${BACKGROUND_MEDIA_URL_PREFIX}/`)
        ? value.slice(BACKGROUND_MEDIA_URL_PREFIX.length + 1)
        : null
    if (id && BACKGROUND_MEDIA_ID_REGEX.test(id)) into.add(id)
  } else if (Array.isArray(value)) {
    for (const item of value) collect(item, key, into)
  } else if (value && typeof value === 'object') {
    for (const [name, item] of Object.entries(value)) collect(item, name, into)
  }
}

function collectJson(json: string | null, into: Set<string>): void {
  if (!json) return
  try {
    collect(JSON.parse(json), '', into)
  } catch {
    // A malformed column names no media; its own reader reports it.
  }
}

/**
 * The gallery media the church's synced data shows (and so a phone may
 * need): song backgrounds, and the slides decks and videos of its programs
 * (not the control room's queue, which stays on this PC).
 */
export function listReferencedMedia(): Set<string> {
  const db = getRawDatabase()
  const ids = new Set<string>()
  for (const row of db
    .query<{ json: string | null }, []>(
      `SELECT background AS json FROM songs
        WHERE uuid != '' AND background IS NOT NULL`,
    )
    .all()) {
    collectJson(row.json, ids)
  }
  for (const row of db
    .query<{ json: string | null }, []>(
      `SELECT i.item_config AS json FROM schedule_items i
         JOIN schedules s ON s.id = i.schedule_id
        WHERE s.uuid != '' AND s.is_queue = 0 AND i.item_config IS NOT NULL`,
    )
    .all()) {
    collectJson(row.json, ids)
  }
  return ids
}
