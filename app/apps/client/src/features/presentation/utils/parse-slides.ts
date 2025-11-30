import type { SlideContent } from '../service/types'

/**
 * Parse HTML content into slides based on slide-break markers.
 * Slides are separated by <div data-slide-break> elements.
 */
export function parseSlides(htmlContent: string): SlideContent[] {
  if (!htmlContent || htmlContent.trim() === '') {
    return []
  }

  // Split by slide break markers
  const parts = htmlContent.split(/<div[^>]*data-slide-break[^>]*><\/div>/gi)

  const slides: SlideContent[] = []

  parts.forEach((part) => {
    const trimmedPart = part.trim()
    if (!trimmedPart) return

    // Create a temporary div to extract plain text
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = trimmedPart

    const plainText = tempDiv.textContent || ''

    slides.push({
      index: slides.length,
      content: trimmedPart,
      plainText: plainText.trim(),
    })
  })

  // If no slides were created but there's content, create a single slide
  if (slides.length === 0 && htmlContent.trim()) {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent

    slides.push({
      index: 0,
      content: htmlContent,
      plainText: (tempDiv.textContent || '').trim(),
    })
  }

  return slides
}

/**
 * Get the title from the first slide's content
 */
export function getTitleFromSlides(slides: SlideContent[]): string {
  if (slides.length === 0) return ''

  const firstSlide = slides[0]
  // Get first non-empty line from plain text
  const lines = firstSlide.plainText.split('\n').filter((l) => l.trim())
  return lines[0] || ''
}
