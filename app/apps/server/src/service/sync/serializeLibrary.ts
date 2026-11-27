import { emptyLibrary, LIBRARY_COLLECTIONS } from './libraryCollections'
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
 * of the merge: every synced collection (libraryCollections.ts) plus the
 * local tombstones.
 *
 * Aggregates in `dirtyKeys` (`entityType:uuid`, the unsynced local edits) are
 * stamped with `modifiedByDevice = deviceName` so other devices can show where
 * each change was made; clean rows inherit their attribution from the remote
 * file during the merge.
 *
 * `only` (`entityType:uuid` keys) serializes just those rows, picked in SQL:
 * a cloud round merges the rows that changed, never the whole library, which
 * on a phone's in-browser server blocked every request for seconds (T-218).
 * Tombstones are always all serialized.
 */
export function serializeLibrary(
  deviceId: string,
  deviceName: string,
  dirtyKeys: ReadonlySet<string>,
  only?: ReadonlySet<string>,
): LibraryFile {
  const db = getRawDatabase()
  const pick = rowFilter(only)
  const included = (type: SyncEntityType, uuid: string) =>
    !only || only.has(`${type}:${uuid}`)

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
      string[]
    >(
      `SELECT uuid, name, priority, is_hidden, created_at, updated_at
         FROM song_categories WHERE uuid != '' AND ${pick.where('uuid')}`,
    )
    .all(...pick.params('song_category'))
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
      string[]
    >(
      `SELECT g.uuid, g.canonical_title, s.uuid AS primary_song_uuid,
              g.created_at, g.updated_at
         FROM song_groups g
         LEFT JOIN songs s ON s.id = g.primary_song_id
        WHERE g.uuid != '' AND ${pick.where('g.uuid')}`,
    )
    .all(...pick.params('song_group'))
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
        alternate_titles: string | null
        background: string | null
        presentation_count: number
        last_presented_at: number | null
        last_manual_edit: number | null
        created_at: number
        updated_at: number
      },
      string[]
    >(
      `SELECT s.id, s.uuid, s.title, c.uuid AS category_uuid, g.uuid AS group_uuid,
              s.source_filename, s.author, s.copyright, s.ccli, s.tempo,
              s.time_signature, s.theme, s.alt_theme, s.hymn_number, s.key_line,
              s.presentation_order, s.alternate_titles, s.background,
              s.presentation_count, s.last_presented_at,
              s.last_manual_edit, s.created_at, s.updated_at
         FROM songs s
         LEFT JOIN song_categories c ON c.id = s.category_id
         LEFT JOIN song_groups g ON g.id = s.song_group_id
        WHERE s.uuid != '' AND ${pick.where('s.uuid')}`,
    )
    .all(...pick.params('song'))

  const slideRows = db
    .query<
      {
        song_id: number
        content: string
        chords: string | null
        label: string | null
        notes: string | null
        style_overrides: string | null
        sort_order: number
      },
      string[]
    >(
      `SELECT song_id, content, chords, label, notes, style_overrides, sort_order
         FROM song_slides
        WHERE song_id IN (SELECT id FROM songs WHERE ${pick.where('uuid')})
        ORDER BY song_id, sort_order, id`,
    )
    .all(...pick.params('song'))

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
      styleOverrides: slide.style_overrides,
      sortOrder: slide.sort_order,
    })
  }

  const tagsBySongId = new Map<number, string[]>()
  for (const row of db
    .query<{ song_id: number; uuid: string }, string[]>(
      `SELECT a.song_id, t.uuid FROM song_tag_assignments a
         JOIN song_tags t ON t.id = a.tag_id
        WHERE a.song_id IN (SELECT id FROM songs WHERE ${pick.where('uuid')})
        ORDER BY t.uuid`,
    )
    .all(...pick.params('song'))) {
    tagsBySongId.set(row.song_id, [
      ...(tagsBySongId.get(row.song_id) ?? []),
      row.uuid,
    ])
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
    alternateTitles: row.alternate_titles,
    background: row.background,
    tagUuids: tagsBySongId.get(row.id) ?? [],
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
        autoplay_seconds: number | null
        autoplay_by_text: number
        loop: number
        music_volume: number | null
        start_on_app_start: number
        start_trigger: string | null
        stop_trigger: string | null
        created_at: number
        updated_at: number
      },
      string[]
    >(
      `SELECT id, uuid, title, description, autoplay_seconds, autoplay_by_text,
              loop, music_volume, start_on_app_start, start_trigger,
              stop_trigger, created_at, updated_at
         FROM schedules
        WHERE uuid != '' AND is_queue = 0 AND ${pick.where('uuid')}`,
    )
    .all(...pick.params('schedule'))

  const itemRows = db
    .query<
      {
        id: number
        schedule_id: number
        item_type: LibraryScheduleItem['itemType']
        song_uuid: string | null
        slide_type: string | null
        slide_content: string | null
        bible_passage_reference: string | null
        bible_passage_translation: string | null
        obs_scene_name: string | null
        item_config: string | null
        child_schedule_uuid: string | null
        advance_seconds: number | null
        is_sung: number
        sung_at: number | null
        sort_order: number
      },
      string[]
    >(
      `SELECT i.id, i.schedule_id, i.item_type, s.uuid AS song_uuid,
              i.slide_type, i.slide_content, i.bible_passage_reference,
              i.bible_passage_translation, i.obs_scene_name, i.item_config,
              c.uuid AS child_schedule_uuid, i.advance_seconds, i.is_sung,
              i.sung_at, i.sort_order
         FROM schedule_items i
         LEFT JOIN songs s ON s.id = i.song_id
         LEFT JOIN schedules c ON c.id = i.child_schedule_id
        WHERE i.schedule_id IN (SELECT id FROM schedules WHERE ${pick.where('uuid')})
        ORDER BY i.schedule_id, i.sort_order, i.id`,
    )
    .all(...pick.params('schedule'))

  const verseRows = db
    .query<
      {
        schedule_item_id: number
        verse_id: number
        reference: string
        text: string
        sort_order: number
      },
      string[]
    >(
      `SELECT schedule_item_id, verse_id, reference, text, sort_order
         FROM schedule_bible_passage_verses
        WHERE schedule_item_id IN (SELECT id FROM schedule_items
          WHERE schedule_id IN (SELECT id FROM schedules WHERE ${pick.where('uuid')}))
        ORDER BY schedule_item_id, sort_order, id`,
    )
    .all(...pick.params('schedule'))

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
      string[]
    >(
      `SELECT schedule_item_id, person_name, translation_id, book_code,
              book_name, reference, text, start_chapter, start_verse,
              end_chapter, end_verse, sort_order
         FROM schedule_versete_tineri_entries
        WHERE schedule_item_id IN (SELECT id FROM schedule_items
          WHERE schedule_id IN (SELECT id FROM schedules WHERE ${pick.where('uuid')}))
        ORDER BY schedule_item_id, sort_order, id`,
    )
    .all(...pick.params('schedule'))

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
      itemConfig: item.item_config,
      childScheduleUuid: item.child_schedule_uuid,
      advanceSeconds: item.advance_seconds,
      isSung: item.is_sung,
      sungAt: item.sung_at,
      sortOrder: item.sort_order,
      bibleVerses: versesByItemId.get(item.id) ?? [],
      verseteTineri: vtByItemId.get(item.id) ?? [],
    })
  }

  const schedules: LibrarySchedule[] = scheduleRows.map((row) => ({
    uuid: row.uuid,
    title: row.title,
    description: row.description,
    playback: {
      autoplaySeconds: row.autoplay_seconds,
      autoplayByText: row.autoplay_by_text,
      loop: row.loop,
      musicVolume: row.music_volume,
      startOnAppStart: row.start_on_app_start,
      startTrigger: row.start_trigger,
      stopTrigger: row.stop_trigger,
    },
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
    ...emptyLibrary(deviceId),
    categories,
    groups,
    songs,
    schedules,
    tombstones,
  }
  for (const { entityType, key, records } of LIBRARY_COLLECTIONS) {
    if (!records) continue
    library[key] = records
      .serialize()
      .filter((item) => included(entityType, item.uuid)) as never
  }

  for (const { entityType, key } of LIBRARY_COLLECTIONS) {
    for (const item of library[key]) {
      if (dirtyKeys.has(`${entityType}:${item.uuid}`)) {
        item.modifiedByDevice = deviceName
      }
    }
  }
  return library
}

/**
 * The SQL that picks `only`'s rows: with no `only`, every row (and no
 * parameter); else the column `IN` a JSON array of one entity type's uuids,
 * which SQLite answers through the column's index.
 */
function rowFilter(only: ReadonlySet<string> | undefined) {
  return {
    where: (column: string) =>
      only ? `${column} IN (SELECT value FROM json_each(?))` : '1',
    params: (type: SyncEntityType): string[] => {
      if (!only) return []
      const prefix = `${type}:`
      return [
        JSON.stringify(
          [...only]
            .filter((key) => key.startsWith(prefix))
            .map((key) => key.slice(prefix.length)),
        ),
      ]
    },
  }
}
