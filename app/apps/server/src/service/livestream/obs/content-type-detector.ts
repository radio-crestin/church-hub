import type { ContentType } from './content-types'
import type { PresentationState } from '../../presentation/types'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [content-type-detector] ${message}`)
}

/**
 * Detects the current content type based on presentation state
 * This is used for automatic scene switching based on what's being displayed
 */
export function detectContentType(state: PresentationState): ContentType {
  // If not presenting or hidden, return empty
  if (!state.isPresenting || state.isHidden) {
    log('debug', 'Not presenting or hidden, returning empty')
    return 'empty'
  }

  // Check for temporary content (primary presentation mechanism)
  if (state.temporaryContent) {
    const contentType = state.temporaryContent.type
    log('debug', `Temporary content type: ${contentType}`)

    if (contentType === 'song') {
      // Differentiate between scheduled and temporary songs
      const songData = state.temporaryContent.data
      if ('scheduleId' in songData && songData.scheduleId) {
        log('debug', `Song from schedule: ${songData.scheduleId}`)
        return 'song_schedule'
      }
      log('debug', 'Temporary song (not from schedule)')
      return 'song_temporary'
    }

    if (contentType === 'bible') {
      return 'bible'
    }

    if (contentType === 'bible_passage') {
      return 'bible_passage'
    }

    if (contentType === 'announcement') {
      return 'announcement'
    }

    if (contentType === 'versete_tineri') {
      return 'versete_tineri'
    }
  }

  // Check for song slide (legacy/fallback) - treat as temporary
  if (state.currentSongSlideId) {
    log('debug', `Song slide detected: ${state.currentSongSlideId}`)
    return 'song_temporary'
  }

  log('debug', 'No content type detected, returning empty')
  return 'empty'
}
