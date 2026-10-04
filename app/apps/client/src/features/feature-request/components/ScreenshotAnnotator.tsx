import { Crosshair, Eraser, Undo2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePenDrawing } from '../hooks/usePenDrawing'
import type { Stroke } from '../types'
import { HIGHLIGHT_COLOR } from '../utils/drawElementHighlight'

const PEN_COLORS = [HIGHLIGHT_COLOR, '#facc15', '#22c55e', '#3b82f6']

interface ScreenshotAnnotatorProps {
  screenshot: HTMLCanvasElement
  strokes: Stroke[]
  onStrokesChange: (strokes: Stroke[]) => void
  onRetake: () => void
}

/** The screenshot with a pen on top: colours, undo, clear, and pick again. */
export function ScreenshotAnnotator({
  screenshot,
  strokes,
  onStrokesChange,
  onRetake,
}: ScreenshotAnnotatorProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState(PEN_COLORS[0])
  const pen = usePenDrawing(
    canvasRef,
    screenshot,
    strokes,
    onStrokesChange,
    color,
  )

  const toolButton =
    'flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors'

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">
          {t('common:featureRequest.penColor')}
        </span>
        {PEN_COLORS.map((penColor) => (
          <button
            key={penColor}
            type="button"
            aria-label={`${t('common:featureRequest.penColor')} ${penColor}`}
            aria-pressed={penColor === color}
            onClick={() => setColor(penColor)}
            className={`w-6 h-6 rounded-full border-2 ${penColor === color ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
            style={{ backgroundColor: penColor }}
          />
        ))}
        <span className="flex-1" />
        <button
          type="button"
          data-testid="feature-request-undo"
          className={toolButton}
          disabled={strokes.length === 0}
          onClick={() => onStrokesChange(strokes.slice(0, -1))}
        >
          <Undo2 size={14} />
          {t('common:featureRequest.undo')}
        </button>
        <button
          type="button"
          className={toolButton}
          disabled={strokes.length === 0}
          onClick={() => onStrokesChange([])}
        >
          <Eraser size={14} />
          {t('common:featureRequest.clearDrawing')}
        </button>
        <button
          type="button"
          data-testid="feature-request-retake"
          className={toolButton}
          onClick={onRetake}
        >
          <Crosshair size={14} />
          {t('common:featureRequest.retake')}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        data-testid="feature-request-canvas"
        aria-label={t('common:featureRequest.drawHint')}
        className="block mx-auto w-auto h-auto max-w-full max-h-[40vh] md:max-h-[65vh] rounded-lg border border-gray-200 dark:border-gray-700 cursor-crosshair touch-none bg-gray-100 dark:bg-gray-900"
        {...pen}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('common:featureRequest.drawHint')}
      </p>
    </div>
  )
}
