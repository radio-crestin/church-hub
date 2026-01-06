import { eq } from 'drizzle-orm'

import type { TextStyleRange } from './types'
import { getDatabase } from '../../db'
import { presentationState } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [highlights] ${message}`)
}

/**
 * Parses slide highlights from JSON string
 */
export function parseSlideHighlights(json: string | null): TextStyleRange[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Gets current slide highlights
 */
export function getSlideHighlights(): TextStyleRange[] {
  try {
    const db = getDatabase()
    const record = db
      .select({ slideHighlights: presentationState.slideHighlights })
      .from(presentationState)
      .where(eq(presentationState.id, 1))
      .get()

    return parseSlideHighlights(record?.slideHighlights ?? null)
  } catch (error) {
    log('error', `Failed to get slide highlights: ${error}`)
    return []
  }
}

/**
 * Adds a highlight to the current slide
 */
export function addSlideHighlight(range: TextStyleRange): TextStyleRange[] {
  try {
    log('debug', `Adding slide highlight: ${range.id}`)

    const db = getDatabase()
    const current = getSlideHighlights()

    // Add new highlight
    const updated = [...current, range]
    const json = JSON.stringify(updated)

    db.update(presentationState)
      .set({ slideHighlights: json })
      .where(eq(presentationState.id, 1))
      .run()

    log('info', `Added highlight ${range.id}, total: ${updated.length}`)
    return updated
  } catch (error) {
    log('error', `Failed to add slide highlight: ${error}`)
    return getSlideHighlights()
  }
}

/**
 * Removes a highlight by ID
 */
export function removeSlideHighlight(id: string): TextStyleRange[] {
  try {
    log('debug', `Removing slide highlight: ${id}`)

    const db = getDatabase()
    const current = getSlideHighlights()

    // Filter out the highlight
    const updated = current.filter((h) => h.id !== id)

    if (updated.length === current.length) {
      log('warning', `Highlight not found: ${id}`)
      return current
    }

    const json = updated.length > 0 ? JSON.stringify(updated) : null

    db.update(presentationState)
      .set({ slideHighlights: json })
      .where(eq(presentationState.id, 1))
      .run()

    log('info', `Removed highlight ${id}, remaining: ${updated.length}`)
    return updated
  } catch (error) {
    log('error', `Failed to remove slide highlight: ${error}`)
    return getSlideHighlights()
  }
}

/**
 * Clears all slide highlights
 */
export function clearSlideHighlights(): void {
  try {
    log('debug', 'Clearing all slide highlights')

    const db = getDatabase()

    db.update(presentationState)
      .set({ slideHighlights: null })
      .where(eq(presentationState.id, 1))
      .run()

    log('info', 'Cleared all highlights')
  } catch (error) {
    log('error', `Failed to clear slide highlights: ${error}`)
  }
}
