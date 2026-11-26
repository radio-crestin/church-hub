import { idByUuid } from './idByUuid'
import { getRawDatabase } from '../../../db'
import type { LibraryBookmarkNote } from '../types'

type NotesTable = 'song_bookmark_notes' | 'bible_bookmark_notes'

/** The free-text rows between song or Bible bookmarks. */
export function serializeBookmarkNotes(
  table: NotesTable,
): LibraryBookmarkNote[] {
  return getRawDatabase()
    .query<LibraryBookmarkNote, []>(
      `SELECT uuid, content, sort_order AS sortOrder, created_at AS createdAt,
              updated_at AS updatedAt
         FROM ${table} WHERE uuid != ''`,
    )
    .all()
}

export function upsertBookmarkNote(
  table: NotesTable,
  note: LibraryBookmarkNote,
): number | null {
  getRawDatabase()
    .query(
      `INSERT INTO ${table} (uuid, content, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (uuid) DO UPDATE SET
         content = excluded.content, sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
    )
    .run(
      note.uuid,
      note.content,
      note.sortOrder,
      note.createdAt,
      note.updatedAt,
    )
  return idByUuid(table, note.uuid)
}
