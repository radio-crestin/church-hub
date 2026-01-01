/**
 * Utility for expanding song slides with chorus insertion between verses
 *
 * This preserves the original slide order and inserts choruses after verses:
 * - Follows the original slide order
 * - After each verse (V1, V2, etc.), inserts the current chorus (C1)
 * - When C2 appears in the original order, it becomes the new "current chorus"
 *
 * Example:
 * Input slides: [C1, V1, V2, V3, C2]
 * Output order: [C1, V1, C1, V2, C1, V3, C2]
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
 * Expands slides by inserting choruses after each verse
 * Preserves the original slide order
 *
 * @param slides - The original slides sorted by sortOrder
 * @returns Expanded slides with choruses inserted after each verse
 */
export function expandSongSlidesWithChoruses(
  slides: SlideWithLabel[],
): ExpandedSlide[] {
  if (slides.length === 0) {
    return []
  }

  // Check if any slides have labels
  const hasLabels = slides.some((s) => s.label)
  if (!hasLabels) {
    return slides.map((s, i) => ({ ...s, originalIndex: i }))
  }

  // Find all chorus slides (sorted by their number for reference)
  const chorusSlides = slides
    .filter((s) => s.label?.startsWith('C'))
    .sort((a, b) => {
      const numA = parseInt(a.label?.substring(1) || '0') || 0
      const numB = parseInt(b.label?.substring(1) || '0') || 0
      return numA - numB
    })

  // If no choruses, return original order
  if (chorusSlides.length === 0) {
    return slides.map((s, i) => ({ ...s, originalIndex: i }))
  }

  // Check if there are any verses
  const hasVerses = slides.some((s) => s.label?.startsWith('V'))
  if (!hasVerses) {
    return slides.map((s, i) => ({ ...s, originalIndex: i }))
  }

  // Build expanded slides following original order, inserting chorus after verses
  const expandedSlides: ExpandedSlide[] = []
  let currentChorus: SlideWithLabel | null = null
  const originalIndexMap = new Map(slides.map((s, i) => [s.id, i]))

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const isVerse = slide.label?.startsWith('V')
    const isChorus = slide.label?.startsWith('C')

    // Add the current slide
    expandedSlides.push({
      ...slide,
      originalIndex: originalIndexMap.get(slide.id) ?? i,
    })

    // If this is a chorus, update the current chorus reference
    if (isChorus) {
      currentChorus = slide
    }

    // If this is a verse and we have a chorus, insert it after
    // But don't insert if the next slide is a chorus (it replaces the current one)
    if (isVerse && currentChorus) {
      const nextSlide = slides[i + 1]
      const nextIsChorus = nextSlide?.label?.startsWith('C')

      if (!nextIsChorus) {
        expandedSlides.push({
          ...currentChorus,
          originalIndex: originalIndexMap.get(currentChorus.id) ?? 0,
        })
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
