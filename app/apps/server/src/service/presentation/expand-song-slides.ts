/**
 * Utility for expanding song slides with chorus insertion between verses
 *
 * This generates the presentation order dynamically:
 * - Verses (V1, V2, V3, etc.) are displayed in order
 * - Chorus (C1) is inserted after each verse
 * - When C2 appears, it replaces C1 from that point on
 *
 * Example:
 * Input slides: [C1, V1, V2, V3, C2]
 * Output order: [V1, C1, V2, C1, V3, C2]
 */

interface SlideWithLabel {
  id: number
  content: string
  sortOrder: number
  label: string | null
}

interface ExpandedSlide {
  id: number
  content: string
  sortOrder: number
  label: string | null
  originalIndex: number
}

/**
 * Expands slides to insert choruses between verses
 *
 * @param slides - The original slides sorted by sortOrder
 * @returns Expanded slides with choruses inserted after each verse
 */
export function expandSongSlidesWithChoruses(
  slides: SlideWithLabel[],
): ExpandedSlide[] {
  // If no slides or no labels, return as-is
  if (slides.length === 0) {
    return []
  }

  // Check if any slides have labels
  const hasLabels = slides.some((s) => s.label)
  if (!hasLabels) {
    // No labels - return slides in original order
    return slides.map((s, i) => ({ ...s, originalIndex: i }))
  }

  // Separate slides by type based on labels
  const verses: SlideWithLabel[] = []
  const choruses: SlideWithLabel[] = []
  const otherSlides: SlideWithLabel[] = []

  for (const slide of slides) {
    if (!slide.label) {
      otherSlides.push(slide)
    } else if (slide.label.startsWith('V')) {
      verses.push(slide)
    } else if (slide.label.startsWith('C')) {
      choruses.push(slide)
    } else {
      otherSlides.push(slide)
    }
  }

  // If no verses or no choruses, return original order
  if (verses.length === 0 || choruses.length === 0) {
    return slides.map((s, i) => ({ ...s, originalIndex: i }))
  }

  // Sort verses by their number (V1, V2, V3...)
  verses.sort((a, b) => {
    const numA = parseInt(a.label?.substring(1) || '0') || 0
    const numB = parseInt(b.label?.substring(1) || '0') || 0
    return numA - numB
  })

  // Sort choruses by their number (C1, C2...)
  choruses.sort((a, b) => {
    const numA = parseInt(a.label?.substring(1) || '0') || 0
    const numB = parseInt(b.label?.substring(1) || '0') || 0
    return numA - numB
  })

  // Build expanded slide order: V1 C1 V2 C1 V3 C2...
  const expandedSlides: ExpandedSlide[] = []
  let chorusIndex = 0
  const originalIndexMap = new Map(slides.map((s, i) => [s.id, i]))

  for (let i = 0; i < verses.length; i++) {
    const verse = verses[i]
    expandedSlides.push({
      ...verse,
      originalIndex: originalIndexMap.get(verse.id) ?? i,
    })

    // Add current chorus after each verse
    if (choruses.length > 0) {
      const chorus = choruses[Math.min(chorusIndex, choruses.length - 1)]
      expandedSlides.push({
        ...chorus,
        originalIndex: originalIndexMap.get(chorus.id) ?? 0,
      })

      // Advance to next chorus after half the verses (if there are multiple choruses)
      if (choruses.length > 1 && i === Math.floor(verses.length / 2) - 1) {
        chorusIndex++
      }
    }
  }

  return expandedSlides
}

/**
 * Gets the original slide index from an expanded slide index
 * This is used for navigation to map back to the actual slide data
 */
export function getOriginalSlideIndex(
  expandedSlides: ExpandedSlide[],
  expandedIndex: number,
): number {
  if (expandedIndex < 0 || expandedIndex >= expandedSlides.length) {
    return 0
  }
  return expandedSlides[expandedIndex].originalIndex
}
