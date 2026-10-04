import { Crosshair, ImageOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DrawHint } from './DrawHint'
import { IncludeScreenshotToggle } from './IncludeScreenshotToggle'
import { ScreenshotAnnotator } from './ScreenshotAnnotator'
import type { PickedElement, Stroke } from '../types'

interface ScreenshotStepProps {
  screenshot: HTMLCanvasElement
  strokes: Stroke[]
  onStrokesChange: (strokes: Stroke[]) => void
  element: PickedElement | null
  isIncluded: boolean
  onIncludedChange: (isIncluded: boolean) => void
  onPickElement: () => void
}

/** Step 1: the screenshot, big, with a nudge to draw where the idea belongs. */
export function ScreenshotStep({
  screenshot,
  strokes,
  onStrokesChange,
  element,
  isIncluded,
  onIncludedChange,
  onPickElement,
}: ScreenshotStepProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t('common:featureRequest.stepShowTitle')}
      </h3>
      {isIncluded ? (
        <>
          <DrawHint hasDrawn={strokes.length > 0} />
          <ScreenshotAnnotator
            screenshot={screenshot}
            strokes={strokes}
            onStrokesChange={onStrokesChange}
          />
        </>
      ) : (
        <p
          data-testid="feature-request-screenshot-off"
          className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-600 dark:text-gray-400"
        >
          <ImageOff size={18} className="flex-shrink-0" />
          {t('common:featureRequest.screenshotOff')}
        </p>
      )}
      <IncludeScreenshotToggle
        checked={isIncluded}
        onChange={onIncludedChange}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <button
          type="button"
          data-testid="feature-request-pick-element"
          onClick={onPickElement}
          className="flex items-center gap-1 px-2 py-1.5 font-medium rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
        >
          <Crosshair size={14} />
          {t('common:featureRequest.pickElement')}
        </button>
        <span data-testid="feature-request-element-label">
          {element
            ? `${t('common:featureRequest.selectedElement')}: ${element.label}`
            : t('common:featureRequest.wholeScreen')}
        </span>
      </div>
    </div>
  )
}
