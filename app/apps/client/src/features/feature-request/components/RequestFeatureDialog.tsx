import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ContactModal } from './ContactModal'
import { EmailField } from './EmailField'
import { NotesField } from './NotesField'
import { PublicNotice } from './PublicNotice'
import { RequestFeatureSuccess } from './RequestFeatureSuccess'
import { ScreenshotField } from './ScreenshotField'
import { useSubmitFeatureRequest } from '../hooks/useSubmitFeatureRequest'
import type { RequestFeatureValues, Stroke } from '../types'
import { FEATURE_REQUEST_UI_ATTRIBUTE } from '../utils/isFeatureRequestUi'
import { isValidEmail } from '../utils/isValidEmail'

interface RequestFeatureDialogProps {
  screenshot: HTMLCanvasElement | null
  values: RequestFeatureValues
  onValuesChange: (values: RequestFeatureValues) => void
  strokes: Stroke[]
  onStrokesChange: (strokes: Stroke[]) => void
  onRetake: () => void
  hasCaptureError: boolean
  onClose: () => void
}

/** Why Send is still off, as a translation key, or null when it can go. */
function getMissingKey(values: RequestFeatureValues): string | null {
  if (values.notes.trim() === '') return 'common:featureRequest.notesRequired'
  if (!isValidEmail(values.email)) return 'common:featureRequest.emailRequired'
  return null
}

/**
 * One short form: what you would like (required), the screenshot (with an
 * optional drawing), your email, and Send.
 */
export function RequestFeatureDialog({
  screenshot,
  values,
  onValuesChange,
  strokes,
  onStrokesChange,
  onRetake,
  hasCaptureError,
  onClose,
}: RequestFeatureDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [isScreenshotIncluded, setIsScreenshotIncluded] = useState(true)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const { state, submit } = useSubmitFeatureRequest()
  const isSending = state.status === 'sending'
  const missingKey = getMissingKey(values)

  useEffect(() => {
    dialogRef.current?.showModal()
    // Open ready to type: the description is the one thing to fill in.
    notesRef.current?.focus()
  }, [])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (isSending || missingKey) return
    void submit({
      values,
      screenshot: isScreenshotIncluded ? screenshot : null,
      strokes,
    })
  }

  const errorMessage =
    state.status === 'rateLimited'
      ? t('common:featureRequest.rateLimited')
      : state.status === 'error'
        ? t('common:featureRequest.error')
        : null

  return (
    <>
      <dialog
        ref={dialogRef}
        {...{ [FEATURE_REQUEST_UI_ATTRIBUTE]: '' }}
        data-testid="feature-request-dialog"
        className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 w-[calc(100%-1rem)] max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain"
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
            className="flex flex-col gap-4 px-4 sm:px-6 pb-4 sm:pb-6"
          >
            <NotesField
              ref={notesRef}
              value={values.notes}
              onChange={(notes) => onValuesChange({ ...values, notes })}
              disabled={isSending}
            />
            <ScreenshotField
              screenshot={screenshot}
              strokes={strokes}
              onStrokesChange={onStrokesChange}
              isIncluded={isScreenshotIncluded}
              onIncludedChange={setIsScreenshotIncluded}
              onRetake={onRetake}
              hasCaptureError={hasCaptureError}
            />
            <EmailField
              value={values.email}
              onChange={(email) => onValuesChange({ ...values, email })}
              disabled={isSending}
            />
            <PublicNotice />
            {errorMessage && (
              <p
                className="text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsContactOpen(true)}
                className="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('common:contact.title')}
              </button>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                {missingKey && (
                  <span
                    data-testid="feature-request-missing-hint"
                    className="text-xs text-gray-600 dark:text-gray-400 text-center sm:text-right"
                  >
                    {t(missingKey)}
                  </span>
                )}
                <button
                  type="submit"
                  data-testid="feature-request-submit"
                  disabled={isSending || missingKey !== null}
                  className="flex items-center justify-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:hover:bg-indigo-600"
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
