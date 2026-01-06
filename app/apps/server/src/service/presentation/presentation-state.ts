import { eq, sql } from 'drizzle-orm'

import { expandSongSlidesWithChoruses } from './expand-song-slides'
import type {
  PresentationState,
  PresentTemporaryAnnouncementInput,
  PresentTemporaryBibleInput,
  PresentTemporaryBiblePassageInput,
  PresentTemporarySongInput,
  PresentTemporaryVerseteTineriInput,
  TemporaryContent,
  UpdatePresentationStateInput,
} from './types'
import { getDatabase, getRawDatabase } from '../../db'
import { presentationState, songSlides, songs } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

// Track last navigation timestamp to prevent race conditions
let lastNavigationTimestamp = 0

/**
 * Generates a unique, monotonically increasing timestamp in milliseconds.
 * Ensures each update gets a strictly greater timestamp even within same millisecond.
 */
let lastUpdatedAtTimestamp = 0
function getUniqueUpdatedAt(): number {
  const now = Date.now()
  // If called within the same millisecond, increment to ensure uniqueness
  if (now <= lastUpdatedAtTimestamp) {
    lastUpdatedAtTimestamp++
  } else {
    lastUpdatedAtTimestamp = now
  }
  return lastUpdatedAtTimestamp
}

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
    currentSongSlideId: record.currentSongSlideId,
    lastSongSlideId: record.lastSongSlideId,
    isPresenting: record.isPresenting,
    isHidden: record.isHidden,
    temporaryContent: parseTemporaryContent(record.temporaryContent),
    // updatedAt is already stored as milliseconds (number)
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
        currentSongSlideId: null,
        lastSongSlideId: null,
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
      currentSongSlideId: null,
      lastSongSlideId: null,
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
    const now = getUniqueUpdatedAt()
    const current = getPresentationState()

    const currentSongSlideId =
      input.currentSongSlideId !== undefined
        ? input.currentSongSlideId
        : current.currentSongSlideId
    const lastSongSlideId =
      input.lastSongSlideId !== undefined
        ? input.lastSongSlideId
        : current.lastSongSlideId
    const isPresenting =
      input.isPresenting !== undefined
        ? input.isPresenting
        : current.isPresenting
    const isHidden =
      input.isHidden !== undefined ? input.isHidden : current.isHidden

    // Handle temporary content
    const temporaryContent: TemporaryContent | null =
      input.temporaryContent !== undefined
        ? input.temporaryContent
        : current.temporaryContent

    const temporaryContentJson = temporaryContent
      ? JSON.stringify(temporaryContent)
      : null

    db.insert(presentationState)
      .values({
        id: 1,
        currentSongSlideId,
        lastSongSlideId,
        isPresenting,
        isHidden,
        temporaryContent: temporaryContentJson,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: presentationState.id,
        set: {
          currentSongSlideId,
          lastSongSlideId,
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

// ============================================================================
// TEMPORARY CONTENT FUNCTIONS (bypass queue for instant display)
// ============================================================================

/**
 * Presents a Bible verse temporarily
 */
export function presentTemporaryBible(
  input: PresentTemporaryBibleInput,
): PresentationState {
  try {
    log('debug', `Presenting temporary Bible verse: ${input.reference}`)

    // Reset navigation timestamp when presenting new content
    lastNavigationTimestamp = 0

    const temporaryContent: TemporaryContent = {
      type: 'bible',
      data: {
        verseId: input.verseId,
        reference: input.reference,
        text: input.text,
        translationAbbreviation: input.translationAbbreviation,
        bookName: input.bookName,
        translationId: input.translationId,
        bookId: input.bookId,
        bookCode: input.bookCode,
        chapter: input.chapter,
        currentVerseIndex: input.currentVerseIndex,
        // Secondary version (optional)
        secondaryText: input.secondaryText,
        secondaryBookName: input.secondaryBookName,
        secondaryTranslationAbbreviation:
          input.secondaryTranslationAbbreviation,
      },
    }

    return updatePresentationState({
      temporaryContent,
      currentSongSlideId: null,
      isHidden: false,
      isPresenting: true,
    })
  } catch (error) {
    log('error', `Failed to present temporary Bible verse: ${error}`)
    return getPresentationState()
  }
}

/**
 * Presents a song temporarily
 * Fetches song and slides from database
 */
export function presentTemporarySong(
  input: PresentTemporarySongInput,
): PresentationState {
  try {
    log('debug', `Presenting temporary song: ${input.songId}`)

    // Reset navigation timestamp when presenting new content
    lastNavigationTimestamp = 0

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

    // Fetch song slides with labels for dynamic chorus insertion
    const slides = db
      .select({
        id: songSlides.id,
        content: songSlides.content,
        sortOrder: songSlides.sortOrder,
        label: songSlides.label,
      })
      .from(songSlides)
      .where(eq(songSlides.songId, input.songId))
      .orderBy(songSlides.sortOrder)
      .all()

    if (slides.length === 0) {
      log('warning', `Song has no slides: ${input.songId}`)
      return getPresentationState()
    }

    // Expand slides with dynamic chorus insertion (V1 C1 V2 C1 V3 C2...)
    const expandedSlides = expandSongSlidesWithChoruses(slides)

    // Determine starting slide index (clamp to valid range)
    const startIndex =
      input.slideIndex !== undefined
        ? Math.max(0, Math.min(input.slideIndex, expandedSlides.length - 1))
        : 0

    const temporaryContent: TemporaryContent = {
      type: 'song',
      data: {
        songId: song.id,
        title: song.title,
        slides: expandedSlides.map((s, idx) => ({
          id: s.id,
          content: s.content,
          sortOrder: idx, // Use expanded index as sortOrder
        })),
        currentSlideIndex: startIndex,
        nextItemPreview: input.nextItemPreview,
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
      currentSongSlideId: null,
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
 * Uses requestTimestamp to prevent race conditions when navigating rapidly
 */
export function navigateTemporary(
  direction: 'next' | 'prev',
  requestTimestamp: number,
): PresentationState {
  try {
    log(
      'debug',
      `Navigating temporary content: ${direction}, timestamp: ${requestTimestamp}`,
    )

    // Reject stale requests (race condition prevention)
    if (requestTimestamp <= lastNavigationTimestamp) {
      log(
        'debug',
        `Ignoring stale navigation request: ${requestTimestamp} <= ${lastNavigationTimestamp}`,
      )
      return getPresentationState()
    }

    // Update last navigation timestamp
    lastNavigationTimestamp = requestTimestamp

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

    if (current.temporaryContent.type === 'bible_passage') {
      return navigateTemporaryBiblePassage(
        current.temporaryContent.data,
        direction,
      )
    }

    if (current.temporaryContent.type === 'versete_tineri') {
      return navigateTemporaryVerseteTineri(
        current.temporaryContent.data,
        direction,
      )
    }

    // Announcement has no navigation (single slide)
    if (current.temporaryContent.type === 'announcement') {
      log('debug', 'Announcement has no navigation')
      return current
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
    SELECT id, verse, text
    FROM bible_verses
    WHERE translation_id = ? AND book_id = ? AND chapter = ?
    ORDER BY verse ASC
  `,
    )
    .all(data.translationId, data.bookId, data.chapter) as {
    id: number
    verse: number
    text: string
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

  // Handle chapter boundary - move to next chapter if available
  if (direction === 'next') {
    // Get the book's chapter count to check if there's a next chapter
    const book = rawDb
      .query(
        `
      SELECT chapter_count
      FROM bible_books
      WHERE translation_id = ? AND id = ?
    `,
      )
      .get(data.translationId, data.bookId) as { chapter_count: number } | null

    if (book && data.chapter < book.chapter_count) {
      // Move to first verse of next chapter
      const nextChapter = data.chapter + 1
      const nextChapterVerses = rawDb
        .query(
          `
        SELECT id, verse, text
        FROM bible_verses
        WHERE translation_id = ? AND book_id = ? AND chapter = ?
        ORDER BY verse ASC
        LIMIT 1
      `,
        )
        .all(data.translationId, data.bookId, nextChapter) as {
        id: number
        verse: number
        text: string
      }[]

      if (nextChapterVerses.length > 0) {
        const newVerse = nextChapterVerses[0]
        const bookName = data.reference.split(' ')[0]
        const reference = `${bookName} ${nextChapter}:${newVerse.verse} - ${data.translationAbbreviation}`

        const temporaryContent: TemporaryContent = {
          type: 'bible',
          data: {
            ...data,
            verseId: newVerse.id,
            reference,
            text: newVerse.text,
            chapter: nextChapter,
            currentVerseIndex: 0,
          },
        }

        log('info', `Moving to next chapter: ${nextChapter}`)
        return updatePresentationState({ temporaryContent })
      }
    }

    // No next chapter available - end of book, hide presentation
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
 * Navigates within temporary Bible passage content
 */
function navigateTemporaryBiblePassage(
  data: TemporaryContent extends { type: 'bible_passage'; data: infer D }
    ? D
    : never,
  direction: 'next' | 'prev',
): PresentationState {
  const newIndex =
    direction === 'next'
      ? data.currentVerseIndex + 1
      : data.currentVerseIndex - 1

  // If at end of passage, hide presentation
  if (newIndex >= data.verses.length) {
    log('info', 'Reached end of Bible passage, hiding temporary presentation')
    return updatePresentationState({
      temporaryContent: null,
      isHidden: true,
    })
  }

  // If at start, stay on first verse
  if (newIndex < 0) {
    return getPresentationState()
  }

  const temporaryContent: TemporaryContent = {
    type: 'bible_passage',
    data: {
      ...data,
      currentVerseIndex: newIndex,
    },
  }

  return updatePresentationState({ temporaryContent })
}

/**
 * Navigates within temporary versete tineri content
 */
function navigateTemporaryVerseteTineri(
  data: TemporaryContent extends { type: 'versete_tineri'; data: infer D }
    ? D
    : never,
  direction: 'next' | 'prev',
): PresentationState {
  const newIndex =
    direction === 'next'
      ? data.currentEntryIndex + 1
      : data.currentEntryIndex - 1

  // If at end of entries, hide presentation
  if (newIndex >= data.entries.length) {
    log('info', 'Reached end of versete tineri, hiding temporary presentation')
    return updatePresentationState({
      temporaryContent: null,
      isHidden: true,
    })
  }

  // If at start, stay on first entry
  if (newIndex < 0) {
    return getPresentationState()
  }

  const temporaryContent: TemporaryContent = {
    type: 'versete_tineri',
    data: {
      ...data,
      currentEntryIndex: newIndex,
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

/**
 * Presents an announcement temporarily
 */
export function presentTemporaryAnnouncement(
  input: PresentTemporaryAnnouncementInput,
): PresentationState {
  try {
    log('debug', 'Presenting temporary announcement')

    // Reset navigation timestamp when presenting new content
    lastNavigationTimestamp = 0

    const temporaryContent: TemporaryContent = {
      type: 'announcement',
      data: {
        content: input.content,
        nextItemPreview: input.nextItemPreview,
      },
    }

    return updatePresentationState({
      temporaryContent,
      currentSongSlideId: null,
      isHidden: false,
      isPresenting: true,
    })
  } catch (error) {
    log('error', `Failed to present temporary announcement: ${error}`)
    return getPresentationState()
  }
}

/**
 * Presents a Bible passage temporarily (multi-verse)
 */
export function presentTemporaryBiblePassage(
  input: PresentTemporaryBiblePassageInput,
): PresentationState {
  try {
    log(
      'debug',
      `Presenting temporary Bible passage: ${input.bookCode} ${input.startChapter}:${input.startVerse}-${input.endChapter}:${input.endVerse}`,
    )

    // Reset navigation timestamp when presenting new content
    lastNavigationTimestamp = 0

    // Determine starting verse index (clamp to valid range)
    const startIndex =
      input.currentVerseIndex !== undefined
        ? Math.max(
            0,
            Math.min(input.currentVerseIndex, input.verses.length - 1),
          )
        : 0

    const temporaryContent: TemporaryContent = {
      type: 'bible_passage',
      data: {
        translationId: input.translationId,
        translationAbbreviation: input.translationAbbreviation,
        bookCode: input.bookCode,
        bookName: input.bookName,
        startChapter: input.startChapter,
        startVerse: input.startVerse,
        endChapter: input.endChapter,
        endVerse: input.endVerse,
        verses: input.verses,
        currentVerseIndex: startIndex,
        // Secondary version (optional)
        secondaryTranslationId: input.secondaryTranslationId,
        secondaryTranslationAbbreviation:
          input.secondaryTranslationAbbreviation,
        secondaryBookName: input.secondaryBookName,
        secondaryVerses: input.secondaryVerses,
        nextItemPreview: input.nextItemPreview,
      },
    }

    return updatePresentationState({
      temporaryContent,
      currentSongSlideId: null,
      isHidden: false,
      isPresenting: true,
    })
  } catch (error) {
    log('error', `Failed to present temporary Bible passage: ${error}`)
    return getPresentationState()
  }
}

/**
 * Presents versete tineri temporarily
 */
export function presentTemporaryVerseteTineri(
  input: PresentTemporaryVerseteTineriInput,
): PresentationState {
  try {
    log(
      'debug',
      `Presenting temporary versete tineri: ${input.entries.length} entries`,
    )

    // Reset navigation timestamp when presenting new content
    lastNavigationTimestamp = 0

    if (input.entries.length === 0) {
      log('warning', 'Cannot present versete tineri: no entries')
      return getPresentationState()
    }

    // Determine starting entry index (clamp to valid range)
    const startIndex =
      input.currentEntryIndex !== undefined
        ? Math.max(
            0,
            Math.min(input.currentEntryIndex, input.entries.length - 1),
          )
        : 0

    const temporaryContent: TemporaryContent = {
      type: 'versete_tineri',
      data: {
        entries: input.entries,
        currentEntryIndex: startIndex,
        nextItemPreview: input.nextItemPreview,
      },
    }

    return updatePresentationState({
      temporaryContent,
      currentSongSlideId: null,
      isHidden: false,
      isPresenting: true,
    })
  } catch (error) {
    log('error', `Failed to present temporary versete tineri: ${error}`)
    return getPresentationState()
  }
}
