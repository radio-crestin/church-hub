import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicNotice } from './PublicNotice'
import {
  RequestFeatureFields,
  type RequestFeatureValues,
} from './RequestFeatureFields'
import type { Stroke } from '../types'
import { renderAnnotatedScreenshot } from '../utils/renderAnnotatedScreenshot'

interface WriteStepProps {
  values: RequestFeatureValues
  onValuesChange: (values: RequestFeatureValues) => void
  /** The screenshot that will be sent, or null when it was left out. */
  screenshot: HTMLCanvasElement | null
  strokes: Stroke[]
  disabled: boolean
  errorMessage: string | null
}

/** Step 2: say what you want. A small preview shows what goes with it. */
export function WriteStep({
  values,
  onValuesChange,
  screenshot,
  strokes,
  disabled,
  errorMessage,
}: WriteStepProps) {
  const { t } = useTranslation()
  const previewUrl = useMemo(
    () => (screenshot ? renderAnnotatedScreenshot(screenshot, strokes) : null),
    [screenshot, strokes],
  )

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t('common:featureRequest.stepWriteTitle')}
      </h3>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="flex flex-col gap-3 min-w-0">
          <RequestFeatureFields
            values={values}
            onChange={onValuesChange}
            disabled={disabled}
          />
        </div>
        {previewUrl && (
          <img
            src={previewUrl}
            alt={t('common:featureRequest.previewAlt')}
            data-testid="feature-request-preview"
            className="order-first sm:order-none w-full max-h-40 sm:max-h-none object-contain object-top rounded-lg border border-gray-200 dark:border-gray-700 self-start"
          />
        )}
      </div>
      <PublicNotice />
      {errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
