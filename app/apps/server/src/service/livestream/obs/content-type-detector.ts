import type { ContentType } from './content-types'
import type { PresentationState } from '../../presentation/types'
import { getQueueItemById } from '../../queue'

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
export async function detectContentType(
  state: PresentationState,
): Promise<ContentType> {
  // If not presenting or hidden, return empty
  if (!state.isPresenting || state.isHidden) {
    log('debug', 'Not presenting or hidden, returning empty')
    return 'empty'
  }

  // Check for song slide
  if (state.currentSongSlideId) {
    log('debug', `Song slide detected: ${state.currentSongSlideId}`)
    return 'song'
  }

  // Check for versete tineri entry
  if (state.currentVerseteTineriEntryId) {
    log(
      'debug',
      `Versete tineri entry detected: ${state.currentVerseteTineriEntryId}`,
    )
    return 'versete_tineri'
  }

  // Check for bible passage verse
  if (state.currentBiblePassageVerseId) {
    log(
      'debug',
      `Bible passage verse detected: ${state.currentBiblePassageVerseId}`,
    )
    return 'bible_passage'
  }

  // Check queue item for other types
  if (state.currentQueueItemId) {
    try {
      const queueItem = getQueueItemById(state.currentQueueItemId)
      if (queueItem) {
        log('debug', `Queue item type: ${queueItem.itemType}`)

        if (queueItem.itemType === 'bible') {
          return 'bible'
        }

        if (queueItem.itemType === 'slide') {
          // Check if it's a versete_tineri slide type
          if (queueItem.slideType === 'versete_tineri') {
            return 'versete_tineri'
          }
          // Otherwise it's an announcement
          return 'announcement'
        }
      }
    } catch (error) {
      log('error', `Failed to get queue item: ${error}`)
    }
  }

  log('debug', 'No content type detected, returning empty')
  return 'empty'
}
