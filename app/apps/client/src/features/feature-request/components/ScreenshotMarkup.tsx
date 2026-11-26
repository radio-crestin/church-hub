import { Camera } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IncludeScreenshotToggle } from './IncludeScreenshotToggle'
import { MarkupToolbar } from './MarkupToolbar'
import { ScreenshotAnnotator } from './ScreenshotAnnotator'
import type { Annotation, AnnotationTool } from '../types'
import { DEFAULT_MARKUP_COLOR } from '../utils/markupColors'

interface ScreenshotMarkupProps {
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
  'flex items-center gap-1 px-2 py-1.5 text-[13px] font-medium rounded-lg text-fg-label hover:bg-hover hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent transition-colors'

/**
 * The screenshot, on top of the request form, with an iPad-style markup bar: pen,
 * highlighter, shapes, text notes and colours (all optional). It can be
 * retaken or left out.
 */
export function ScreenshotMarkup({
  screenshot,
  annotations,
  onAnnotationsChange,
  isIncluded,
  onIncludedChange,
  onRetake,
  hasCaptureError,
}: ScreenshotMarkupProps) {
  const { t } = useTranslation()
  const [tool, setTool] = useState<AnnotationTool>('pen')
  const [color, setColor] = useState(DEFAULT_MARKUP_COLOR)
  const isShown = screenshot !== null && isIncluded

  const retakeButton = (
    <button
      type="button"
      data-testid="feature-request-retake"
      onClick={onRetake}
      className={linkButton}
    >
      <Camera strokeWidth={1.5} size={16} />
      {t('common:featureRequest.retake')}
    </button>
  )

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-fg">
          {t('common:featureRequest.stepShowTitle')}
        </h3>
        {isShown && retakeButton}
      </div>

      {isShown ? (
        <>
          <MarkupToolbar
            tool={tool}
            onToolChange={setTool}
            color={color}
            onColorChange={setColor}
            canUndo={annotations.length > 0}
            onUndo={() => onAnnotationsChange(annotations.slice(0, -1))}
          />
          {tool === 'note' && (
            <p
              data-testid="feature-request-tool-hint"
              className="text-center text-[13px] text-fg-label"
            >
              {t('common:featureRequest.noteHint')}
            </p>
          )}
          <ScreenshotAnnotator
            screenshot={screenshot}
            annotations={annotations}
            onAnnotationsChange={onAnnotationsChange}
            tool={tool}
            color={color}
          />
        </>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-line p-4 text-[13px] text-fg-label">
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
        <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
          {t('common:featureRequest.captureError')}
        </p>
      )}
    </div>
  )
}
