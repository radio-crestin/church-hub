import { advanceVerseLoop } from './presentation-state'
import { DEFAULT_READING_WORDS_PER_MINUTE, readingTimeMs } from './reading-time'
import type { PresentationState } from './types'
import { createLogger } from '../../utils/logger'
import {
  broadcastPresentationState,
  onPresentationStateBroadcast,
} from '../../websocket'
import { getSetting } from '../settings'

const logger = createLogger('verse-loop')

/** app_settings key holding the reading speed, in words per minute. */
export const READING_SPEED_SETTING_KEY = 'bible_reading_speed'

let timer: ReturnType<typeof setTimeout> | null = null
/** The verse the running timer is for, so a re-broadcast of it keeps it. */
let timedVerse: string | null = null

function readWordsPerMinute(): number {
  const value = Number(
    getSetting('app_settings', READING_SPEED_SETTING_KEY)?.value,
  )
  return value > 0 ? value : DEFAULT_READING_WORDS_PER_MINUTE
}

function stop() {
  if (timer) clearTimeout(timer)
  timer = null
  timedVerse = null
}

/**
 * Times the verse on screen when a looping or auto-advancing Versete Biblice
 * slideshow shows one: after its reading time, the next verse goes up. An
 * auto-advancing one stays on its last verse. Anything else on screen, or a
 * hidden screen, stops the timer.
 */
function follow(state: PresentationState) {
  const content = state.temporaryContent
  if (
    state.isHidden ||
    content?.type !== 'versete_tineri' ||
    !(content.data.loop || content.data.autoAdvance)
  ) {
    stop()
    return
  }

  const { entries, currentEntryIndex, loop } = content.data
  const entry = entries[currentEntryIndex]
  const isLastOfRun = !loop && currentEntryIndex === entries.length - 1
  if (!entry || isLastOfRun) {
    stop()
    return
  }

  const verse = `${currentEntryIndex}:${entry.reference}:${entries.length}`
  if (timer && verse === timedVerse) return

  stop()
  const delay = readingTimeMs(entry.text, readWordsPerMinute())
  logger.debug(`Next verse in ${Math.round(delay)} ms (${entry.reference})`)
  timedVerse = verse
  timer = setTimeout(() => {
    timer = null
    timedVerse = null
    broadcastPresentationState(advanceVerseLoop())
  }, delay)
}

/** Starts following the screens for looping slideshows; returns its stop. */
export function startVerseLoop(): () => void {
  const unsubscribe = onPresentationStateBroadcast(follow)
  return () => {
    unsubscribe()
    stop()
  }
}
