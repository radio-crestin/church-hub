import { asc, desc, eq, inArray, sql } from 'drizzle-orm'

import type {
  Schedule,
  ScheduleBiblePassageVerse,
  ScheduleItem,
  ScheduleVerseteTineriEntry,
  ScheduleWithItems,
} from './types'
import { getDatabase } from '../../db'
import {
  scheduleBiblePassageVerses,
  scheduleItems,
  schedules,
  scheduleVerseteTineriEntries,
  songCategories,
  songs,
} from '../../db/schema'
import { getSlidesBySongId, getSlidesBySongIds } from '../songs'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Gets bible passage verses for a schedule item
 */
function getBiblePassageVerses(
  scheduleItemId: number,
): ScheduleBiblePassageVerse[] {
  const db = getDatabase()
  const verses = db
    .select()
    .from(scheduleBiblePassageVerses)
    .where(eq(scheduleBiblePassageVerses.scheduleItemId, scheduleItemId))
    .orderBy(asc(scheduleBiblePassageVerses.sortOrder))
    .all()

  return verses.map((v) => ({
    id: v.id,
    verseId: v.verseId,
    reference: v.reference,
    text: v.text,
    sortOrder: v.sortOrder,
  }))
}

/**
 * Gets bible passage verses for multiple schedule items in a single query (batch operation)
 * Returns a Map of scheduleItemId -> verses array
 */
function getBiblePassageVersesBatch(
  scheduleItemIds: number[],
): Map<number, ScheduleBiblePassageVerse[]> {
  if (scheduleItemIds.length === 0) {
    return new Map()
  }

  const db = getDatabase()
  const verses = db
    .select()
    .from(scheduleBiblePassageVerses)
    .where(inArray(scheduleBiblePassageVerses.scheduleItemId, scheduleItemIds))
    .orderBy(
      asc(scheduleBiblePassageVerses.scheduleItemId),
      asc(scheduleBiblePassageVerses.sortOrder),
    )
    .all()

  // Group verses by scheduleItemId
  const versesByItemId = new Map<number, ScheduleBiblePassageVerse[]>()

  // Initialize empty arrays for all requested itemIds
  for (const itemId of scheduleItemIds) {
    versesByItemId.set(itemId, [])
  }

  // Populate with actual verses
  for (const v of verses) {
    const itemVerses = versesByItemId.get(v.scheduleItemId)
    if (itemVerses) {
      itemVerses.push({
        id: v.id,
        verseId: v.verseId,
        reference: v.reference,
        text: v.text,
        sortOrder: v.sortOrder,
      })
    }
  }

  return versesByItemId
}

/**
 * Gets versete tineri entries for a schedule item
 */
function getVerseteTineriEntries(
  scheduleItemId: number,
): ScheduleVerseteTineriEntry[] {
  const db = getDatabase()
  const entries = db
    .select()
    .from(scheduleVerseteTineriEntries)
    .where(eq(scheduleVerseteTineriEntries.scheduleItemId, scheduleItemId))
    .orderBy(asc(scheduleVerseteTineriEntries.sortOrder))
    .all()

  return entries.map((e) => ({
    id: e.id,
    personName: e.personName,
    translationId: e.translationId,
    bookCode: e.bookCode,
    bookName: e.bookName,
    reference: e.reference,
    text: e.text,
    startChapter: e.startChapter,
    startVerse: e.startVerse,
    endChapter: e.endChapter,
    endVerse: e.endVerse,
    sortOrder: e.sortOrder,
  }))
}

/**
 * Gets versete tineri entries for multiple schedule items in a single query (batch operation)
 * Returns a Map of scheduleItemId -> entries array
 */
function getVerseteTineriEntriesBatch(
  scheduleItemIds: number[],
): Map<number, ScheduleVerseteTineriEntry[]> {
  if (scheduleItemIds.length === 0) {
    return new Map()
  }

  const db = getDatabase()
  const entries = db
    .select()
    .from(scheduleVerseteTineriEntries)
    .where(
      inArray(scheduleVerseteTineriEntries.scheduleItemId, scheduleItemIds),
    )
    .orderBy(
      asc(scheduleVerseteTineriEntries.scheduleItemId),
      asc(scheduleVerseteTineriEntries.sortOrder),
    )
    .all()

  // Group entries by scheduleItemId
  const entriesByItemId = new Map<number, ScheduleVerseteTineriEntry[]>()

  // Initialize empty arrays for all requested itemIds
  for (const itemId of scheduleItemIds) {
    entriesByItemId.set(itemId, [])
  }

  // Populate with actual entries
  for (const e of entries) {
    const itemEntries = entriesByItemId.get(e.scheduleItemId)
    if (itemEntries) {
      itemEntries.push({
        id: e.id,
        personName: e.personName,
        translationId: e.translationId,
        bookCode: e.bookCode,
        bookName: e.bookName,
        reference: e.reference,
        text: e.text,
        startChapter: e.startChapter,
        startVerse: e.startVerse,
        endChapter: e.endChapter,
        endVerse: e.endVerse,
        sortOrder: e.sortOrder,
      })
    }
  }

  return entriesByItemId
}

/**
 * Gets all schedules with item counts
 */
export function getSchedules(): Schedule[] {
  try {
    log('debug', 'Getting all schedules')

    const db = getDatabase()
    const results = db
      .select({
        id: schedules.id,
        title: schedules.title,
        description: schedules.description,
        createdAt: schedules.createdAt,
        updatedAt: schedules.updatedAt,
        itemCount: sql<number>`CAST(COUNT(${scheduleItems.id}) AS INTEGER)`,
        songCount: sql<number>`CAST(SUM(CASE WHEN ${scheduleItems.itemType} = 'song' THEN 1 ELSE 0 END) AS INTEGER)`,
      })
      .from(schedules)
      .leftJoin(scheduleItems, eq(schedules.id, scheduleItems.scheduleId))
      .groupBy(schedules.id)
      .orderBy(desc(schedules.updatedAt))
      .all()

    return results.map((record) => ({
      id: record.id,
      title: record.title,
      description: record.description,
      itemCount: record.itemCount,
      songCount: record.songCount,
      createdAt: Math.floor(record.createdAt.getTime() / 1000),
      updatedAt: Math.floor(record.updatedAt.getTime() / 1000),
    }))
  } catch (error) {
    log('error', `Failed to get schedules: ${error}`)
    return []
  }
}

/**
 * Gets a single schedule by ID with all items
 */
export function getScheduleById(id: number): ScheduleWithItems | null {
  try {
    log('debug', `Getting schedule by ID: ${id}`)

    const db = getDatabase()

    // Get schedule metadata
    const schedule = db
      .select()
      .from(schedules)
      .where(eq(schedules.id, id))
      .get()

    if (!schedule) {
      log('debug', `Schedule not found: ${id}`)
      return null
    }

    // Get all items for this schedule with song details
    const itemRecords = db
      .select({
        id: scheduleItems.id,
        scheduleId: scheduleItems.scheduleId,
        itemType: scheduleItems.itemType,
        songId: scheduleItems.songId,
        songTitle: songs.title,
        songKeyLine: songs.keyLine,
        categoryName: songCategories.name,
        slideType: scheduleItems.slideType,
        slideContent: scheduleItems.slideContent,
        biblePassageReference: scheduleItems.biblePassageReference,
        biblePassageTranslation: scheduleItems.biblePassageTranslation,
        obsSceneName: scheduleItems.obsSceneName,
        sortOrder: scheduleItems.sortOrder,
        createdAt: scheduleItems.createdAt,
        updatedAt: scheduleItems.updatedAt,
      })
      .from(scheduleItems)
      .leftJoin(songs, eq(scheduleItems.songId, songs.id))
      .leftJoin(songCategories, eq(songs.categoryId, songCategories.id))
      .where(eq(scheduleItems.scheduleId, id))
      .orderBy(asc(scheduleItems.sortOrder))
      .all()

    // Collect IDs for batch loading (eliminates N+1 queries)
    const songIds: number[] = []
    const biblePassageItemIds: number[] = []
    const verseteTineriItemIds: number[] = []

    for (const record of itemRecords) {
      if (record.itemType === 'song' && record.songId) {
        songIds.push(record.songId)
      }
      if (record.itemType === 'bible_passage') {
        biblePassageItemIds.push(record.id)
      }
      if (
        record.itemType === 'slide' &&
        record.slideType === 'versete_tineri'
      ) {
        verseteTineriItemIds.push(record.id)
      }
    }

    // Batch load all related data in 3 queries instead of N queries
    const slidesBySongId = getSlidesBySongIds(songIds)
    const versesByItemId = getBiblePassageVersesBatch(biblePassageItemIds)
    const entriesByItemId = getVerseteTineriEntriesBatch(verseteTineriItemIds)

    // Convert items with pre-loaded data
    const items: ScheduleItem[] = itemRecords.map((record) => {
      const isSongItem = record.itemType === 'song' && record.songId !== null
      const slides =
        record.itemType === 'song' && record.songId
          ? (slidesBySongId.get(record.songId) ?? [])
          : []

      const biblePassageVerses =
        record.itemType === 'bible_passage'
          ? (versesByItemId.get(record.id) ?? [])
          : []

      const verseteTineriEntries =
        record.itemType === 'slide' && record.slideType === 'versete_tineri'
          ? (entriesByItemId.get(record.id) ?? [])
          : []

      return {
        id: record.id,
        scheduleId: record.scheduleId,
        itemType: record.itemType,
        songId: record.songId,
        song: isSongItem
          ? {
              id: record.songId!,
              title: record.songTitle!,
              categoryName: record.categoryName,
            }
          : null,
        slides,
        keyLine: record.songKeyLine ?? null,
        slideType: record.slideType,
        slideContent: record.slideContent,
        biblePassageReference: record.biblePassageReference,
        biblePassageTranslation: record.biblePassageTranslation,
        biblePassageVerses,
        verseteTineriEntries,
        obsSceneName: record.obsSceneName,
        sortOrder: record.sortOrder,
        createdAt: Math.floor(record.createdAt.getTime() / 1000),
        updatedAt: Math.floor(record.updatedAt.getTime() / 1000),
      }
    })

    const songCount = items.filter((i) => i.itemType === 'song').length

    return {
      id: schedule.id,
      title: schedule.title,
      description: schedule.description,
      itemCount: items.length,
      songCount,
      createdAt: Math.floor(schedule.createdAt.getTime() / 1000),
      updatedAt: Math.floor(schedule.updatedAt.getTime() / 1000),
      items,
    }
  } catch (error) {
    log('error', `Failed to get schedule: ${error}`)
    return null
  }
}

/**
 * Gets a single schedule item by ID
 */
export function getScheduleItemById(id: number): ScheduleItem | null {
  try {
    log('debug', `Getting schedule item by ID: ${id}`)

    const db = getDatabase()
    const record = db
      .select({
        id: scheduleItems.id,
        scheduleId: scheduleItems.scheduleId,
        itemType: scheduleItems.itemType,
        songId: scheduleItems.songId,
        songTitle: songs.title,
        songKeyLine: songs.keyLine,
        categoryName: songCategories.name,
        slideType: scheduleItems.slideType,
        slideContent: scheduleItems.slideContent,
        biblePassageReference: scheduleItems.biblePassageReference,
        biblePassageTranslation: scheduleItems.biblePassageTranslation,
        obsSceneName: scheduleItems.obsSceneName,
        sortOrder: scheduleItems.sortOrder,
        createdAt: scheduleItems.createdAt,
        updatedAt: scheduleItems.updatedAt,
      })
      .from(scheduleItems)
      .leftJoin(songs, eq(scheduleItems.songId, songs.id))
      .leftJoin(songCategories, eq(songs.categoryId, songCategories.id))
      .where(eq(scheduleItems.id, id))
      .get()

    if (!record) {
      log('debug', `Schedule item not found: ${id}`)
      return null
    }

    const isSongItem = record.itemType === 'song' && record.songId !== null
    const slides =
      record.itemType === 'song' && record.songId
        ? getSlidesBySongId(record.songId)
        : []

    // Fetch bible passage verses if this is a bible_passage item
    const biblePassageVerses =
      record.itemType === 'bible_passage'
        ? getBiblePassageVerses(record.id)
        : []

    // Fetch versete tineri entries if this is a versete_tineri slide
    const verseteTineriEntries =
      record.itemType === 'slide' && record.slideType === 'versete_tineri'
        ? getVerseteTineriEntries(record.id)
        : []

    return {
      id: record.id,
      scheduleId: record.scheduleId,
      itemType: record.itemType,
      songId: record.songId,
      song: isSongItem
        ? {
            id: record.songId!,
            title: record.songTitle!,
            categoryName: record.categoryName,
          }
        : null,
      slides,
      keyLine: record.songKeyLine ?? null,
      slideType: record.slideType,
      slideContent: record.slideContent,
      biblePassageReference: record.biblePassageReference,
      biblePassageTranslation: record.biblePassageTranslation,
      biblePassageVerses,
      verseteTineriEntries,
      obsSceneName: record.obsSceneName,
      sortOrder: record.sortOrder,
      createdAt: Math.floor(record.createdAt.getTime() / 1000),
      updatedAt: Math.floor(record.updatedAt.getTime() / 1000),
    }
  } catch (error) {
    log('error', `Failed to get schedule item: ${error}`)
    return null
  }
}
