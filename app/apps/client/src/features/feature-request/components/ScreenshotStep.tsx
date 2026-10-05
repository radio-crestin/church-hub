import { Camera, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AnnotationToolPicker } from './AnnotationToolPicker'
import { IncludeScreenshotToggle } from './IncludeScreenshotToggle'
import { ScreenshotAnnotator } from './ScreenshotAnnotator'
import type { Annotation, AnnotationTool } from '../types'

interface ScreenshotStepProps {
  /** Null when no screenshot could be taken. */
  screenshot: HTMLCanvasElement | null
  annotations: Annotation[]
  onAnnotationsChange: (annotations: Annotation[]) => void
  isIncluded: boolean
  onIncludedChange: (isIncluded: boolean) => void
  onRetake: () => void
  hasCaptureError: boolean
}

const linkButton =
  'flex items-center gap-1 px-2 py-1.5 text-sm font-medium rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 disabled:hover:bg-transparent transition-colors'

/**
 * Step 1: the screenshot, big. Draw on it or click to add text notes
 * (both optional), undo, retake it, or leave it out.
 */
export function ScreenshotStep({
  screenshot,
  annotations,
  onAnnotationsChange,
  isIncluded,
  onIncludedChange,
  onRetake,
  hasCaptureError,
}: ScreenshotStepProps) {
  const { t } = useTranslation()
  const [tool, setTool] = useState<AnnotationTool>('pen')
  const isShown = screenshot !== null && isIncluded

  const retakeButton = (
    <button
      type="button"
      data-testid="feature-request-retake"
      onClick={onRetake}
      className={linkButton}
    >
      <Camera size={16} />
      {t('common:featureRequest.retake')}
    </button>
  )

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t('common:featureRequest.stepShowTitle')}
      </h3>

      {isShown ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <AnnotationToolPicker tool={tool} onChange={setTool} />
            <span className="flex-1" />
            <button
              type="button"
              data-testid="feature-request-undo"
              disabled={annotations.length === 0}
              onClick={() => onAnnotationsChange(annotations.slice(0, -1))}
              className={linkButton}
            >
              <Undo2 size={16} />
              {t('common:featureRequest.undo')}
            </button>
            {retakeButton}
          </div>
          <p
            data-testid="feature-request-tool-hint"
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            {t(
              tool === 'note'
                ? 'common:featureRequest.noteHint'
                : 'common:featureRequest.penHint',
            )}
          </p>
          <ScreenshotAnnotator
            screenshot={screenshot}
            annotations={annotations}
            onAnnotationsChange={onAnnotationsChange}
            tool={tool}
          />
        </>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-600 dark:text-gray-400">
          <span data-testid="feature-request-no-screenshot">
            {t(
              screenshot
                ? 'common:featureRequest.screenshotOff'
                : 'common:featureRequest.noScreenshot',
            )}
          </span>
          {retakeButton}
        </div>
      )}

      {screenshot && (
        <IncludeScreenshotToggle
          checked={isIncluded}
          onChange={onIncludedChange}
        />
      )}
      {hasCaptureError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t('common:featureRequest.captureError')}
        </p>
      )}
    </div>
  )
}
