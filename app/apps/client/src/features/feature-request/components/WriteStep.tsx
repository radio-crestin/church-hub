import { type Ref, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { EmailField } from './EmailField'
import { NotesField } from './NotesField'
import { PublicNotice } from './PublicNotice'
import { ScreenshotPreview } from './ScreenshotPreview'
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
  /** Goes back to step 1 to change the screenshot's markup. */
  onEditScreenshot: () => void
}

/**
 * Step 2: the marked-up screenshot, big, above an optional description and
 * the email.
 */
export function WriteStep({
  values,
  onValuesChange,
  screenshot,
  annotations,
  disabled,
  errorMessage,
  notesRef,
  onEditScreenshot,
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
      {previewUrl && (
        <ScreenshotPreview src={previewUrl} onEdit={onEditScreenshot} />
      )}
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
      <PublicNotice />
      {errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
