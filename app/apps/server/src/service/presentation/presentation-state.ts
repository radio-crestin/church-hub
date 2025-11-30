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
        isPresenting: false,
        updatedAt: Math.floor(Date.now() / 1000),
      }
    }

    return toPresentationState(record)
  } catch (error) {
    log('error', `Failed to get presentation state: ${error}`)
    return {
      programId: null,
      currentSlideId: null,
      isPresenting: false,
      updatedAt: Math.floor(Date.now() / 1000),
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
    const now = Math.floor(Date.now() / 1000)
    const current = getPresentationState()

    const programId =
      input.programId !== undefined ? input.programId : current.programId
    const currentSlideId =
      input.currentSlideId !== undefined
        ? input.currentSlideId
        : current.currentSlideId
    const isPresenting =
      input.isPresenting !== undefined
        ? input.isPresenting
        : current.isPresenting

    const query = db.query(`
      INSERT INTO presentation_state (id, program_id, current_slide_id, is_presenting, updated_at)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        program_id = excluded.program_id,
        current_slide_id = excluded.current_slide_id,
        is_presenting = excluded.is_presenting,
        updated_at = excluded.updated_at
    `)
    query.run(programId, currentSlideId, isPresenting ? 1 : 0, now)

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
      return updatePresentationState({ currentSlideId: input.slideId })
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
    return updatePresentationState({ currentSlideId: newSlideId })
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
    })
  } catch (error) {
    log('error', `Failed to stop presentation: ${error}`)
    return getPresentationState()
  }
}

/**
 * Clears the current slide (shows blank/clock)
 */
export function clearSlide(): PresentationState {
  try {
    log('debug', 'Clearing current slide')

    return updatePresentationState({
      currentSlideId: null,
    })
  } catch (error) {
    log('error', `Failed to clear slide: ${error}`)
    return getPresentationState()
  }
}
