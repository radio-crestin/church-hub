import { LIBRARY_SCHEMA_VERSION } from './constants'
import type {
  LibraryFile,
  LibrarySchedule,
  LibraryScheduleItem,
  LibrarySong,
  LibraryTombstone,
} from './types'
import { getRawDatabase } from '../../db'
import type { SyncEntityType } from '../../db/schema/sync'

/**
 * Serializes the local database into a LibraryFile snapshot — the local side
 * of the merge. Only synced aggregates are included (songs with slides,
 * categories, groups, schedules with items) plus the local tombstones.
 *
 * Aggregates in `dirtyKeys` (`entityType:uuid`, the unsynced local edits) are
 * stamped with `modifiedByDevice = deviceName` so other devices can show where
 * each change was made; clean rows inherit their attribution from the remote
 * file during the merge.
 */
export function serializeLibrary(
  deviceId: string,
  deviceName: string,
  dirtyKeys: ReadonlySet<string>,
): LibraryFile {
  const db = getRawDatabase()

  const categories = db
    .query<
      {
        uuid: string
        name: string
        priority: number
        is_hidden: number
        created_at: number
        updated_at: number
      },
      []
    >(
      "SELECT uuid, name, priority, is_hidden, created_at, updated_at FROM song_categories WHERE uuid != ''",
    )
    .all()
    .map((row) => ({
      uuid: row.uuid,
      name: row.name,
      priority: row.priority,
      isHidden: row.is_hidden,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

  const groups = db
    .query<
      {
        uuid: string
        canonical_title: string
        primary_song_uuid: string | null
        created_at: number
        updated_at: number
      },
      []
    >(
      `SELECT g.uuid, g.canonical_title, s.uuid AS primary_song_uuid,
              g.created_at, g.updated_at
         FROM song_groups g
         LEFT JOIN songs s ON s.id = g.primary_song_id
        WHERE g.uuid != ''`,
    )
    .all()
    .map((row) => ({
      uuid: row.uuid,
      canonicalTitle: row.canonical_title,
      primarySongUuid: row.primary_song_uuid,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

  const songRows = db
    .query<
      {
        id: number
        uuid: string
        title: string
        category_uuid: string | null
        group_uuid: string | null
        source_filename: string | null
        author: string | null
        copyright: string | null
        ccli: string | null
        tempo: string | null
        time_signature: string | null
        theme: string | null
        alt_theme: string | null
        hymn_number: string | null
        key_line: string | null
        presentation_order: string | null
        presentation_count: number
        last_presented_at: number | null
        last_manual_edit: number | null
        created_at: number
        updated_at: number
      },
      []
    >(
      `SELECT s.id, s.uuid, s.title, c.uuid AS category_uuid, g.uuid AS group_uuid,
              s.source_filename, s.author, s.copyright, s.ccli, s.tempo,
              s.time_signature, s.theme, s.alt_theme, s.hymn_number, s.key_line,
              s.presentation_order, s.presentation_count, s.last_presented_at,
              s.last_manual_edit, s.created_at, s.updated_at
         FROM songs s
         LEFT JOIN song_categories c ON c.id = s.category_id
         LEFT JOIN song_groups g ON g.id = s.song_group_id
        WHERE s.uuid != ''`,
    )
    .all()

  const slideRows = db
    .query<
      {
        song_id: number
        content: string
        chords: string | null
        label: string | null
        notes: string | null
        sort_order: number
      },
      []
    >(
      'SELECT song_id, content, chords, label, notes, sort_order FROM song_slides ORDER BY song_id, sort_order, id',
    )
    .all()

  const slidesBySongId = new Map<number, LibrarySong['slides']>()
  for (const slide of slideRows) {
    let list = slidesBySongId.get(slide.song_id)
    if (!list) {
      list = []
      slidesBySongId.set(slide.song_id, list)
    }
    list.push({
      content: slide.content,
      chords: slide.chords,
      label: slide.label,
      notes: slide.notes,
      sortOrder: slide.sort_order,
    })
  }

  const songs: LibrarySong[] = songRows.map((row) => ({
    uuid: row.uuid,
    title: row.title,
    categoryUuid: row.category_uuid,
    groupUuid: row.group_uuid,
    sourceFilename: row.source_filename,
    author: row.author,
    copyright: row.copyright,
    ccli: row.ccli,
    tempo: row.tempo,
    timeSignature: row.time_signature,
    theme: row.theme,
    altTheme: row.alt_theme,
    hymnNumber: row.hymn_number,
    keyLine: row.key_line,
    presentationOrder: row.presentation_order,
    presentationCount: row.presentation_count,
    lastPresentedAt: row.last_presented_at,
    lastManualEdit: row.last_manual_edit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slides: slidesBySongId.get(row.id) ?? [],
  }))

  const scheduleRows = db
    .query<
      {
        id: number
        uuid: string
        title: string
        description: string | null
        created_at: number
        updated_at: number
      },
      []
    >(
      "SELECT id, uuid, title, description, created_at, updated_at FROM schedules WHERE uuid != ''",
    )
    .all()

  const itemRows = db
    .query<
      {
        id: number
        schedule_id: number
        item_type: 'song' | 'slide' | 'bible_passage'
        song_uuid: string | null
        slide_type: string | null
        slide_content: string | null
        bible_passage_reference: string | null
        bible_passage_translation: string | null
        obs_scene_name: string | null
        sort_order: number
      },
      []
    >(
      `SELECT i.id, i.schedule_id, i.item_type, s.uuid AS song_uuid,
              i.slide_type, i.slide_content, i.bible_passage_reference,
              i.bible_passage_translation, i.obs_scene_name, i.sort_order
         FROM schedule_items i
         LEFT JOIN songs s ON s.id = i.song_id
        ORDER BY i.schedule_id, i.sort_order, i.id`,
    )
    .all()

  const verseRows = db
    .query<
      {
        schedule_item_id: number
        verse_id: number
        reference: string
        text: string
        sort_order: number
      },
      []
    >(
      'SELECT schedule_item_id, verse_id, reference, text, sort_order FROM schedule_bible_passage_verses ORDER BY schedule_item_id, sort_order, id',
    )
    .all()

  const vtRows = db
    .query<
      {
        schedule_item_id: number
        person_name: string
        translation_id: number
        book_code: string
        book_name: string
        reference: string
        text: string
        start_chapter: number
        start_verse: number
        end_chapter: number
        end_verse: number
        sort_order: number
      },
      []
    >(
      'SELECT schedule_item_id, person_name, translation_id, book_code, book_name, reference, text, start_chapter, start_verse, end_chapter, end_verse, sort_order FROM schedule_versete_tineri_entries ORDER BY schedule_item_id, sort_order, id',
    )
    .all()

  const versesByItemId = new Map<number, LibraryScheduleItem['bibleVerses']>()
  for (const verse of verseRows) {
    let list = versesByItemId.get(verse.schedule_item_id)
    if (!list) {
      list = []
      versesByItemId.set(verse.schedule_item_id, list)
    }
    list.push({
      verseId: verse.verse_id,
      reference: verse.reference,
      text: verse.text,
      sortOrder: verse.sort_order,
    })
  }

  const vtByItemId = new Map<number, LibraryScheduleItem['verseteTineri']>()
  for (const entry of vtRows) {
    let list = vtByItemId.get(entry.schedule_item_id)
    if (!list) {
      list = []
      vtByItemId.set(entry.schedule_item_id, list)
    }
    list.push({
      personName: entry.person_name,
      translationId: entry.translation_id,
      bookCode: entry.book_code,
      bookName: entry.book_name,
      reference: entry.reference,
      text: entry.text,
      startChapter: entry.start_chapter,
      startVerse: entry.start_verse,
      endChapter: entry.end_chapter,
      endVerse: entry.end_verse,
      sortOrder: entry.sort_order,
    })
  }

  const itemsByScheduleId = new Map<number, LibraryScheduleItem[]>()
  for (const item of itemRows) {
    let list = itemsByScheduleId.get(item.schedule_id)
    if (!list) {
      list = []
      itemsByScheduleId.set(item.schedule_id, list)
    }
    list.push({
      itemType: item.item_type,
      songUuid: item.song_uuid,
      slideType: item.slide_type,
      slideContent: item.slide_content,
      biblePassageReference: item.bible_passage_reference,
      biblePassageTranslation: item.bible_passage_translation,
      obsSceneName: item.obs_scene_name,
      sortOrder: item.sort_order,
      bibleVerses: versesByItemId.get(item.id) ?? [],
      verseteTineri: vtByItemId.get(item.id) ?? [],
    })
  }

  const schedules: LibrarySchedule[] = scheduleRows.map((row) => ({
    uuid: row.uuid,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: itemsByScheduleId.get(row.id) ?? [],
  }))

  const tombstones: LibraryTombstone[] = db
    .query<
      { entity_type: SyncEntityType; entity_uuid: string; deleted_at: number },
      []
    >('SELECT entity_type, entity_uuid, deleted_at FROM sync_tombstones')
    .all()
    .map((row) => ({
      entityType: row.entity_type,
      uuid: row.entity_uuid,
      deletedAt: row.deleted_at,
    }))

  const library: LibraryFile = {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    updatedByDevice: deviceId,
    categories,
    groups,
    songs,
    schedules,
    tombstones,
  }

  const stamp = (
    entityType: string,
    items: Array<{ uuid: string } & { modifiedByDevice?: string | null }>,
  ) => {
    for (const item of items) {
      if (dirtyKeys.has(`${entityType}:${item.uuid}`)) {
        item.modifiedByDevice = deviceName
      }
    }
  }
  stamp('song_category', library.categories)
  stamp('song_group', library.groups)
  stamp('song', library.songs)
  stamp('schedule', library.schedules)

  return library
}
