import type { SlideDeck } from '~/features/slides-deck/types'
import { deckSlideText } from '~/features/slides-deck/utils/deckSlideText'
import { deckStepSeconds } from '~/features/slides-deck/utils/deckStepSeconds'
import { deckSteps } from '~/features/slides-deck/utils/deckSteps'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import type { ScheduleFlatItem } from './scheduleFlatItems'
import type { VideoItemConfig } from '../media-items/types'
import type { ScheduleAutomationSettings } from '../types'

/** A room reads about 180 words a minute off a screen. */
const WORDS_PER_SECOND = 3
/** Time to look up and find the start of a new slide. */
const LOOK_UP_SECONDS = 2

/** The presentation's timing while autoplay is on. */
export type AutoplayTiming = Pick<
  ScheduleAutomationSettings,
  'autoplayByText'
> & { autoplaySeconds: number }

/**
 * How long a step stays up while its presentation runs by itself, like
 * PowerPoint's "advance after": the item's own time when it has one, else the
 * presentation's seconds per slide, longer for a slide with more text when
 * `autoplayByText` is on; a Slides item's step, its slide's own time and as
 * long as its effects play. The server's `stepSeconds` is what runs it; this
 * mirror shows the same times beside each item.
 */
export function stepSeconds(
  step: ScheduleFlatItem,
  automation: AutoplayTiming,
): number {
  if (step.item.advanceSeconds != null) return step.item.advanceSeconds
  if (step.type === 'deck') {
    return deckStepSeconds(
      step.item.itemConfig as SlideDeck,
      step.index,
      readingSeconds(step, automation),
    )
  }
  // A video stays up until it ends, unless it loops.
  const loops = (step.item.itemConfig as VideoItemConfig | null)?.loop
  if (step.type === 'video' && !loops && step.item.video?.seconds) {
    return Math.ceil(step.item.video.seconds)
  }
  return readingSeconds(step, automation)
}

/** The presentation's seconds per slide, longer for more text when it reads by text. */
function readingSeconds(
  step: ScheduleFlatItem,
  automation: AutoplayTiming,
): number {
  if (!automation.autoplayByText) return automation.autoplaySeconds
  const words = stepText(step).split(/\s+/).filter(Boolean).length
  return Math.max(
    automation.autoplaySeconds,
    Math.ceil(LOOK_UP_SECONDS + words / WORDS_PER_SECOND),
  )
}

/** The words a step shows, without markup. */
function stepText({ item, type, index }: ScheduleFlatItem): string {
  switch (type) {
    case 'slide':
      return plainText(
        expandSongSlidesWithChoruses(item.slides)[index]?.content ?? '',
      )
    case 'verse':
      return item.biblePassageVerses[index]?.text ?? ''
    case 'entry':
      return item.verseteTineriEntries[index]?.text ?? ''
    case 'announcement':
      return plainText(item.slideContent ?? '')
    case 'deck': {
      const deck = item.itemConfig as SlideDeck
      const slide = deck.slides[deckSteps(deck)[index]?.slideIndex ?? -1]
      return slide ? deckSlideText(slide) : ''
    }
    case 'scene':
    case 'video':
      return ''
  }
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
}
