import {
  SCREENSHOT_NOTE_MAX_LENGTH,
  SCREENSHOT_NOTES_MAX_COUNT,
} from './constants'
import { FeatureRequestError } from './FeatureRequestError'

/**
 * The text notes the user placed on the screenshot, in order. Optional;
 * each note is one line (newlines become spaces), blank ones are dropped.
 */
export function readScreenshotNotes(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    throw new FeatureRequestError('screenshotNotes must be a list')
  }
  if (value.length > SCREENSHOT_NOTES_MAX_COUNT) {
    throw new FeatureRequestError(
      `screenshotNotes has more than ${SCREENSHOT_NOTES_MAX_COUNT} notes`
    )
  }
  return value
    .map((note) => {
      if (typeof note !== 'string') {
        throw new FeatureRequestError('screenshotNotes must be text')
      }
      const text = note.replace(/\s+/g, ' ').trim()
      if (text.length > SCREENSHOT_NOTE_MAX_LENGTH) {
        throw new FeatureRequestError(
          `a screenshot note is longer than ${SCREENSHOT_NOTE_MAX_LENGTH} characters`
        )
      }
      return text
    })
    .filter(Boolean)
}
