interface FitFontSizeParams {
  measureElement: HTMLElement
  text: string
  maxWidth: number
  maxHeight: number
  minFontSize: number
  maxFontSize: number
  lineHeight: number
}

interface FitFontSizeResult {
  fontSize: number
  fits: boolean
}

// Maximum iterations to prevent infinite loops
const MAX_ITERATIONS = 20

/**
 * Binary search to find the largest font size that fits within bounds.
 *
 * Algorithm:
 * 1. Start with low = minFontSize, high = maxFontSize
 * 2. Test mid = (low + high) / 2
 * 3. If text fits, try larger (low = mid)
 * 4. If text doesn't fit, try smaller (high = mid)
 * 5. Stop when high - low <= tolerance (1px)
 *
 * Complexity: O(log n) where n = maxFontSize - minFontSize (~8 iterations for 12-200px)
 */
export function findOptimalFontSize(
  params: FitFontSizeParams,
): FitFontSizeResult {
  const {
    measureElement,
    text,
    maxWidth,
    maxHeight,
    minFontSize,
    maxFontSize,
    lineHeight,
  } = params

  const tolerance = 1

  // Save original inline styles that we'll modify
  const savedFontSize = measureElement.style.fontSize
  const savedWhiteSpace = measureElement.style.whiteSpace
  const savedWordWrap = measureElement.style.wordWrap
  const savedWidth = measureElement.style.width
  const savedHeight = measureElement.style.height
  const savedLineHeight = measureElement.style.lineHeight
  const savedOverflow = measureElement.style.overflow
  const savedTextContent = measureElement.textContent

  try {
    // Setup measurement styles - don't change position/visibility to avoid layout thrashing
    measureElement.style.whiteSpace = 'pre-wrap'
    measureElement.style.wordWrap = 'break-word'
    measureElement.style.width = `${maxWidth}px`
    measureElement.style.height = 'auto'
    measureElement.style.lineHeight = `${lineHeight}`
    measureElement.style.overflow = 'visible'
    measureElement.textContent = text

    // Check if even minFontSize doesn't fit
    measureElement.style.fontSize = `${minFontSize}px`
    if (measureElement.scrollHeight > maxHeight) {
      return { fontSize: minFontSize, fits: false }
    }

    // Check if maxFontSize fits
    measureElement.style.fontSize = `${maxFontSize}px`
    if (measureElement.scrollHeight <= maxHeight) {
      return { fontSize: maxFontSize, fits: true }
    }

    // Binary search for optimal size
    let low = minFontSize
    let high = maxFontSize
    let iterations = 0

    while (high - low > tolerance && iterations < MAX_ITERATIONS) {
      iterations++
      const mid = Math.floor((low + high) / 2)
      measureElement.style.fontSize = `${mid}px`

      if (measureElement.scrollHeight <= maxHeight) {
        low = mid
      } else {
        high = mid
      }
    }

    return { fontSize: low, fits: true }
  } finally {
    // Restore original styles
    measureElement.style.fontSize = savedFontSize
    measureElement.style.whiteSpace = savedWhiteSpace
    measureElement.style.wordWrap = savedWordWrap
    measureElement.style.width = savedWidth
    measureElement.style.height = savedHeight
    measureElement.style.lineHeight = savedLineHeight
    measureElement.style.overflow = savedOverflow
    measureElement.textContent = savedTextContent
  }
}

/**
 * For fitLineToWidth mode: calculate font size so each line fits width without wrapping.
 * Returns the minimum font size that allows ALL lines to fit their width.
 * All lines will use the same font size for visual consistency.
 */
export function findOptimalFontSizePerLine(
  params: FitFontSizeParams,
): FitFontSizeResult {
  const {
    measureElement,
    text,
    maxWidth,
    minFontSize,
    maxFontSize,
    lineHeight,
  } = params

  const tolerance = 1
  const lines = text.split('\n').filter((line) => line.trim() !== '')

  if (lines.length === 0) {
    return { fontSize: maxFontSize, fits: true }
  }

  // Save original inline styles
  const savedFontSize = measureElement.style.fontSize
  const savedWhiteSpace = measureElement.style.whiteSpace
  const savedWidth = measureElement.style.width
  const savedHeight = measureElement.style.height
  const savedLineHeight = measureElement.style.lineHeight
  const savedTextContent = measureElement.textContent
  const savedDisplay = measureElement.style.display
  const savedPosition = measureElement.style.position
  const savedVisibility = measureElement.style.visibility

  try {
    // Setup measurement element for single-line measurement (no wrap)
    // Use block display to ensure accurate scrollWidth measurement
    measureElement.style.display = 'inline-block'
    measureElement.style.position = 'absolute'
    measureElement.style.visibility = 'hidden'
    measureElement.style.whiteSpace = 'nowrap'
    measureElement.style.width = 'auto'
    measureElement.style.height = 'auto'
    measureElement.style.lineHeight = `${lineHeight}`

    // Find optimal size for each line (must fit width)
    let minOptimalSize = maxFontSize

    for (const line of lines) {
      measureElement.textContent = line

      // Check if maxFontSize fits for this line
      measureElement.style.fontSize = `${maxFontSize}px`
      const widthAtMax = measureElement.scrollWidth

      if (widthAtMax <= maxWidth) {
        continue
      }

      // Binary search for this line
      let low = minFontSize
      let high = maxFontSize
      let iterations = 0

      while (high - low > tolerance && iterations < MAX_ITERATIONS) {
        iterations++
        const mid = Math.floor((low + high) / 2)
        measureElement.style.fontSize = `${mid}px`

        if (measureElement.scrollWidth <= maxWidth) {
          low = mid
        } else {
          high = mid
        }
      }

      minOptimalSize = Math.min(minOptimalSize, low)
    }

    // For fitLineToWidth mode, we prioritize width fitting
    // Do NOT apply height constraints - the user explicitly chose width-fitting behavior
    // If text overflows vertically, that's acceptable (user can adjust element height)

    return {
      fontSize: Math.max(minOptimalSize, minFontSize),
      fits: true,
    }
  } finally {
    // Restore original styles - let React handle the content
    measureElement.style.fontSize = savedFontSize
    measureElement.style.whiteSpace = savedWhiteSpace
    measureElement.style.width = savedWidth
    measureElement.style.height = savedHeight
    measureElement.style.lineHeight = savedLineHeight
    measureElement.style.display = savedDisplay
    measureElement.style.position = savedPosition
    measureElement.style.visibility = savedVisibility
    measureElement.textContent = savedTextContent
  }
}
