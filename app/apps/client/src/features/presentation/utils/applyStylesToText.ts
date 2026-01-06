import type { TextStyleRange } from '../types'

interface StyleMarker {
  position: number
  isStart: boolean
  range: TextStyleRange
}

/**
 * Apply text style ranges to plain text, returning HTML with styling tags
 *
 * @param text - Plain text content
 * @param ranges - Array of style ranges to apply
 * @returns HTML string with styling tags applied
 */
export function applyStylesToText(
  text: string,
  ranges: TextStyleRange[],
): string {
  if (!ranges || ranges.length === 0) {
    return text
  }

  // Create markers for all style boundaries
  const markers: StyleMarker[] = []

  for (const range of ranges) {
    // Clamp to text bounds
    const start = Math.max(0, Math.min(range.start, text.length))
    const end = Math.max(start, Math.min(range.end, text.length))

    if (start < end) {
      markers.push({ position: start, isStart: true, range })
      markers.push({ position: end, isStart: false, range })
    }
  }

  // Sort markers: by position, then end markers before start markers at same position
  markers.sort((a, b) => {
    if (a.position !== b.position) {
      return a.position - b.position
    }
    // End markers should come before start markers at the same position
    // to properly close tags before opening new ones
    if (a.isStart !== b.isStart) {
      return a.isStart ? 1 : -1
    }
    return 0
  })

  // Build result string
  const result: string[] = []
  let lastPosition = 0
  const activeRanges: TextStyleRange[] = []

  for (const marker of markers) {
    // Add text before this marker
    if (marker.position > lastPosition) {
      result.push(escapeHtml(text.slice(lastPosition, marker.position)))
    }
    lastPosition = marker.position

    if (marker.isStart) {
      // Open tags for this range
      result.push(getOpeningTags(marker.range))
      activeRanges.push(marker.range)
    } else {
      // Close tags for this range
      result.push(getClosingTags(marker.range))
      const idx = activeRanges.indexOf(marker.range)
      if (idx !== -1) {
        activeRanges.splice(idx, 1)
      }
    }
  }

  // Add remaining text
  if (lastPosition < text.length) {
    result.push(escapeHtml(text.slice(lastPosition)))
  }

  return result.join('')
}

/**
 * Generate opening HTML tags for a style range
 */
function getOpeningTags(range: TextStyleRange): string {
  const tags: string[] = []

  if (range.highlight) {
    tags.push(
      `<mark data-color="${range.highlight}" data-highlight-id="${range.id}" style="background-color: ${range.highlight};">`,
    )
  }

  if (range.bold) {
    tags.push(`<strong data-highlight-id="${range.id}">`)
  }

  if (range.underline) {
    tags.push(`<u data-highlight-id="${range.id}">`)
  }

  return tags.join('')
}

/**
 * Generate closing HTML tags for a style range
 * Tags must be closed in reverse order
 */
function getClosingTags(range: TextStyleRange): string {
  const tags: string[] = []

  // Close in reverse order
  if (range.underline) {
    tags.push('</u>')
  }

  if (range.bold) {
    tags.push('</strong>')
  }

  if (range.highlight) {
    tags.push('</mark>')
  }

  return tags.join('')
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
