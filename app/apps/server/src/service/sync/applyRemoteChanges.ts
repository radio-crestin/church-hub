import { MAX_SYNC_UPDATES } from './constants'
import { withTriggersSuppressed } from './syncStateStore'
import type {
  ApplyOp,
  LibraryCategory,
  LibraryGroup,
  LibrarySchedule,
  LibrarySong,
} from './types'
import { getRawDatabase } from '../../db'
import { createLogger } from '../../utils/logger'
import {
  removeFromScheduleSearchIndex,
  updateScheduleSearchIndex,
} from '../schedules/search'
import { removeFromSearchIndex, updateSearchIndex } from '../songs/search'

const logger = createLogger('sync')

const TABLE_BY_TYPE: Record<ApplyOp['entityType'], string> = {
  song: 'songs',
  song_category: 'song_categories',
  song_group: 'song_groups',
  schedule: 'schedules',
}

function idByUuid(table: string, uuid: string): number | null {
  const db = getRawDatabase()
  const row = db
    .query<{ id: number }, [string]>(`SELECT id FROM ${table} WHERE uuid = ?`)
    .get(uuid)
  return row?.id ?? null
}

function upsertCategory(category: LibraryCategory): number | null {
  const db = getRawDatabase()
  db.query(
    `INSERT INTO song_categories (uuid, name, priority, is_hidden, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (uuid) DO UPDATE SET
       name = excluded.name, priority = excluded.priority,
       is_hidden = excluded.is_hidden, updated_at = excluded.updated_at`,
  ).run(
    category.uuid,
    category.name,
    category.priority,
    category.isHidden,
    category.createdAt,
    category.updatedAt,
  )
  return idByUuid('song_categories', category.uuid)
}

function upsertGroup(group: LibraryGroup): number | null {
  const db = getRawDatabase()
  // primary_song_id is fixed up after songs are applied (it may point at a
  // song this same sync cycle is about to insert).
  db.query(
    `INSERT INTO song_groups (uuid, canonical_title, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (uuid) DO UPDATE SET
       canonical_title = excluded.canonical_title,
       updated_at = excluded.updated_at`,
  ).run(group.uuid, group.canonicalTitle, group.createdAt, group.updatedAt)
  return idByUuid('song_groups', group.uuid)
}

function upsertSong(song: LibrarySong): number | null {
  const db = getRawDatabase()
  const categoryId = song.categoryUuid
    ? idByUuid('song_categories', song.categoryUuid)
    : null
  const groupId = song.groupUuid
    ? idByUuid('song_groups', song.groupUuid)
    : null

  db.query(
    `INSERT INTO songs (
       uuid, title, category_id, song_group_id, source_filename, author,
       copyright, ccli, tempo, time_signature, theme, alt_theme, hymn_number,
       key_line, presentation_order, presentation_count, last_presented_at,
       last_manual_edit, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (uuid) DO UPDATE SET
       title = excluded.title, category_id = excluded.category_id,
       song_group_id = excluded.song_group_id,
       source_filename = excluded.source_filename, author = excluded.author,
       copyright = excluded.copyright, ccli = excluded.ccli,
       tempo = excluded.tempo, time_signature = excluded.time_signature,
       theme = excluded.theme, alt_theme = excluded.alt_theme,
       hymn_number = excluded.hymn_number, key_line = excluded.key_line,
       presentation_order = excluded.presentation_order,
       presentation_count = excluded.presentation_count,
       last_presented_at = excluded.last_presented_at,
       last_manual_edit = excluded.last_manual_edit,
       updated_at = excluded.updated_at`,
  ).run(
    song.uuid,
    song.title,
    categoryId,
    groupId,
    song.sourceFilename,
    song.author,
    song.copyright,
    song.ccli,
    song.tempo,
    song.timeSignature,
    song.theme,
    song.altTheme,
    song.hymnNumber,
    song.keyLine,
    song.presentationOrder,
    song.presentationCount,
    song.lastPresentedAt,
    song.lastManualEdit,
    song.createdAt,
    song.updatedAt,
  )

  const songId = idByUuid('songs', song.uuid)
  if (songId === null) return null

  // Slides are replaced wholesale — the aggregate's newer version won.
  db.query('DELETE FROM song_slides WHERE song_id = ?').run(songId)
  const insertSlide = db.query(
    `INSERT INTO song_slides (song_id, content, chords, label, notes, style_overrides, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const slide of song.slides) {
    insertSlide.run(
      songId,
      slide.content,
      slide.chords,
      slide.label,
      slide.notes,
      slide.styleOverrides ?? null,
      slide.sortOrder,
      song.updatedAt,
      song.updatedAt,
    )
  }
  return songId
}

function upsertSchedule(schedule: LibrarySchedule): number | null {
  const db = getRawDatabase()
  db.query(
    `INSERT INTO schedules (uuid, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (uuid) DO UPDATE SET
       title = excluded.title, description = excluded.description,
       updated_at = excluded.updated_at`,
  ).run(
    schedule.uuid,
    schedule.title,
    schedule.description,
    schedule.createdAt,
    schedule.updatedAt,
  )

  const scheduleId = idByUuid('schedules', schedule.uuid)
  if (scheduleId === null) return null

  // Items (and their nested verses, via CASCADE) are replaced wholesale.
  db.query('DELETE FROM schedule_items WHERE schedule_id = ?').run(scheduleId)

  const insertItem = db.query<{ id: number }, unknown[]>(
    `INSERT INTO schedule_items (
       schedule_id, item_type, song_id, slide_type, slide_content,
       bible_passage_reference, bible_passage_translation, obs_scene_name,
       sort_order, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
  const insertVerse = db.query(
    `INSERT INTO schedule_bible_passage_verses (schedule_item_id, verse_id, reference, text, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const insertVt = db.query(
    `INSERT INTO schedule_versete_tineri_entries (
       schedule_item_id, person_name, translation_id, book_code, book_name,
       reference, text, start_chapter, start_verse, end_chapter, end_verse, sort_order
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const verseExists = db.query<{ id: number }, [number]>(
    'SELECT id FROM bible_verses WHERE id = ?',
  )

  for (const item of schedule.items) {
    const songId = item.songUuid ? idByUuid('songs', item.songUuid) : null
    if (item.itemType === 'song' && item.songUuid && songId === null) {
      logger.warning(
        `Schedule "${schedule.title}": song ${item.songUuid} missing locally, keeping item without song link`,
      )
    }
    const inserted = insertItem.get(
      scheduleId,
      item.itemType,
      songId,
      item.slideType,
      item.slideContent,
      item.biblePassageReference,
      item.biblePassageTranslation,
      item.obsSceneName,
      item.sortOrder,
      schedule.updatedAt,
      schedule.updatedAt,
    )
    if (!inserted) continue

    for (const verse of item.bibleVerses) {
      // The verse row references the local bible DB; skip verses whose id does
      // not exist here (different bible data set) — reference/text are kept on
      // matching installs, which is the overwhelmingly common case.
      if (!verseExists.get(verse.verseId)) {
        logger.warning(
          `Schedule "${schedule.title}": bible verse ${verse.verseId} not in local bible, skipping`,
        )
        continue
      }
      insertVerse.run(
        inserted.id,
        verse.verseId,
        verse.reference,
        verse.text,
        verse.sortOrder,
      )
    }
    for (const entry of item.verseteTineri) {
      insertVt.run(
        inserted.id,
        entry.personName,
        entry.translationId,
        entry.bookCode,
        entry.bookName,
        entry.reference,
        entry.text,
        entry.startChapter,
        entry.startVerse,
        entry.endChapter,
        entry.endVerse,
        entry.sortOrder,
      )
    }
  }
  return scheduleId
}

export interface ApplyResult {
  appliedCount: number
  /** Non-silent applied ops, for the WebSocket notification payload. */
  reportedCount: number
}

/**
 * Applies remote-driven changes to the local database in one transaction with
 * the change-tracking triggers suppressed, then refreshes the search indexes
 * and records user-facing entries in the sync_updates feed.
 */
export function applyRemoteChanges(ops: ApplyOp[]): ApplyResult {
  if (ops.length === 0) return { appliedCount: 0, reportedCount: 0 }

  const db = getRawDatabase()
  let appliedCount = 0
  let reportedCount = 0
  const songFtsUpdates: number[] = []
  const scheduleFtsUpdates: number[] = []
  const groupPrimaryFixups: LibraryGroup[] = []

  const run = db.transaction(() => {
    for (const op of ops) {
      const table = TABLE_BY_TYPE[op.entityType]
      let localId: number | null = null

      if (op.op === 'delete') {
        localId = idByUuid(table, op.uuid)
        if (localId !== null) {
          if (op.entityType === 'song') removeFromSearchIndex(localId)
          if (op.entityType === 'schedule') {
            removeFromScheduleSearchIndex(localId)
          }
          db.query(`DELETE FROM ${table} WHERE id = ?`).run(localId)
        }
        localId = null
      } else if (op.data) {
        switch (op.entityType) {
          case 'song_category':
            localId = upsertCategory(op.data as LibraryCategory)
            break
          case 'song_group': {
            const group = op.data as LibraryGroup
            localId = upsertGroup(group)
            groupPrimaryFixups.push(group)
            break
          }
          case 'song':
            localId = upsertSong(op.data as LibrarySong)
            if (localId !== null) songFtsUpdates.push(localId)
            break
          case 'schedule':
            localId = upsertSchedule(op.data as LibrarySchedule)
            if (localId !== null) scheduleFtsUpdates.push(localId)
            break
        }
        // The local row now equals the applied remote version; a resurrected
        // entity must also drop its local tombstone.
        db.query(
          'DELETE FROM sync_tombstones WHERE entity_type = ? AND entity_uuid = ?',
        ).run(op.entityType, op.uuid)
      }

      // Either way the local state now matches the merged file for this key.
      db.query(
        'DELETE FROM sync_pending WHERE entity_type = ? AND entity_uuid = ?',
      ).run(op.entityType, op.uuid)

      appliedCount++
      if (!op.silent) {
        reportedCount++
        db.query(
          `INSERT INTO sync_updates (entity_type, entity_uuid, local_id, change_kind, title, source_device, occurred_at, seen)
           VALUES (?, ?, ?, ?, ?, ?, unixepoch(), 0)`,
        ).run(
          op.entityType,
          op.uuid,
          localId,
          op.changeKind,
          op.title,
          op.sourceDevice ?? null,
        )
      }
    }

    // Second pass: group -> primary song links may target songs inserted above.
    for (const group of groupPrimaryFixups) {
      const primaryId = group.primarySongUuid
        ? idByUuid('songs', group.primarySongUuid)
        : null
      db.query('UPDATE song_groups SET primary_song_id = ? WHERE uuid = ?').run(
        primaryId,
        group.uuid,
      )
    }

    // Keep the updates feed bounded: drop the oldest already-seen entries.
    db.query(
      `DELETE FROM sync_updates WHERE seen = 1 AND id NOT IN (
         SELECT id FROM sync_updates ORDER BY id DESC LIMIT ?
       )`,
    ).run(MAX_SYNC_UPDATES)
  })

  withTriggersSuppressed(() => run())

  for (const songId of songFtsUpdates) updateSearchIndex(songId)
  for (const scheduleId of scheduleFtsUpdates) {
    updateScheduleSearchIndex(scheduleId)
  }

  logger.info(`Applied ${appliedCount} remote change(s) from Drive sync`)
  return { appliedCount, reportedCount }
}
