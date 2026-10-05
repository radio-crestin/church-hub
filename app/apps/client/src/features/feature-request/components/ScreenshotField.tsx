import { Camera, Pencil, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IncludeScreenshotToggle } from './IncludeScreenshotToggle'
import { ScreenshotAnnotator } from './ScreenshotAnnotator'
import type { Stroke } from '../types'

interface ScreenshotFieldProps {
  /** Null when no screenshot could be taken. */
  screenshot: HTMLCanvasElement | null
  strokes: Stroke[]
  onStrokesChange: (strokes: Stroke[]) => void
  isIncluded: boolean
  onIncludedChange: (isIncluded: boolean) => void
  onRetake: () => void
  hasCaptureError: boolean
}

const linkButton =
  'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 disabled:hover:bg-transparent transition-colors'

/**
 * The screenshot that goes with the request: a switch to leave it out, a
 * pen to show where (optional), Undo, and Retake for another page or screen.
 */
export function ScreenshotField({
  screenshot,
  strokes,
  onStrokesChange,
  isIncluded,
  onIncludedChange,
  onRetake,
  hasCaptureError,
}: ScreenshotFieldProps) {
  const { t } = useTranslation()
  const isShown = screenshot !== null && isIncluded

  const retakeButton = (
    <button
      type="button"
      data-testid="feature-request-retake"
      onClick={onRetake}
      className={linkButton}
    >
      <Camera size={14} />
      {t('common:featureRequest.retake')}
    </button>
  )

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {screenshot ? (
        <IncludeScreenshotToggle
          checked={isIncluded}
          onChange={onIncludedChange}
        />
      ) : (
        <div className="flex items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span data-testid="feature-request-no-screenshot">
            {t('common:featureRequest.noScreenshot')}
          </span>
          {retakeButton}
        </div>
      )}

      {isShown && (
        <>
          <ScreenshotAnnotator
            screenshot={screenshot}
            strokes={strokes}
            onStrokesChange={onStrokesChange}
          />
          <div className="flex flex-wrap items-center gap-1">
            <span
              data-testid="feature-request-draw-hint"
              className="flex flex-1 items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"
            >
              <Pencil size={14} className="flex-shrink-0" />
              {t('common:featureRequest.drawHint')}
            </span>
            <button
              type="button"
              data-testid="feature-request-undo"
              disabled={strokes.length === 0}
              onClick={() => onStrokesChange(strokes.slice(0, -1))}
              className={linkButton}
            >
              <Undo2 size={14} />
              {t('common:featureRequest.undo')}
            </button>
            {retakeButton}
          </div>
        </>
      )}

      {hasCaptureError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {t('common:featureRequest.captureError')}
        </p>
      )}
    </div>
  )
}
