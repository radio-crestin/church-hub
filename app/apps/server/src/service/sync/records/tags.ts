import { adoptByName } from './adoptByName'
import { idByUuid } from './idByUuid'
import { getRawDatabase } from '../../../db'
import type { LibraryTag } from '../types'

export function serializeTags(): LibraryTag[] {
  return getRawDatabase()
    .query<LibraryTag, []>(
      `SELECT uuid, name, sort_order AS sortOrder, created_at AS createdAt,
              updated_at AS updatedAt
         FROM song_tags WHERE uuid != ''`,
    )
    .all()
}

export function upsertTag(tag: LibraryTag): number | null {
  adoptByName('song_tags', tag.uuid, tag.name)
  getRawDatabase()
    .query(
      `INSERT INTO song_tags (uuid, name, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (uuid) DO UPDATE SET
         name = excluded.name, sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
    )
    .run(tag.uuid, tag.name, tag.sortOrder, tag.createdAt, tag.updatedAt)
  return idByUuid('song_tags', tag.uuid)
}
