import type { ChordMapping } from '~/features/songs/types'

interface SlideWithChords {
  content: string
  chords?: ChordMapping[] | null
  label?: string | null
}

/**
 * Resolves which chords to use for a given slide.
 *
 * Priority:
 * 1. The slide's own chords (if it has any)
 * 2. Chords from another slide with the same label
 * 3. Fallback: odd slides (0-indexed) use first slide's chords,
 *    even slides use second slide's chords
 */
export function resolveSlideChords(
  slideIndex: number,
  slides: SlideWithChords[],
): ChordMapping[] | null {
  const currentSlide = slides[slideIndex]
  if (!currentSlide) return null

  // 1. Own chords
  if (currentSlide.chords && currentSlide.chords.length > 0) {
    return currentSlide.chords
  }

  // 2. Match by label - find the first slide with the same label that has chords
  if (currentSlide.label) {
    for (const slide of slides) {
      if (
        slide.label === currentSlide.label &&
        slide.chords &&
        slide.chords.length > 0
      ) {
        return slide.chords
      }
    }
  }

  // 3. Fallback: odd/even pattern using first two slides with chords
  const slidesWithChords = slides.filter((s) => s.chords && s.chords.length > 0)
  if (slidesWithChords.length === 0) return null

  if (slidesWithChords.length === 1) {
    // Only one slide has chords - use it for all
    return slidesWithChords[0].chords!
  }

  // Odd index (1, 3, 5...) -> second chord set, even index (0, 2, 4...) -> first chord set
  const patternIndex = slideIndex % 2 === 0 ? 0 : 1
  return slidesWithChords[patternIndex]?.chords ?? slidesWithChords[0].chords!
}
