import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ContactModal } from './ContactModal'
import { PickedElementInfo } from './PickedElementInfo'
import { PublicNotice } from './PublicNotice'
import {
  RequestFeatureFields,
  type RequestFeatureValues,
} from './RequestFeatureFields'
import { RequestFeatureSuccess } from './RequestFeatureSuccess'
import { ScreenshotAnnotator } from './ScreenshotAnnotator'
import { useSubmitFeatureRequest } from '../hooks/useSubmitFeatureRequest'
import type { PickedElement, Stroke } from '../types'
import { FEATURE_REQUEST_UI_ATTRIBUTE } from '../utils/isFeatureRequestUi'

interface RequestFeatureDialogProps {
  screenshot: HTMLCanvasElement | null
  element: PickedElement | null
  values: RequestFeatureValues
  onValuesChange: (values: RequestFeatureValues) => void
  onRetake: () => void
  onClose: () => void
}

/** Screenshot with a pen on one side, the request form on the other. */
export function RequestFeatureDialog({
  screenshot,
  element,
  values,
  onValuesChange,
  onRetake,
  onClose,
}: RequestFeatureDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [isContactOpen, setIsContactOpen] = useState(false)
  const { state, submit } = useSubmitFeatureRequest()
  const isSending = state.status === 'sending'

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const canSubmit =
    !isSending &&
    values.title.trim() !== '' &&
    values.notes.trim() !== '' &&
    values.email.trim() !== ''

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (canSubmit) void submit({ values, element, screenshot, strokes })
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        {...{ [FEATURE_REQUEST_UI_ATTRIBUTE]: '' }}
        data-testid="feature-request-dialog"
        className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 w-[calc(100%-1rem)] max-w-5xl max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain"
        onCancel={(event) => {
          event.preventDefault()
          if (!isSending) onClose()
        }}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('common:featureRequest.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition-colors"
            aria-label={t('common:buttons.cancel')}
          >
            <X size={20} />
          </button>
        </div>

        {state.status === 'success' ? (
          <RequestFeatureSuccess issueUrl={state.issueUrl} onClose={onClose} />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 px-4 sm:px-6 pb-4 sm:pb-6 md:grid-cols-[minmax(0,1fr)_20rem]"
          >
            <div className="flex flex-col gap-3 min-w-0">
              {screenshot ? (
                <ScreenshotAnnotator
                  screenshot={screenshot}
                  strokes={strokes}
                  onStrokesChange={setStrokes}
                  onRetake={onRetake}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-600 dark:text-gray-400">
                  {t('common:featureRequest.noScreenshot')}
                </p>
              )}
              <PickedElementInfo element={element} />
            </div>

            <div className="flex flex-col gap-3 min-w-0">
              <PublicNotice />
              <RequestFeatureFields
                values={values}
                onChange={onValuesChange}
                disabled={isSending}
              />
              {(state.status === 'error' || state.status === 'rateLimited') && (
                <p
                  className="text-sm text-red-600 dark:text-red-400"
                  role="alert"
                >
                  {state.status === 'rateLimited'
                    ? t('common:featureRequest.rateLimited')
                    : t('common:featureRequest.error')}
                </p>
              )}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsContactOpen(true)}
                  className="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {t('common:contact.title')}
                </button>
                <button
                  type="submit"
                  data-testid="feature-request-submit"
                  disabled={!canSubmit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:hover:bg-indigo-600"
                >
                  {isSending
                    ? t('common:featureRequest.sending')
                    : t('common:featureRequest.submit')}
                </button>
              </div>
            </div>
          </form>
        )}
      </dialog>

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </>
  )
}
