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

import type { SongSlide } from '../types'

export interface ExpandedSlide extends SongSlide {
  originalIndex: number
  displayIndex: number
}

/**
 * Expands slides by inserting choruses after each verse
 * Preserves the original slide order
 *
 * @param slides - The original slides
 * @returns Expanded slides with choruses inserted after each verse
 */
export function expandSongSlidesWithChoruses(
  slides: SongSlide[],
): ExpandedSlide[] {
  if (slides.length === 0) {
    return []
  }

  // Sort by sortOrder first
  const sortedSlides = [...slides].sort((a, b) => a.sortOrder - b.sortOrder)

  // Check if any slides have labels
  const hasLabels = sortedSlides.some((s) => s.label)
  if (!hasLabels) {
    return sortedSlides.map((s, i) => ({
      ...s,
      originalIndex: i,
      displayIndex: i,
    }))
  }

  // Check if there are any choruses
  const hasChorus = sortedSlides.some((s) => s.label?.startsWith('C'))
  if (!hasChorus) {
    return sortedSlides.map((s, i) => ({
      ...s,
      originalIndex: i,
      displayIndex: i,
    }))
  }

  // Check if there are any verses
  const hasVerses = sortedSlides.some((s) => s.label?.startsWith('V'))
  if (!hasVerses) {
    return sortedSlides.map((s, i) => ({
      ...s,
      originalIndex: i,
      displayIndex: i,
    }))
  }

  // Build expanded slides following original order, inserting chorus after verses
  const expandedSlides: ExpandedSlide[] = []
  let currentChorus: SongSlide | null = null
  const originalIndexMap = new Map(sortedSlides.map((s, i) => [s.id, i]))

  for (let i = 0; i < sortedSlides.length; i++) {
    const slide = sortedSlides[i]
    const isVerse = slide.label?.startsWith('V')
    const isChorus = slide.label?.startsWith('C')

    // Add the current slide
    expandedSlides.push({
      ...slide,
      originalIndex: originalIndexMap.get(slide.id) ?? i,
      displayIndex: expandedSlides.length,
    })

    // If this is a chorus, update the current chorus reference
    if (isChorus) {
      currentChorus = slide
    }

    // If this is a verse and we have a chorus, insert it after
    // But don't insert if the next slide is a chorus (it replaces the current one)
    if (isVerse && currentChorus) {
      const nextSlide = sortedSlides[i + 1]
      const nextIsChorus = nextSlide?.label?.startsWith('C')

      if (!nextIsChorus) {
        expandedSlides.push({
          ...currentChorus,
          originalIndex: originalIndexMap.get(currentChorus.id) ?? 0,
          displayIndex: expandedSlides.length,
        })
      }
    }
  }

  return expandedSlides
}

/**
 * Generates the presentation order string with choruses inserted after verses
 * Used for OpenSong export format
 *
 * @param slides - The original slides
 * @returns Presentation order string (e.g., "C1 V1 C1 V2 C1 V3 C2")
 */
export function generateExpandedPresentationOrder(slides: SongSlide[]): string {
  if (slides.length === 0) {
    return ''
  }

  // Sort by sortOrder first
  const sortedSlides = [...slides].sort((a, b) => a.sortOrder - b.sortOrder)

  // Check if any slides have labels
  const hasLabels = sortedSlides.some((s) => s.label)
  if (!hasLabels) {
    return ''
  }

  // Check if there are any choruses
  const hasChorus = sortedSlides.some((s) => s.label?.startsWith('C'))
  if (!hasChorus) {
    // Return original order labels
    return sortedSlides
      .filter((s) => s.label)
      .map((s) => s.label)
      .join(' ')
  }

  // Check if there are any verses
  const hasVerses = sortedSlides.some((s) => s.label?.startsWith('V'))
  if (!hasVerses) {
    return sortedSlides
      .filter((s) => s.label)
      .map((s) => s.label)
      .join(' ')
  }

  // Build presentation order with chorus insertions
  const orderParts: string[] = []
  let currentChorusLabel: string | null = null

  for (let i = 0; i < sortedSlides.length; i++) {
    const slide = sortedSlides[i]
    const isVerse = slide.label?.startsWith('V')
    const isChorus = slide.label?.startsWith('C')

    // Add the current slide's label
    if (slide.label) {
      orderParts.push(slide.label)
    }

    // If this is a chorus, update the current chorus reference
    if (isChorus && slide.label) {
      currentChorusLabel = slide.label
    }

    // If this is a verse and we have a chorus, insert it after
    // But don't insert if the next slide is a chorus (it replaces the current one)
    if (isVerse && currentChorusLabel) {
      const nextSlide = sortedSlides[i + 1]
      const nextIsChorus = nextSlide?.label?.startsWith('C')

      if (!nextIsChorus) {
        orderParts.push(currentChorusLabel)
      }
    }
  }

  return orderParts.join(' ')
}
