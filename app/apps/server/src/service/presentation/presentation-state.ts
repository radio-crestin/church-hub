import { eq, sql } from 'drizzle-orm'

import type {
  PresentationState,
  PresentTemporaryBibleInput,
  PresentTemporarySongInput,
  TemporaryContent,
  UpdatePresentationStateInput,
} from './types'
import { getDatabase, getRawDatabase } from '../../db'
import { presentationState, songSlides, songs } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [presentation-state] ${message}`)
}

/**
 * Increments the presentation count for a song when one of its slides is displayed
 */
function incrementSongPresentationCount(songSlideId: number): void {
  try {
    const db = getDatabase()
    // Get song_id from song_slides, then increment presentation_count
    const slide = db
      .select({ songId: songSlides.songId })
      .from(songSlides)
      .where(eq(songSlides.id, songSlideId))
      .get()

    if (slide) {
      db.update(songs)
        .set({
          presentationCount: sql`${songs.presentationCount} + 1`,
        })
        .where(eq(songs.id, slide.songId))
        .run()
    }
    log(
      'debug',
      `Incremented presentation count for song with slide ${songSlideId}`,
    )
  } catch (error) {
    log('error', `Failed to increment presentation count: ${error}`)
  }
}

/**
 * Parses temporary content from JSON string
 */
function parseTemporaryContent(json: string | null): TemporaryContent | null {
  if (!json) return null
  try {
    return JSON.parse(json) as TemporaryContent
  } catch {
    return null
  }
}

/**
 * Converts database record to API format
 */
function toPresentationState(
  record: typeof presentationState.$inferSelect,
): PresentationState {
  return {
    currentQueueItemId: record.currentQueueItemId,
    currentSongSlideId: record.currentSongSlideId,
    lastSongSlideId: record.lastSongSlideId,
    currentBiblePassageVerseId: record.currentBiblePassageVerseId,
    currentVerseteTineriEntryId: record.currentVerseteTineriEntryId,
    isPresenting: record.isPresenting,
    isHidden: record.isHidden,
    temporaryContent: parseTemporaryContent(record.temporaryContent),
    updatedAt: record.updatedAt,
  }
}

/**
 * Gets the current presentation state
 */
export function getPresentationState(): PresentationState {
  try {
    log('debug', 'Getting presentation state')

    const db = getDatabase()
    const record = db
      .select()
      .from(presentationState)
      .where(eq(presentationState.id, 1))
      .get()

    if (!record) {
      // Return default state if not found
      return {
        currentQueueItemId: null,
        currentSongSlideId: null,
        lastSongSlideId: null,
        currentBiblePassageVerseId: null,
        currentVerseteTineriEntryId: null,
        isPresenting: false,
        isHidden: false,
        temporaryContent: null,
        updatedAt: Date.now(),
      }
    }

    return toPresentationState(record)
  } catch (error) {
    log('error', `Failed to get presentation state: ${error}`)
    return {
      currentQueueItemId: null,
      currentSongSlideId: null,
      lastSongSlideId: null,
      currentBiblePassageVerseId: null,
      currentVerseteTineriEntryId: null,
      isPresenting: false,
      isHidden: false,
      temporaryContent: null,
      updatedAt: Date.now(),
    }
  }
}

/**
 * Updates the presentation state
 */
export function updatePresentationState(
  input: UpdatePresentationStateInput,
): PresentationState {
  try {
    log('debug', 'Updating presentation state')

    const db = getDatabase()
    const now = new Date()
    const current = getPresentationState()

    const currentQueueItemId =
      input.currentQueueItemId !== undefined
        ? input.currentQueueItemId
        : current.currentQueueItemId
    const currentSongSlideId =
      input.currentSongSlideId !== undefined
        ? input.currentSongSlideId
        : current.currentSongSlideId
    const lastSongSlideId =
      input.lastSongSlideId !== undefined
        ? input.lastSongSlideId
        : current.lastSongSlideId
    const currentBiblePassageVerseId =
      input.currentBiblePassageVerseId !== undefined
        ? input.currentBiblePassageVerseId
        : current.currentBiblePassageVerseId
    const currentVerseteTineriEntryId =
      input.currentVerseteTineriEntryId !== undefined
        ? input.currentVerseteTineriEntryId
        : current.currentVerseteTineriEntryId
    const isPresenting =
      input.isPresenting !== undefined
        ? input.isPresenting
        : current.isPresenting
    const isHidden =
      input.isHidden !== undefined ? input.isHidden : current.isHidden

    // Handle temporary content
    // Clear temporary content when selecting a queue item
    let temporaryContent: TemporaryContent | null
    if (input.temporaryContent !== undefined) {
      temporaryContent = input.temporaryContent
    } else if (
      input.currentQueueItemId !== undefined &&
      input.currentQueueItemId !== null
    ) {
      // Auto-clear temporary content when switching to queue item
      temporaryContent = null
    } else {
      temporaryContent = current.temporaryContent
    }

    const temporaryContentJson = temporaryContent
      ? JSON.stringify(temporaryContent)
      : null

    db.insert(presentationState)
      .values({
        id: 1,
        currentQueueItemId,
        currentSongSlideId,
        lastSongSlideId,
        currentBiblePassageVerseId,
        currentVerseteTineriEntryId,
        isPresenting,
        isHidden,
        temporaryContent: temporaryContentJson,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: presentationState.id,
        set: {
          currentQueueItemId,
          currentSongSlideId,
          lastSongSlideId,
          currentBiblePassageVerseId,
          currentVerseteTineriEntryId,
          isPresenting,
          isHidden,
          temporaryContent: temporaryContentJson,
          updatedAt: now,
        },
      })
      .run()

    // Track presentation count when a new song slide is displayed
    if (
      input.currentSongSlideId &&
      input.currentSongSlideId !== current.currentSongSlideId &&
      !isHidden
    ) {
      incrementSongPresentationCount(input.currentSongSlideId)
    }

    log('info', 'Presentation state updated')
    return getPresentationState()
  } catch (error) {
    log('error', `Failed to update presentation state: ${error}`)
    return getPresentationState()
  }
}

/**
 * Stops the current presentation
 */
export function stopPresentation(): PresentationState {
  try {
    log('debug', 'Stopping presentation')

    return updatePresentationState({
      isPresenting: false,
      currentQueueItemId: null,
      currentSongSlideId: null,
      temporaryContent: null,
    })
  } catch (error) {
    log('error', `Failed to stop presentation: ${error}`)
    return getPresentationState()
  }
}

/**
 * Clears the current slide (shows blank/clock)
 * Saves currentSongSlideId to lastSongSlideId for restoration
 * Keeps currentQueueItemId so the slide can be restored with showSlide
 */
export function clearSlide(): PresentationState {
  try {
    log('debug', 'Clearing current slide (hiding)')

    const current = getPresentationState()

    // Save current song slide ID for restoration, then set hidden state
    return updatePresentationState({
      // Save the current song slide ID so we can restore the exact slide
      lastSongSlideId: current.currentSongSlideId ?? current.lastSongSlideId,
      isHidden: true,
    })
  } catch (error) {
    log('error', `Failed to clear slide: ${error}`)
    return getPresentationState()
  }
}

/**
 * Shows the presentation (restores from hidden state)
 * Simply sets isHidden to false - the current slide IDs are preserved
 */
export function showSlide(): PresentationState {
  try {
    log('debug', 'Showing presentation (unhiding)')

    return updatePresentationState({
      isHidden: false,
    })
  } catch (error) {
    log('error', `Failed to show slide: ${error}`)
    return getPresentationState()
  }
}

/**
 * Gets all slides in queue order (both song slides and standalone slides)
 * Returns a flat list for navigation
 * Uses raw SQL for complex LEFT JOIN with conditional logic
 */
function getQueueSlides(): {
  queueItemId: number
  slideId: number | null
  biblePassageVerseId: number | null
  verseteTineriEntryId: number | null
  isStandaloneSlide: boolean
  isBiblePassageVerse: boolean
  isVerseteTineriEntry: boolean
}[] {
  const rawDb = getRawDatabase()

  // Get all queue items with their slides, bible passage verses, and versete tineri entries
  // For song items: join song_slides
  // For bible_passage items: join bible_passage_verses
  // For versete_tineri slides: join versete_tineri_entries
  // For other slide/bible items: use queue item id as "slide" (slideId = null)
  const results = rawDb
    .query(`
    SELECT
      pq.id as queue_item_id,
      pq.item_type,
      pq.slide_type,
      ss.id as slide_id,
      bpv.id as bible_passage_verse_id,
      vte.id as versete_tineri_entry_id,
      COALESCE(ss.sort_order, bpv.sort_order, vte.sort_order, 0) as inner_sort_order
    FROM presentation_queue pq
    LEFT JOIN song_slides ss ON pq.item_type = 'song' AND ss.song_id = pq.song_id
    LEFT JOIN bible_passage_verses bpv ON pq.item_type = 'bible_passage' AND bpv.queue_item_id = pq.id
    LEFT JOIN versete_tineri_entries vte ON pq.item_type = 'slide' AND pq.slide_type = 'versete_tineri' AND vte.queue_item_id = pq.id
    ORDER BY pq.sort_order ASC, inner_sort_order ASC
  `)
    .all() as {
    queue_item_id: number
    item_type: string
    slide_type: string | null
    slide_id: number | null
    bible_passage_verse_id: number | null
    versete_tineri_entry_id: number | null
    inner_sort_order: number
  }[]

  // Build flat list - standalone slides and bible verses appear once, songs and passages appear for each slide/verse
  const slides: {
    queueItemId: number
    slideId: number | null
    biblePassageVerseId: number | null
    verseteTineriEntryId: number | null
    isStandaloneSlide: boolean
    isBiblePassageVerse: boolean
    isVerseteTineriEntry: boolean
  }[] = []

  for (const r of results) {
    if (r.item_type === 'slide' && r.slide_type === 'versete_tineri') {
      // Versete tineri entry - add each entry as a navigable item
      if (r.versete_tineri_entry_id) {
        slides.push({
          queueItemId: r.queue_item_id,
          slideId: null,
          biblePassageVerseId: null,
          verseteTineriEntryId: r.versete_tineri_entry_id,
          isStandaloneSlide: false,
          isBiblePassageVerse: false,
          isVerseteTineriEntry: true,
        })
      }
    } else if (r.item_type === 'slide' || r.item_type === 'bible') {
      // Standalone slide or single Bible verse - only add once (LEFT JOIN may produce multiple rows)
      if (
        !slides.some(
          (s) => s.queueItemId === r.queue_item_id && s.isStandaloneSlide,
        )
      ) {
        slides.push({
          queueItemId: r.queue_item_id,
          slideId: null,
          biblePassageVerseId: null,
          verseteTineriEntryId: null,
          isStandaloneSlide: true,
          isBiblePassageVerse: false,
          isVerseteTineriEntry: false,
        })
      }
    } else if (r.item_type === 'bible_passage' && r.bible_passage_verse_id) {
      // Bible passage verse - add each verse as a navigable entry
      slides.push({
        queueItemId: r.queue_item_id,
        slideId: null,
        biblePassageVerseId: r.bible_passage_verse_id,
        verseteTineriEntryId: null,
        isStandaloneSlide: false,
        isBiblePassageVerse: true,
        isVerseteTineriEntry: false,
      })
    } else if (r.slide_id) {
      // Song slide
      slides.push({
        queueItemId: r.queue_item_id,
        slideId: r.slide_id,
        biblePassageVerseId: null,
        verseteTineriEntryId: null,
        isStandaloneSlide: false,
        isBiblePassageVerse: false,
        isVerseteTineriEntry: false,
      })
    }
  }

  return slides
}

/**
 * Navigate to next or previous slide in the queue
 * Moves through all slides (song slides, standalone slides, and bible passage verses) across all queue items
 */
export function navigateQueueSlide(
  direction: 'next' | 'prev',
): PresentationState {
  try {
    log('debug', `Navigating queue slide: ${direction}`)

    const current = getPresentationState()
    const slides = getQueueSlides()

    if (slides.length === 0) {
      log('warning', 'Cannot navigate: no slides in queue')
      return current
    }

    // Find current position
    // For song slides: match by slideId
    // For bible passage verses: match by biblePassageVerseId
    // For versete tineri entries: match by verseteTineriEntryId
    // For standalone slides: match by queueItemId with null slideId
    let currentIndex = -1
    if (current.currentSongSlideId) {
      // Currently on a song slide
      currentIndex = slides.findIndex(
        (s) =>
          s.slideId === current.currentSongSlideId &&
          s.queueItemId === current.currentQueueItemId,
      )
    } else if (current.currentBiblePassageVerseId) {
      // Currently on a bible passage verse
      currentIndex = slides.findIndex(
        (s) =>
          s.biblePassageVerseId === current.currentBiblePassageVerseId &&
          s.queueItemId === current.currentQueueItemId,
      )
    } else if (current.currentVerseteTineriEntryId) {
      // Currently on a versete tineri entry
      currentIndex = slides.findIndex(
        (s) =>
          s.verseteTineriEntryId === current.currentVerseteTineriEntryId &&
          s.queueItemId === current.currentQueueItemId,
      )
    } else if (current.currentQueueItemId) {
      // Currently on a standalone slide (no song slide ID, bible passage verse ID, or versete tineri entry ID)
      currentIndex = slides.findIndex(
        (s) =>
          s.isStandaloneSlide && s.queueItemId === current.currentQueueItemId,
      )
    }

    let newIndex: number

    if (direction === 'next') {
      newIndex = currentIndex + 1
      if (newIndex >= slides.length) {
        // At the end of the queue - hide and deselect
        log('info', 'Reached end of queue, hiding presentation')
        return updatePresentationState({
          currentQueueItemId: null,
          currentSongSlideId: null,
          currentBiblePassageVerseId: null,
          currentVerseteTineriEntryId: null,
          isHidden: true,
        })
      }
    } else {
      // prev
      newIndex = currentIndex - 1
      if (newIndex < 0) {
        newIndex = 0 // Stay on first slide
      }
    }

    const newSlide = slides[newIndex]
    return updatePresentationState({
      currentQueueItemId: newSlide.queueItemId,
      currentSongSlideId: newSlide.slideId,
      currentBiblePassageVerseId: newSlide.biblePassageVerseId,
      currentVerseteTineriEntryId: newSlide.verseteTineriEntryId,
      isHidden: false,
    })
  } catch (error) {
    log('error', `Failed to navigate queue slide: ${error}`)
    return getPresentationState()
  }
}

// ============================================================================
// TEMPORARY CONTENT FUNCTIONS (bypass queue for instant display)
// ============================================================================

/**
 * Presents a Bible verse temporarily (bypasses queue)
 * Sets temporary content and clears queue item selection
 */
export function presentTemporaryBible(
  input: PresentTemporaryBibleInput,
): PresentationState {
  try {
    log('debug', `Presenting temporary Bible verse: ${input.reference}`)

    const temporaryContent: TemporaryContent = {
      type: 'bible',
      data: {
        verseId: input.verseId,
        reference: input.reference,
        text: input.text,
        translationAbbreviation: input.translationAbbreviation,
        translationId: input.translationId,
        bookId: input.bookId,
        bookCode: input.bookCode,
        chapter: input.chapter,
        currentVerseIndex: input.currentVerseIndex,
      },
    }

    return updatePresentationState({
      temporaryContent,
      currentQueueItemId: null,
      currentSongSlideId: null,
      currentBiblePassageVerseId: null,
      currentVerseteTineriEntryId: null,
      isHidden: false,
      isPresenting: true,
    })
  } catch (error) {
    log('error', `Failed to present temporary Bible verse: ${error}`)
    return getPresentationState()
  }
}

/**
 * Presents a song temporarily (bypasses queue)
 * Fetches song and slides from database
 */
export function presentTemporarySong(
  input: PresentTemporarySongInput,
): PresentationState {
  try {
    log('debug', `Presenting temporary song: ${input.songId}`)

    const db = getDatabase()

    // Fetch song details
    const song = db
      .select({ id: songs.id, title: songs.title })
      .from(songs)
      .where(eq(songs.id, input.songId))
      .get()

    if (!song) {
      log('error', `Song not found: ${input.songId}`)
      return getPresentationState()
    }

    // Fetch song slides
    const slides = db
      .select({
        id: songSlides.id,
        content: songSlides.content,
        sortOrder: songSlides.sortOrder,
      })
      .from(songSlides)
      .where(eq(songSlides.songId, input.songId))
      .orderBy(songSlides.sortOrder)
      .all()

    if (slides.length === 0) {
      log('warning', `Song has no slides: ${input.songId}`)
      return getPresentationState()
    }

    const temporaryContent: TemporaryContent = {
      type: 'song',
      data: {
        songId: song.id,
        title: song.title,
        slides: slides.map((s) => ({
          id: s.id,
          content: s.content,
          sortOrder: s.sortOrder,
        })),
        currentSlideIndex: 0,
      },
    }

    // Track presentation count for the song
    db.update(songs)
      .set({
        presentationCount: sql`${songs.presentationCount} + 1`,
      })
      .where(eq(songs.id, input.songId))
      .run()

    return updatePresentationState({
      temporaryContent,
      currentQueueItemId: null,
      currentSongSlideId: null,
      currentBiblePassageVerseId: null,
      currentVerseteTineriEntryId: null,
      isHidden: false,
      isPresenting: true,
    })
  } catch (error) {
    log('error', `Failed to present temporary song: ${error}`)
    return getPresentationState()
  }
}

/**
 * Navigates within temporary content (next/prev)
 */
export function navigateTemporary(
  direction: 'next' | 'prev',
): PresentationState {
  try {
    log('debug', `Navigating temporary content: ${direction}`)

    const current = getPresentationState()

    if (!current.temporaryContent) {
      log('warning', 'Cannot navigate: no temporary content')
      return current
    }

    if (current.temporaryContent.type === 'bible') {
      return navigateTemporaryBible(current.temporaryContent.data, direction)
    }

    if (current.temporaryContent.type === 'song') {
      return navigateTemporarySong(current.temporaryContent.data, direction)
    }

    return current
  } catch (error) {
    log('error', `Failed to navigate temporary content: ${error}`)
    return getPresentationState()
  }
}

/**
 * Navigates within temporary Bible content
 */
function navigateTemporaryBible(
  data: TemporaryContent extends { type: 'bible'; data: infer D } ? D : never,
  direction: 'next' | 'prev',
): PresentationState {
  const rawDb = getRawDatabase()

  // Get verses in the current chapter
  const chapterVerses = rawDb
    .query(
      `
    SELECT id, verse, text, book_code
    FROM bible_verses
    WHERE translation_id = ? AND book_id = ? AND chapter = ?
    ORDER BY verse ASC
  `,
    )
    .all(data.translationId, data.bookId, data.chapter) as {
    id: number
    verse: number
    text: string
    book_code: string
  }[]

  const newIndex =
    direction === 'next'
      ? data.currentVerseIndex + 1
      : data.currentVerseIndex - 1

  // If within current chapter
  if (newIndex >= 0 && newIndex < chapterVerses.length) {
    const newVerse = chapterVerses[newIndex]
    const reference = `${data.reference.split(' ')[0]} ${data.chapter}:${newVerse.verse} - ${data.translationAbbreviation}`

    const temporaryContent: TemporaryContent = {
      type: 'bible',
      data: {
        ...data,
        verseId: newVerse.id,
        reference,
        text: newVerse.text,
        currentVerseIndex: newIndex,
      },
    }

    return updatePresentationState({ temporaryContent })
  }

  // Handle chapter/book boundary
  if (direction === 'next') {
    // Try next chapter
    const nextChapterVerses = rawDb
      .query(
        `
      SELECT id, verse, text, chapter
      FROM bible_verses
      WHERE translation_id = ? AND book_id = ? AND chapter = ?
      ORDER BY verse ASC
      LIMIT 1
    `,
      )
      .all(data.translationId, data.bookId, data.chapter + 1) as {
      id: number
      verse: number
      text: string
      chapter: number
    }[]

    if (nextChapterVerses.length > 0) {
      const newVerse = nextChapterVerses[0]
      const bookName = data.reference.split(' ')[0]
      const reference = `${bookName} ${newVerse.chapter}:${newVerse.verse} - ${data.translationAbbreviation}`

      const temporaryContent: TemporaryContent = {
        type: 'bible',
        data: {
          ...data,
          verseId: newVerse.id,
          reference,
          text: newVerse.text,
          chapter: newVerse.chapter,
          currentVerseIndex: 0,
        },
      }

      return updatePresentationState({ temporaryContent })
    }

    // End of book - hide presentation
    log('info', 'Reached end of book, hiding temporary presentation')
    return updatePresentationState({
      temporaryContent: null,
      isHidden: true,
    })
  }

  // direction === 'prev' and at start of chapter
  if (data.chapter > 1) {
    // Try previous chapter (last verse)
    const prevChapterVerses = rawDb
      .query(
        `
      SELECT id, verse, text, chapter
      FROM bible_verses
      WHERE translation_id = ? AND book_id = ? AND chapter = ?
      ORDER BY verse DESC
      LIMIT 1
    `,
      )
      .all(data.translationId, data.bookId, data.chapter - 1) as {
      id: number
      verse: number
      text: string
      chapter: number
    }[]

    if (prevChapterVerses.length > 0) {
      const newVerse = prevChapterVerses[0]
      const bookName = data.reference.split(' ')[0]
      const reference = `${bookName} ${newVerse.chapter}:${newVerse.verse} - ${data.translationAbbreviation}`

      // Get verse count to set correct index
      const verseCount = rawDb
        .query(
          `
        SELECT COUNT(*) as count
        FROM bible_verses
        WHERE translation_id = ? AND book_id = ? AND chapter = ?
      `,
        )
        .get(data.translationId, data.bookId, newVerse.chapter) as {
        count: number
      }

      const temporaryContent: TemporaryContent = {
        type: 'bible',
        data: {
          ...data,
          verseId: newVerse.id,
          reference,
          text: newVerse.text,
          chapter: newVerse.chapter,
          currentVerseIndex: verseCount.count - 1,
        },
      }

      return updatePresentationState({ temporaryContent })
    }
  }

  // Stay on first verse
  return getPresentationState()
}

/**
 * Navigates within temporary song content
 */
function navigateTemporarySong(
  data: TemporaryContent extends { type: 'song'; data: infer D } ? D : never,
  direction: 'next' | 'prev',
): PresentationState {
  const newIndex =
    direction === 'next'
      ? data.currentSlideIndex + 1
      : data.currentSlideIndex - 1

  // If at end of song, hide presentation
  if (newIndex >= data.slides.length) {
    log('info', 'Reached end of song, hiding temporary presentation')
    return updatePresentationState({
      temporaryContent: null,
      isHidden: true,
    })
  }

  // If at start, stay on first slide
  if (newIndex < 0) {
    return getPresentationState()
  }

  const temporaryContent: TemporaryContent = {
    type: 'song',
    data: {
      ...data,
      currentSlideIndex: newIndex,
    },
  }

  return updatePresentationState({ temporaryContent })
}

/**
 * Clears temporary content
 */
export function clearTemporaryContent(): PresentationState {
  try {
    log('debug', 'Clearing temporary content')

    return updatePresentationState({
      temporaryContent: null,
    })
  } catch (error) {
    log('error', `Failed to clear temporary content: ${error}`)
    return getPresentationState()
  }
}
