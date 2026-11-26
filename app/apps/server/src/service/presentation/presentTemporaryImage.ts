import { updatePresentationState } from './presentation-state'
import type { PresentationState, TemporaryImageContent } from './types'

/** Puts a gallery image up, full screen on the displays. */
export function presentTemporaryImage(
  input: TemporaryImageContent,
): PresentationState {
  return updatePresentationState({
    temporaryContent: { type: 'image', data: input },
    currentSongSlideId: null,
    isHidden: false,
    isPresenting: true,
  })
}
