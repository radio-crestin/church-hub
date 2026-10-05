import { domToCanvas } from 'modern-screenshot'

import { isFeatureRequestUi } from './isFeatureRequestUi'
import { isOutsideViewport } from './isOutsideViewport'

const MAX_SCREENSHOT_WIDTH = 1920
const CAPTURE_TIMEOUT_MS = 15_000

/**
 * Renders what the user sees (the viewport) into a canvas, without the
 * tool's own overlays. The DOM is redrawn by modern-screenshot (SVG
 * foreignObject), which also handles the modern CSS colours Tailwind 4 uses.
 */
export async function captureScreenshot(): Promise<HTMLCanvasElement> {
  const width = window.innerWidth
  const height = window.innerHeight
  const scale = Math.min(
    window.devicePixelRatio || 1,
    MAX_SCREENSHOT_WIDTH / width,
  )

  return domToCanvas(document.body, {
    width,
    height,
    scale,
    timeout: CAPTURE_TIMEOUT_MS,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    filter: (node) => !isFeatureRequestUi(node) && !isOutsideViewport(node),
  })
}
