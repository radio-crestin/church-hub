import { updatePresentationState } from './presentation-state'
import type { PresentationState, PresentTemporaryVideoInput } from './types'

/** Puts a presentation's video item up, full screen on the displays. */
export function presentTemporaryVideo(
  input: PresentTemporaryVideoInput,
): PresentationState {
  return updatePresentationState({
    temporaryContent: { type: 'video', data: input },
    currentSongSlideId: null,
    isHidden: false,
    isPresenting: true,
  })
}
