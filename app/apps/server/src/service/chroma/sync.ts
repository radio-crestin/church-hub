import type { Metadata } from 'chromadb'

import { getChromaCollection } from './client'
import { embedInBatches } from './embedder'
import { hashDoc, normalizeForChromaDoc, stripForDisplay } from './normalize'
import { isChromaReady, updateChromaStatus } from './status'
import type {
  BibleDocMetadata,
  ChromaCollectionName,
  ScheduleDocMetadata,
  SongDocMetadata,
} from './types'
import { CHROMA_COLLECTIONS } from './types'
import { getRawDatabase } from '../../db'
import { createLogger } from '../../utils/logger'

const logger = createLogger('chroma-sync')

const EMBED_BATCH_SIZE = Number(process.env.CHROMA_SYNC_BATCH_SIZE) || 100
const UPSERT_CHUNK_SIZE = 500
const GET_PAGE_SIZE = 2000

interface ChromaDoc {
  id: string
  document: string
  metadata: SongDocMetadata | BibleDocMetadata | ScheduleDocMetadata
}

// ---------------------------------------------------------------------------
// Document builders (read straight from SQLite — it stays the source of truth)
// ---------------------------------------------------------------------------

interface SongRow {
  id: number
  title: string
  category_id: number | null
  category_name: string | null
}

interface SlideRow {
  id: number
  song_id: number
  content: string
}

function buildSongDocs(song: SongRow, slides: SlideRow[]): ChromaDoc[] {
  const docs: ChromaDoc[] = []

  const titleDoc = normalizeForChromaDoc(
    `${song.title} ${song.category_name ?? ''}`,
  )
  if (titleDoc) {
    docs.push({
      id: `s${song.id}:t`,
      document: titleDoc,
      metadata: {
        songId: song.id,
        kind: 'title',
        title: song.title,
        ...(song.category_id != null ? { categoryId: song.category_id } : {}),
        original: song.title,
        hash: hashDoc(titleDoc),
      },
    })
  }

  for (const slide of slides) {
    const document = normalizeForChromaDoc(slide.content)
    if (!document) continue
    docs.push({
      id: `s${song.id}:sl${slide.id}`,
      document,
      metadata: {
        songId: song.id,
        kind: 'slide',
        slideId: slide.id,
        title: song.title,
        ...(song.category_id != null ? { categoryId: song.category_id } : {}),
        original: stripForDisplay(slide.content),
        hash: hashDoc(document),
      },
    })
  }

  return docs
}

function getSongRows(songId?: number): SongRow[] {
  const db = getRawDatabase()
  const where = songId != null ? 'WHERE s.id = ?' : ''
  const query = db.query(`
    SELECT s.id, s.title, s.category_id, sc.name as category_name
    FROM songs s
    LEFT JOIN song_categories sc ON s.category_id = sc.id
    ${where}
  `)
  return (songId != null ? query.all(songId) : query.all()) as SongRow[]
}

function getSlideRows(songId?: number): SlideRow[] {
  const db = getRawDatabase()
  const where = songId != null ? 'WHERE song_id = ?' : ''
  const query = db.query(`
    SELECT id, song_id, content FROM song_slides ${where}
    ORDER BY song_id, sort_order ASC
  `)
  return (songId != null ? query.all(songId) : query.all()) as SlideRow[]
}

function buildAllSongDocs(): ChromaDoc[] {
  const songs = getSongRows()
  const slidesBySong = new Map<number, SlideRow[]>()
  for (const slide of getSlideRows()) {
    const list = slidesBySong.get(slide.song_id)
    if (list) {
      list.push(slide)
    } else {
      slidesBySong.set(slide.song_id, [slide])
    }
  }
  return songs.flatMap((song) =>
    buildSongDocs(song, slidesBySong.get(song.id) ?? []),
  )
}

interface VerseRow {
  id: number
  translation_id: number
  book_id: number
  book_code: string
  book_name: string
  chapter: number
  verse: number
  text: string
}

function buildVerseDoc(row: VerseRow): ChromaDoc | null {
  const document = normalizeForChromaDoc(row.text)
  if (!document) return null
  return {
    id: `v${row.id}`,
    document,
    metadata: {
      verseId: row.id,
      translationId: row.translation_id,
      bookId: row.book_id,
      bookCode: row.book_code,
      bookName: row.book_name,
      chapter: row.chapter,
      verse: row.verse,
      original: row.text,
      hash: hashDoc(document),
    },
  }
}

function buildAllBibleDocs(translationId?: number): ChromaDoc[] {
  const db = getRawDatabase()
  const where = translationId != null ? 'WHERE v.translation_id = ?' : ''
  const query = db.query(`
    SELECT v.id, v.translation_id, v.book_id, b.book_code, b.book_name,
           v.chapter, v.verse, v.text
    FROM bible_verses v
    JOIN bible_books b ON v.book_id = b.id
    ${where}
  `)
  const rows = (
    translationId != null ? query.all(translationId) : query.all()
  ) as VerseRow[]
  const docs: ChromaDoc[] = []
  for (const row of rows) {
    const doc = buildVerseDoc(row)
    if (doc) docs.push(doc)
  }
  return docs
}

interface ScheduleRow {
  id: number
  title: string
  description: string | null
}

function buildScheduleDoc(scheduleId: number): ChromaDoc | null {
  const db = getRawDatabase()
  const schedule = db
    .query('SELECT id, title, description FROM schedules WHERE id = ?')
    .get(scheduleId) as ScheduleRow | null
  if (!schedule) return null

  const songTitles = db
    .query(`
      SELECT s.title FROM schedule_items si
      JOIN songs s ON si.song_id = s.id
      WHERE si.schedule_id = ? AND si.item_type = 'song'
      ORDER BY si.sort_order ASC
    `)
    .all(scheduleId) as { title: string }[]
  const songContent = db
    .query(`
      SELECT ss.content FROM schedule_items si
      JOIN song_slides ss ON si.song_id = ss.song_id
      WHERE si.schedule_id = ? AND si.item_type = 'song'
    `)
    .all(scheduleId) as { content: string }[]
  const itemCount = (
    db
      .query('SELECT COUNT(*) as c FROM schedule_items WHERE schedule_id = ?')
      .get(scheduleId) as { c: number }
  ).c

  const titles = songTitles.map((s) => s.title).join(' ')
  const document = normalizeForChromaDoc(
    [
      schedule.title,
      schedule.description ?? '',
      titles,
      songContent.map((s) => s.content).join(' '),
    ].join(' '),
  )
  if (!document) return null

  return {
    id: `sch${schedule.id}`,
    document,
    metadata: {
      scheduleId: schedule.id,
      title: schedule.title,
      ...(schedule.description ? { description: schedule.description } : {}),
      itemCount,
      original: stripForDisplay(titles).slice(0, 300),
      hash: hashDoc(document),
    },
  }
}

function buildAllScheduleDocs(): ChromaDoc[] {
  const db = getRawDatabase()
  const rows = db.query('SELECT id FROM schedules').all() as { id: number }[]
  const docs: ChromaDoc[] = []
  for (const row of rows) {
    const doc = buildScheduleDoc(row.id)
    if (doc) docs.push(doc)
  }
  return docs
}

// ---------------------------------------------------------------------------
// Chroma write primitives
// ---------------------------------------------------------------------------

async function upsertDocs(
  name: ChromaCollectionName,
  docs: ChromaDoc[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (docs.length === 0) return
  const collection = await getChromaCollection(name)

  for (let i = 0; i < docs.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = docs.slice(i, i + UPSERT_CHUNK_SIZE)
    const embeddings = await embedInBatches(
      chunk.map((d) => d.document),
      EMBED_BATCH_SIZE,
    )
    await collection.upsert({
      ids: chunk.map((d) => d.id),
      documents: chunk.map((d) => d.document),
      embeddings,
      metadatas: chunk.map((d) => d.metadata as Metadata),
    })
    onProgress?.(Math.min(i + UPSERT_CHUNK_SIZE, docs.length), docs.length)
  }
}

async function deleteDocIds(
  name: ChromaCollectionName,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  const collection = await getChromaCollection(name)
  for (let i = 0; i < ids.length; i += UPSERT_CHUNK_SIZE) {
    await collection.delete({ ids: ids.slice(i, i + UPSERT_CHUNK_SIZE) })
  }
}

/** Fetches the id → content-hash map of everything currently in a collection. */
async function getExistingHashes(
  name: ChromaCollectionName,
): Promise<Map<string, string>> {
  const collection = await getChromaCollection(name)
  const existing = new Map<string, string>()
  let offset = 0
  for (;;) {
    const page = await collection.get({
      limit: GET_PAGE_SIZE,
      offset,
      include: ['metadatas'],
    })
    const ids = page.ids ?? []
    ids.forEach((id, i) => {
      existing.set(id, String(page.metadatas?.[i]?.hash ?? ''))
    })
    if (ids.length < GET_PAGE_SIZE) break
    offset += GET_PAGE_SIZE
  }
  return existing
}

/**
 * Diff-syncs one collection: embeds + upserts new/changed docs, deletes
 * stale ones. Cheap when already in sync (hash comparison only).
 */
async function syncCollection(
  name: ChromaCollectionName,
  desired: ChromaDoc[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ upserted: number; deleted: number; total: number }> {
  const existing = await getExistingHashes(name)

  const desiredIds = new Set(desired.map((d) => d.id))
  const toUpsert = desired.filter((d) => existing.get(d.id) !== d.metadata.hash)
  const toDelete = [...existing.keys()].filter((id) => !desiredIds.has(id))

  await upsertDocs(name, toUpsert, onProgress)
  await deleteDocIds(name, toDelete)

  const collection = await getChromaCollection(name)
  const total = await collection.count()
  return { upserted: toUpsert.length, deleted: toDelete.length, total }
}

// ---------------------------------------------------------------------------
// Full sync
// ---------------------------------------------------------------------------

let fullSyncRunning: Promise<void> | null = null

/**
 * Synchronizes everything from SQLite into Chroma (songs, bible verses,
 * schedules). Hash-diffed, so subsequent runs only touch changed rows.
 * Concurrent calls coalesce into the running sync.
 */
export function fullChromaSync(): Promise<void> {
  if (fullSyncRunning) return fullSyncRunning
  fullSyncRunning = runFullSync().finally(() => {
    fullSyncRunning = null
  })
  return fullSyncRunning
}

/**
 * Resolves once any in-flight full sync has settled (errors swallowed).
 * Used by resync to avoid deleting collections under a running sync.
 */
export function awaitFullSyncSettled(): Promise<void> {
  return fullSyncRunning ? fullSyncRunning.catch(() => {}) : Promise.resolve()
}

async function runFullSync(): Promise<void> {
  const started = performance.now()
  updateChromaStatus({
    state: 'syncing',
    progress: 0,
    step: 'songs',
    lastError: null,
  })
  try {
    const songDocs = buildAllSongDocs()
    const bibleDocs = buildAllBibleDocs()
    const scheduleDocs = buildAllScheduleDocs()
    const totalDocs = songDocs.length + bibleDocs.length + scheduleDocs.length

    let docsDone = 0
    const report = (collectionDone: number) => {
      updateChromaStatus({
        progress: totalDocs > 0 ? (docsDone + collectionDone) / totalDocs : 1,
      })
    }

    updateChromaStatus({ step: 'songs' })
    const songs = await syncCollection(
      CHROMA_COLLECTIONS.songs,
      songDocs,
      report,
    )
    docsDone += songDocs.length

    updateChromaStatus({ step: 'bible' })
    const bible = await syncCollection(
      CHROMA_COLLECTIONS.bible,
      bibleDocs,
      report,
    )
    docsDone += bibleDocs.length

    updateChromaStatus({ step: 'schedules' })
    const schedules = await syncCollection(
      CHROMA_COLLECTIONS.schedules,
      scheduleDocs,
      report,
    )

    const ms = Math.round(performance.now() - started)
    logger.info(
      `Full sync done in ${ms}ms — songs: ${songs.total} (+${songs.upserted}/-${songs.deleted}), ` +
        `bible: ${bible.total} (+${bible.upserted}/-${bible.deleted}), ` +
        `schedules: ${schedules.total} (+${schedules.upserted}/-${schedules.deleted})`,
    )
    updateChromaStatus({
      state: 'ready',
      progress: 1,
      step: null,
      counts: {
        songs: songs.total,
        bible_verses: bible.total,
        schedules: schedules.total,
      },
      lastFullSyncMs: ms,
      lastFullSyncAt: Date.now(),
    })
  } catch (error) {
    logger.error(`Full sync failed: ${error}`)
    updateChromaStatus({ state: 'error', lastError: String(error) })
    throw error
  }
}

// ---------------------------------------------------------------------------
// Incremental sync queue (fire-and-forget, mirrors the FTS index updates)
// ---------------------------------------------------------------------------

let queue: Promise<void> = Promise.resolve()
const queuedKeys = new Set<string>()

function enqueue(key: string, job: () => Promise<void>): void {
  // Chroma not up yet (or disabled): the boot-time full sync will catch up.
  if (!isChromaReady()) return
  // Coalesce repeated updates for the same entity while one is pending.
  if (queuedKeys.has(key)) return
  queuedKeys.add(key)
  queue = queue.then(async () => {
    queuedKeys.delete(key)
    try {
      await job()
    } catch (error) {
      logger.error(`Incremental sync failed (${key}): ${error}`)
      updateChromaStatus({ lastError: `${key}: ${error}` })
    }
  })
}

/** Re-syncs one song (title + slides) into Chroma. */
export function queueChromaSongSync(songId: number): void {
  enqueue(`song:${songId}`, async () => {
    const [song] = getSongRows(songId)
    if (!song) {
      await removeSongDocs(songId)
      return
    }
    const docs = buildSongDocs(song, getSlideRows(songId))
    // Delete first so removed slides don't linger, then upsert fresh docs.
    await removeSongDocs(songId)
    await upsertDocs(CHROMA_COLLECTIONS.songs, docs)
  })
}

async function removeSongDocs(songId: number): Promise<void> {
  const collection = await getChromaCollection(CHROMA_COLLECTIONS.songs)
  await collection.delete({ where: { songId } })
}

/** Removes a song's documents from Chroma. */
export function queueChromaSongRemove(songId: number): void {
  enqueue(`song-rm:${songId}`, () => removeSongDocs(songId))
}

/** Re-syncs every song in a category (category name is part of title docs). */
export function queueChromaCategorySync(categoryId: number): void {
  enqueue(`category:${categoryId}`, async () => {
    const db = getRawDatabase()
    const songs = db
      .query('SELECT id FROM songs WHERE category_id = ?')
      .all(categoryId) as { id: number }[]
    for (const song of songs) {
      queueChromaSongSync(song.id)
    }
  })
}

/** Re-syncs one schedule document. */
export function queueChromaScheduleSync(scheduleId: number): void {
  enqueue(`schedule:${scheduleId}`, async () => {
    const doc = buildScheduleDoc(scheduleId)
    if (!doc) {
      await deleteDocIds(CHROMA_COLLECTIONS.schedules, [`sch${scheduleId}`])
      return
    }
    await upsertDocs(CHROMA_COLLECTIONS.schedules, [doc])
  })
}

/** Removes a schedule document from Chroma. */
export function queueChromaScheduleRemove(scheduleId: number): void {
  enqueue(`schedule-rm:${scheduleId}`, () =>
    deleteDocIds(CHROMA_COLLECTIONS.schedules, [`sch${scheduleId}`]),
  )
}

/** Syncs all verses of a translation (after Bible import). */
export function queueChromaBibleTranslationSync(translationId: number): void {
  enqueue(`bible:${translationId}`, async () => {
    await upsertDocs(CHROMA_COLLECTIONS.bible, buildAllBibleDocs(translationId))
  })
}

/** Removes all verses of a translation from Chroma. */
export function queueChromaBibleTranslationRemove(translationId: number): void {
  enqueue(`bible-rm:${translationId}`, async () => {
    const collection = await getChromaCollection(CHROMA_COLLECTIONS.bible)
    await collection.delete({ where: { translationId } })
  })
}

/** Awaits the incremental queue — used by tests and the resync endpoint. */
export function flushChromaQueue(): Promise<void> {
  return queue
}
