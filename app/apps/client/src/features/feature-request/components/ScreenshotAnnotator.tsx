import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { usePenDrawing } from '../hooks/usePenDrawing'
import type { Stroke } from '../types'

const PEN_COLOR = '#ef4444'

interface ScreenshotAnnotatorProps {
  screenshot: HTMLCanvasElement
  strokes: Stroke[]
  onStrokesChange: (strokes: Stroke[]) => void
}

/** The screenshot as a canvas the user can draw on with a red pen. */
export function ScreenshotAnnotator({
  screenshot,
  strokes,
  onStrokesChange,
}: ScreenshotAnnotatorProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pen = usePenDrawing(
    canvasRef,
    screenshot,
    strokes,
    onStrokesChange,
    PEN_COLOR,
  )

  return (
    <canvas
      ref={canvasRef}
      data-testid="feature-request-canvas"
      aria-label={t('common:featureRequest.drawHint')}
      className="block mx-auto w-auto h-auto max-w-full max-h-[30vh] md:max-h-[36vh] rounded-lg border border-gray-200 dark:border-gray-700 cursor-crosshair touch-none bg-gray-100 dark:bg-gray-900"
      {...pen}
    />
  )
}
