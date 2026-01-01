/**
 * Utilities for generating and managing presentation order for songs
 */

interface SlideInput {
  content: string
  sortOrder: number
  label?: string | null
}

interface SlideWithLabel extends SlideInput {
  label: string
}

interface ProcessedSlides {
  slides: SlideWithLabel[]
  presentationOrder: string
}

/**
 * Detects if a slide is a chorus based on its content
 * Choruses in Romanian typically start with "Refren:" or "Cor:"
 */
function isChorusContent(content: string): boolean {
  // Normalize content - remove HTML tags for easier matching
  const plainText = content
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase()

  // Check for common chorus indicators in Romanian
  return (
    plainText.startsWith('refren:') ||
    plainText.startsWith('refren') ||
    plainText.startsWith('cor:') ||
    plainText.startsWith('cor ')
  )
}

/**
 * Normalizes content for comparison (removes HTML, whitespace, punctuation)
 */
function normalizeContent(content: string): string {
  return content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase()
}

/**
 * Assigns labels to slides that don't have them
 * Detects unique choruses and verses, assigns V1, V2, C1, C2, etc.
 */
function assignLabelsToSlides(slides: SlideInput[]): SlideWithLabel[] {
  const result: SlideWithLabel[] = []

  // Track unique content for choruses to detect when C1 becomes C2
  const chorusContentMap = new Map<string, string>() // normalizedContent -> label (C1, C2, etc.)
  let chorusCounter = 1
  let verseCounter = 1

  for (const slide of slides) {
    let label = slide.label

    if (!label) {
      const isChorus = isChorusContent(slide.content)

      if (isChorus) {
        const normalizedContent = normalizeContent(slide.content)

        // Check if we've seen this chorus content before
        if (chorusContentMap.has(normalizedContent)) {
          label = chorusContentMap.get(normalizedContent)!
        } else {
          // New unique chorus
          label = `C${chorusCounter}`
          chorusContentMap.set(normalizedContent, label)
          chorusCounter++
        }
      } else {
        // It's a verse
        label = `V${verseCounter}`
        verseCounter++
      }
    }

    result.push({
      ...slide,
      label: label!,
    })
  }

  return result
}

/**
 * Generates presentation order string from slides with labels
 * The order follows the slide sortOrder
 */
function generatePresentationOrderString(slides: SlideWithLabel[]): string {
  const sortedSlides = [...slides].sort((a, b) => a.sortOrder - b.sortOrder)
  return sortedSlides.map((s) => s.label).join(' ')
}

/**
 * Processes slides to assign labels and generate presentation order
 * Only processes if presentationOrder is missing
 *
 * For slides without labels (PPTX imports with repeated choruses):
 * - Detects choruses and assigns labels
 * - Generates presentation order from slide order (choruses already in correct position)
 *
 * For slides with labels (OpenSong imports):
 * - Uses existing labels
 * - Generates presentation order with chorus after each verse pattern
 */
export function processSlidesPresentationOrder(
  slides: SlideInput[],
  existingPresentationOrder: string | null | undefined,
): ProcessedSlides {
  // If presentation order already exists, just return with existing labels
  if (existingPresentationOrder && existingPresentationOrder.trim()) {
    return {
      slides: slides.map((s) => ({
        ...s,
        label: s.label || `S${s.sortOrder + 1}`,
      })),
      presentationOrder: existingPresentationOrder,
    }
  }

  // Check if slides already have labels (OpenSong import)
  const hasExistingLabels = slides.some((s) => s.label)

  if (hasExistingLabels) {
    // Slides have labels - generate presentation order with chorus after each verse
    const labels = slides
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.label!)
      .filter((l) => l)
    const presentationOrder =
      generatePresentationOrderFromLabels(labels) || labels.join(' ')

    return {
      slides: slides.map((s) => ({
        ...s,
        label: s.label || `S${s.sortOrder + 1}`,
      })),
      presentationOrder,
    }
  }

  // Assign labels based on content detection (PPTX import)
  const labeledSlides = assignLabelsToSlides(slides)

  // For PPTX imports, slides are already in correct order (chorus repeated after verses)
  // So we just output the labels in slide order
  const presentationOrder = generatePresentationOrderString(labeledSlides)

  return {
    slides: labeledSlides,
    presentationOrder,
  }
}

/**
 * Generates presentation order for OpenSong-style verses that already have labels
 * If presentation order is missing, generates based on verse order with chorus after each verse
 *
 * The pattern is: V1 C1 V2 C1 V3 C1... (chorus after each verse)
 * When C2 is encountered, it replaces C1 from that point on
 */
export function generatePresentationOrderFromLabels(
  labels: string[],
): string | null {
  if (labels.length === 0) return null

  // Find all unique verse labels (V1, V2, etc.) and chorus labels (C1, C2, etc.)
  const verses: string[] = []
  const choruses: string[] = []

  for (const label of labels) {
    if (label.startsWith('V') && !verses.includes(label)) {
      verses.push(label)
    } else if (label.startsWith('C') && !choruses.includes(label)) {
      choruses.push(label)
    }
  }

  // If no choruses, just return verses in order
  if (choruses.length === 0) {
    // Check for other parts like bridges, pre-choruses, etc.
    const otherParts = labels.filter(
      (l) => !l.startsWith('V') && !verses.includes(l),
    )
    if (otherParts.length === 0) {
      return verses.join(' ')
    }
    // Return all unique labels in their original order
    const uniqueLabels: string[] = []
    for (const label of labels) {
      if (!uniqueLabels.includes(label)) {
        uniqueLabels.push(label)
      }
    }
    return uniqueLabels.join(' ')
  }

  // Sort verses numerically (V1, V2, V3...)
  verses.sort((a, b) => {
    const numA = parseInt(a.substring(1)) || 0
    const numB = parseInt(b.substring(1)) || 0
    return numA - numB
  })

  // Sort choruses numerically (C1, C2...)
  choruses.sort((a, b) => {
    const numA = parseInt(a.substring(1)) || 0
    const numB = parseInt(b.substring(1)) || 0
    return numA - numB
  })

  // Build presentation order: V1 C1 V2 C1 V3 C1... with C2 replacing C1 when encountered
  const result: string[] = []
  let currentChorusIndex = 0

  for (let i = 0; i < verses.length; i++) {
    result.push(verses[i])

    // Add chorus after each verse
    if (choruses.length > 0) {
      // Check if we should advance to next chorus
      // This happens after a certain number of verses (typically half)
      // Or we can just use C1 for all, and let C2 be used if it exists
      const chorusToUse =
        choruses[Math.min(currentChorusIndex, choruses.length - 1)]
      result.push(chorusToUse)

      // If there are multiple choruses, advance after half the verses
      if (choruses.length > 1 && i === Math.floor(verses.length / 2) - 1) {
        currentChorusIndex++
      }
    }
  }

  return result.join(' ')
}
