import type {
  NavigateInput,
  PresentationState,
  PresentationStateRecord,
  UpdatePresentationStateInput,
} from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [presentation-state] ${message}`)
}

/**
 * Converts database record to API format
 */
function toPresentationState(
  record: PresentationStateRecord,
): PresentationState {
  return {
    programId: record.program_id,
    currentSlideId: record.current_slide_id,
    lastSlideId: record.last_slide_id,
    currentQueueItemId: record.current_queue_item_id,
    currentSongSlideId: record.current_song_slide_id,
    lastSongSlideId: record.last_song_slide_id,
    isPresenting: record.is_presenting === 1,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets the current presentation state
 */
export function getPresentationState(): PresentationState {
  try {
    log('debug', 'Getting presentation state')

    const db = getDatabase()
    const query = db.query('SELECT * FROM presentation_state WHERE id = 1')
    const record = query.get() as PresentationStateRecord | null

    if (!record) {
      // Return default state if not found
      return {
        programId: null,
        currentSlideId: null,
        lastSlideId: null,
        currentQueueItemId: null,
        currentSongSlideId: null,
        lastSongSlideId: null,
        isPresenting: false,
        updatedAt: Date.now(),
      }
    }

    return toPresentationState(record)
  } catch (error) {
    log('error', `Failed to get presentation state: ${error}`)
    return {
      programId: null,
      currentSlideId: null,
      lastSlideId: null,
      currentQueueItemId: null,
      currentSongSlideId: null,
      lastSongSlideId: null,
      isPresenting: false,
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
    const now = Date.now() // Use milliseconds for finer granularity
    const current = getPresentationState()

    const programId =
      input.programId !== undefined ? input.programId : current.programId
    const currentSlideId =
      input.currentSlideId !== undefined
        ? input.currentSlideId
        : current.currentSlideId
    const lastSlideId =
      input.lastSlideId !== undefined ? input.lastSlideId : current.lastSlideId
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

    const query = db.query(`
      INSERT INTO presentation_state (id, program_id, current_slide_id, last_slide_id, current_queue_item_id, current_song_slide_id, last_song_slide_id, is_presenting, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        program_id = excluded.program_id,
        current_slide_id = excluded.current_slide_id,
        last_slide_id = excluded.last_slide_id,
        current_queue_item_id = excluded.current_queue_item_id,
        current_song_slide_id = excluded.current_song_slide_id,
        last_song_slide_id = excluded.last_song_slide_id,
        is_presenting = excluded.is_presenting,
        updated_at = excluded.updated_at
    `)
    query.run(
      programId,
      currentSlideId,
      lastSlideId,
      currentQueueItemId,
      currentSongSlideId,
      lastSongSlideId,
      isPresenting ? 1 : 0,
      now,
    )

    log('info', 'Presentation state updated')
    return getPresentationState()
  } catch (error) {
    log('error', `Failed to update presentation state: ${error}`)
    return getPresentationState()
  }
}

/**
 * Gets ordered slide IDs for the current program
 */
function getOrderedSlideIds(programId: number): number[] {
  const db = getDatabase()
  const query = db.query(
    'SELECT id FROM slides WHERE program_id = ? ORDER BY sort_order ASC',
  )
  const results = query.all(programId) as { id: number }[]
  return results.map((r) => r.id)
}

/**
 * Navigate to next, previous, or specific slide
 */
export function navigateSlide(input: NavigateInput): PresentationState {
  try {
    log('debug', `Navigating slide: ${input.direction}`)

    const current = getPresentationState()

    if (input.direction === 'goto' && input.slideId !== undefined) {
      // Set both currentSlideId and lastSlideId when going to a specific slide
      return updatePresentationState({
        currentSlideId: input.slideId,
        lastSlideId: input.slideId,
      })
    }

    if (!current.programId) {
      log('warning', 'Cannot navigate: no program selected')
      return current
    }

    const slideIds = getOrderedSlideIds(current.programId)
    if (slideIds.length === 0) {
      log('warning', 'Cannot navigate: no slides in program')
      return current
    }

    const currentIndex = current.currentSlideId
      ? slideIds.indexOf(current.currentSlideId)
      : -1

    let newIndex: number

    if (input.direction === 'next') {
      newIndex = currentIndex + 1
      if (newIndex >= slideIds.length) {
        newIndex = slideIds.length - 1 // Stay on last slide
      }
    } else {
      // prev
      newIndex = currentIndex - 1
      if (newIndex < 0) {
        newIndex = 0 // Stay on first slide
      }
    }

    const newSlideId = slideIds[newIndex]
    // Set both currentSlideId and lastSlideId when navigating
    return updatePresentationState({
      currentSlideId: newSlideId,
      lastSlideId: newSlideId,
    })
  } catch (error) {
    log('error', `Failed to navigate slide: ${error}`)
    return getPresentationState()
  }
}

/**
 * Starts presenting a program
 */
export function startPresentation(programId: number): PresentationState {
  try {
    log('debug', `Starting presentation for program: ${programId}`)

    const slideIds = getOrderedSlideIds(programId)
    const firstSlideId = slideIds.length > 0 ? slideIds[0] : null

    return updatePresentationState({
      programId,
      currentSlideId: firstSlideId,
      lastSlideId: firstSlideId,
      isPresenting: true,
    })
  } catch (error) {
    log('error', `Failed to start presentation: ${error}`)
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
      currentSlideId: null,
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
    log('debug', 'Clearing current slide')

    const current = getPresentationState()

    // Save current song slide ID for restoration, then clear current display
    return updatePresentationState({
      currentSlideId: null,
      currentSongSlideId: null,
      // Save the current song slide ID so we can restore the exact slide
      lastSongSlideId: current.currentSongSlideId ?? current.lastSongSlideId,
    })
  } catch (error) {
    log('error', `Failed to clear slide: ${error}`)
    return getPresentationState()
  }
}

/**
 * Shows the last displayed slide (restores from hidden state)
 * Restores either program slide or song slide depending on what was last shown
 */
export function showSlide(): PresentationState {
  try {
    log('debug', 'Showing last slide')

    const current = getPresentationState()

    // Priority 1: Restore from lastSongSlideId if available (exact slide that was hidden)
    if (current.lastSongSlideId) {
      return updatePresentationState({
        currentSongSlideId: current.lastSongSlideId,
      })
    }

    // Priority 2: If we have a queue item, check if it's a standalone slide or song
    if (current.currentQueueItemId) {
      const db = getDatabase()

      // Check if this is a standalone slide
      const queueItemQuery = db.query(
        'SELECT item_type FROM presentation_queue WHERE id = ?',
      )
      const queueItem = queueItemQuery.get(current.currentQueueItemId) as {
        item_type: string
      } | null

      if (queueItem?.item_type === 'slide') {
        // Standalone slide - it's already "shown" by having currentQueueItemId set
        // The frontend detects standalone slides by having currentQueueItemId but no currentSongSlideId
        // We just need to ensure the state is correct
        log('debug', 'Standalone slide is already shown via currentQueueItemId')
        return current
      }

      // It's a song - get the first slide as fallback
      const slideQuery = db.query(`
        SELECT ss.id
        FROM song_slides ss
        JOIN presentation_queue pq ON pq.song_id = ss.song_id
        WHERE pq.id = ?
        ORDER BY ss.sort_order ASC
        LIMIT 1
      `)
      const result = slideQuery.get(current.currentQueueItemId) as {
        id: number
      } | null
      if (result) {
        return updatePresentationState({
          currentSongSlideId: result.id,
        })
      }
    }

    // Priority 3: Fall back to program slide
    if (current.lastSlideId) {
      return updatePresentationState({
        currentSlideId: current.lastSlideId,
      })
    }

    log('warning', 'Cannot show slide: no slide to restore')
    return current
  } catch (error) {
    log('error', `Failed to show slide: ${error}`)
    return getPresentationState()
  }
}

/**
 * Gets all slides in queue order (both song slides and standalone slides)
 * Returns a flat list for navigation
 */
function getQueueSlides(): {
  queueItemId: number
  slideId: number | null
  isStandaloneSlide: boolean
}[] {
  const db = getDatabase()

  // Get all queue items with their slides
  // For song items: join song_slides
  // For slide items: use queue item id as "slide" (slideId = null)
  const query = db.query(`
    SELECT
      pq.id as queue_item_id,
      pq.item_type,
      ss.id as slide_id
    FROM presentation_queue pq
    LEFT JOIN song_slides ss ON pq.item_type = 'song' AND ss.song_id = pq.song_id
    ORDER BY pq.sort_order ASC, ss.sort_order ASC
  `)

  const results = query.all() as {
    queue_item_id: number
    item_type: string
    slide_id: number | null
  }[]

  // Build flat list - standalone slides appear once, songs appear for each slide
  const slides: {
    queueItemId: number
    slideId: number | null
    isStandaloneSlide: boolean
  }[] = []

  for (const r of results) {
    if (r.item_type === 'slide') {
      // Standalone slide - only add once (LEFT JOIN may produce multiple rows)
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
        newIndex = slides.length - 1 // Stay on last slide
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
    })
  } catch (error) {
    log('error', `Failed to navigate queue slide: ${error}`)
    return getPresentationState()
  }
}
