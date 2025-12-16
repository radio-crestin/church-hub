import { eq, sql } from 'drizzle-orm'

import type { PresentationState, UpdatePresentationStateInput } from './types'
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
 * Converts database record to API format
 */
function toPresentationState(
  record: typeof presentationState.$inferSelect,
): PresentationState {
  return {
    currentQueueItemId: record.currentQueueItemId,
    currentSongSlideId: record.currentSongSlideId,
    lastSongSlideId: record.lastSongSlideId,
    isPresenting: record.isPresenting,
    isHidden: record.isHidden,
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
        isPresenting: false,
        isHidden: false,
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
      isPresenting: false,
      isHidden: false,
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
    const isPresenting =
      input.isPresenting !== undefined
        ? input.isPresenting
        : current.isPresenting
    const isHidden =
      input.isHidden !== undefined ? input.isHidden : current.isHidden

    db.insert(presentationState)
      .values({
        id: 1,
        currentQueueItemId,
        currentSongSlideId,
        lastSongSlideId,
        isPresenting,
        isHidden,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: presentationState.id,
        set: {
          currentQueueItemId,
          currentSongSlideId,
          lastSongSlideId,
          isPresenting,
          isHidden,
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
  isStandaloneSlide: boolean
}[] {
  const rawDb = getRawDatabase()

  // Get all queue items with their slides
  // For song items: join song_slides
  // For slide items: use queue item id as "slide" (slideId = null)
  const results = rawDb
    .query(`
    SELECT
      pq.id as queue_item_id,
      pq.item_type,
      ss.id as slide_id
    FROM presentation_queue pq
    LEFT JOIN song_slides ss ON pq.item_type = 'song' AND ss.song_id = pq.song_id
    ORDER BY pq.sort_order ASC, ss.sort_order ASC
  `)
    .all() as {
    queue_item_id: number
    item_type: string
    slide_id: number | null
  }[]

  // Build flat list - standalone slides and bible verses appear once, songs appear for each slide
  const slides: {
    queueItemId: number
    slideId: number | null
    isStandaloneSlide: boolean
  }[] = []

  for (const r of results) {
    if (r.item_type === 'slide' || r.item_type === 'bible') {
      // Standalone slide or Bible verse - only add once (LEFT JOIN may produce multiple rows)
      if (
        !slides.some(
          (s) => s.queueItemId === r.queue_item_id && s.isStandaloneSlide,
        )
      ) {
        slides.push({
          queueItemId: r.queue_item_id,
          slideId: null,
          isStandaloneSlide: true,
        })
      }
    } else if (r.slide_id) {
      // Song slide
      slides.push({
        queueItemId: r.queue_item_id,
        slideId: r.slide_id,
        isStandaloneSlide: false,
      })
    }
  }

  return slides
}

/**
 * Navigate to next or previous slide in the queue
 * Moves through all slides (song slides and standalone slides) across all queue items
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
    // For standalone slides: match by queueItemId with null slideId
    let currentIndex = -1
    if (current.currentSongSlideId) {
      // Currently on a song slide
      currentIndex = slides.findIndex(
        (s) =>
          s.slideId === current.currentSongSlideId &&
          s.queueItemId === current.currentQueueItemId,
      )
    } else if (current.currentQueueItemId) {
      // Currently on a standalone slide (no song slide ID)
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
      isHidden: false,
    })
  } catch (error) {
    log('error', `Failed to navigate queue slide: ${error}`)
    return getPresentationState()
  }
}
