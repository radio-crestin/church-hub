import {
  useClearTemporaryContent,
  usePresentationState,
  usePresentTemporaryVerseteTineri,
} from '~/features/presentation'
import type { VerseteTineriEntry } from '~/features/presentation/types'
import { getVerseSlideshow } from '../utils/getVerseSlideshow'

/**
 * `manual`: stepped with the arrows; `once`: on by itself to the last verse;
 * `loop`: on by itself and over again.
 */
export type VerseSlideshowMode = 'manual' | 'once' | 'loop'

/**
 * Shows a list's verses on screen one after another as a Versete Biblice
 * slide. Played (`once`, `loop`), each stays up for its reading time (its
 * words at the reading speed of Settings, Bible), then the server shows the
 * next one; `loop` starts over after the last, `once` stays on it. `slideshow` names the list, so its panel
 * knows the slideshow on screen is its own.
 */
export function useVerseSlideshow(
  slideshow: string,
  entries: VerseteTineriEntry[],
) {
  const { data: state } = usePresentationState()
  const present = usePresentTemporaryVerseteTineri()
  const clear = useClearTemporaryContent()
  const playing = getVerseSlideshow(state, slideshow)

  const start = (mode: VerseSlideshowMode, fromIndex = 0) => {
    if (entries.length === 0) return
    present.mutate({
      entries,
      currentEntryIndex: fromIndex,
      loop: mode === 'loop',
      autoAdvance: mode === 'once',
      slideshow,
    })
  }

  return {
    isPlaying: playing !== null,
    isLooping: !!playing?.loop,
    isAutoAdvancing: !!playing?.autoAdvance,
    position: playing
      ? { index: playing.currentEntryIndex, count: playing.entries.length }
      : null,
    start,
    stop: () => clear.mutate(),
  }
}
