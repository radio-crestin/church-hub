import { updatePresentationState } from './presentation-state'
import type { PresentationState, PresentTemporaryDeckSlideInput } from './types'
import { createLogger } from '../../utils/logger'

const logger = createLogger('presentation-state')

/** Puts a Slides item's slide up, with its click groups up to `buildIndex`. */
export function presentTemporaryDeckSlide(
  input: PresentTemporaryDeckSlideInput,
): PresentationState {
  logger.debug(
    `Deck item ${input.itemId}: slide ${input.slideIndex + 1}/${input.slideCount}, build ${input.buildIndex}`,
  )
  return updatePresentationState({
    temporaryContent: { type: 'deck_slide', data: input },
    currentSongSlideId: null,
    isHidden: false,
    isPresenting: true,
  })
}
