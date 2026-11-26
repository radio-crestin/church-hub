import { advanceVerseLoop } from './presentation-state'
import { DEFAULT_READING_WORDS_PER_MINUTE, readingTimeMs } from './reading-time'
import type { PresentationState, VerseLoopTimer } from './types'
import { createLogger } from '../../utils/logger'
import {
  broadcastPresentationState,
  broadcastVerseLoopTimer,
  onPresentationStateBroadcast,
} from '../../websocket'
import { getSetting } from '../settings'

const logger = createLogger('verse-loop')

/** app_settings key holding the reading speed, in words per minute. */
export const READING_SPEED_SETTING_KEY = 'bible_reading_speed'

/** The verse being timed: which one, its text and when it moves on. */
interface TimedVerse {
  key: string
  slideshow: string | null
  entryIndex: number
  text: string
  durationMs: number
  endsAt: number
}

let timer: ReturnType<typeof setTimeout> | null = null
let timed: TimedVerse | null = null

function readWordsPerMinute(): number {
  const value = Number(
    getSetting('app_settings', READING_SPEED_SETTING_KEY)?.value,
  )
  return value > 0 ? value : DEFAULT_READING_WORDS_PER_MINUTE
}

/** The running timer as the clients see it, or null when none runs. */
export function getVerseLoopTimer(): VerseLoopTimer | null {
  if (!timed) return null
  return {
    slideshow: timed.slideshow,
    entryIndex: timed.entryIndex,
    durationMs: timed.durationMs,
    remainingMs: Math.max(0, timed.endsAt - Date.now()),
  }
}

function stop() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!timed) return
  timed = null
  broadcastVerseLoopTimer(null)
}

/** Shows the next verse once `remainingMs` has passed, and tells the clients. */
function schedule(verse: Omit<TimedVerse, 'endsAt'>, remainingMs: number) {
  if (timer) clearTimeout(timer)
  timed = { ...verse, endsAt: Date.now() + remainingMs }
  logger.debug(`Next verse in ${Math.round(remainingMs)} ms (${verse.key})`)
  timer = setTimeout(() => {
    timer = null
    timed = null
    broadcastPresentationState(advanceVerseLoop())
  }, remainingMs)
  broadcastVerseLoopTimer(getVerseLoopTimer())
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

  const { entries, currentEntryIndex, loop, slideshow } = content.data
  const entry = entries[currentEntryIndex]
  const isLastOfRun = !loop && currentEntryIndex === entries.length - 1
  if (!entry || isLastOfRun) {
    stop()
    return
  }

  const key = `${currentEntryIndex}:${entry.reference}:${entries.length}`
  if (timer && key === timed?.key) return

  const durationMs = readingTimeMs(entry.text, readWordsPerMinute())
  schedule(
    {
      key,
      slideshow: slideshow ?? null,
      entryIndex: currentEntryIndex,
      text: entry.text,
      durationMs,
    },
    durationMs,
  )
}

/**
 * The reading speed changed: the verse on screen keeps the share of its time
 * still to go, at the new speed, and the next ones get the new time.
 */
export function rescaleVerseLoop() {
  if (!timed) return
  const left = Math.max(0, timed.endsAt - Date.now()) / timed.durationMs
  const durationMs = readingTimeMs(timed.text, readWordsPerMinute())
  schedule({ ...timed, durationMs }, left * durationMs)
}

/** Starts following the screens for looping slideshows; returns its stop. */
export function startVerseLoop(): () => void {
  const unsubscribe = onPresentationStateBroadcast(follow)
  return () => {
    unsubscribe()
    stop()
  }
}
