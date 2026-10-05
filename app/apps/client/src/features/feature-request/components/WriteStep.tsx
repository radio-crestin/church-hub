import { type Ref, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { EmailField } from './EmailField'
import { NotesField } from './NotesField'
import { PublicNotice } from './PublicNotice'
import type { Annotation, RequestFeatureValues } from '../types'
import { renderAnnotatedScreenshot } from '../utils/renderAnnotatedScreenshot'

interface WriteStepProps {
  values: RequestFeatureValues
  onValuesChange: (values: RequestFeatureValues) => void
  /** The screenshot that will be sent, or null when it is left out. */
  screenshot: HTMLCanvasElement | null
  annotations: Annotation[]
  disabled: boolean
  errorMessage: string | null
  notesRef: Ref<HTMLTextAreaElement>
}

/** Step 2: an optional description, the email, and a preview of the picture. */
export function WriteStep({
  values,
  onValuesChange,
  screenshot,
  annotations,
  disabled,
  errorMessage,
  notesRef,
}: WriteStepProps) {
  const { t } = useTranslation()
  const previewUrl = useMemo(
    () =>
      screenshot ? renderAnnotatedScreenshot(screenshot, annotations) : null,
    [screenshot, annotations],
  )

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t('common:featureRequest.stepWriteTitle')}
      </h3>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="flex flex-col gap-3 min-w-0">
          <NotesField
            ref={notesRef}
            value={values.notes}
            onChange={(notes) => onValuesChange({ ...values, notes })}
            disabled={disabled}
          />
          <EmailField
            value={values.email}
            onChange={(email) => onValuesChange({ ...values, email })}
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
