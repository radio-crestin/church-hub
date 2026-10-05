import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ContactModal } from './ContactModal'
import { FlowProgress } from './FlowProgress'
import { RequestFeatureSuccess } from './RequestFeatureSuccess'
import { ScreenshotStep } from './ScreenshotStep'
import { WriteStep } from './WriteStep'
import { useSubmitFeatureRequest } from '../hooks/useSubmitFeatureRequest'
import type { Annotation, RequestFeatureValues } from '../types'
import { FEATURE_REQUEST_UI_ATTRIBUTE } from '../utils/isFeatureRequestUi'
import { isValidEmail } from '../utils/isValidEmail'

interface RequestFeatureDialogProps {
  screenshot: HTMLCanvasElement | null
  values: RequestFeatureValues
  onValuesChange: (values: RequestFeatureValues) => void
  annotations: Annotation[]
  onAnnotationsChange: (annotations: Annotation[]) => void
  onRetake: () => void
  hasCaptureError: boolean
  onClose: () => void
}

const TOTAL_STEPS = 2
const primaryButton =
  'flex items-center justify-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:hover:bg-indigo-600'
const secondaryButton =
  'flex items-center justify-center gap-1.5 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors disabled:opacity-60'

/** Why Send is still off, as a translation key, or null when it can go. */
function getMissingKey(
  values: RequestFeatureValues,
  hasPicture: boolean,
): string | null {
  if (!hasPicture && values.notes.trim() === '') {
    return 'common:featureRequest.contentRequired'
  }
  if (!isValidEmail(values.email)) return 'common:featureRequest.emailRequired'
  return null
}

/**
 * Two short steps. 1: the screenshot, to draw on or add notes to (both
 * optional). 2: an optional description, the email, and Send.
 */
export function RequestFeatureDialog({
  screenshot,
  values,
  onValuesChange,
  annotations,
  onAnnotationsChange,
  onRetake,
  hasCaptureError,
  onClose,
}: RequestFeatureDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [step, setStep] = useState<'show' | 'write'>('show')
  const [isScreenshotIncluded, setIsScreenshotIncluded] = useState(true)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const { state, submit } = useSubmitFeatureRequest()
  const isSending = state.status === 'sending'
  const sentScreenshot = isScreenshotIncluded ? screenshot : null
  const missingKey = getMissingKey(values, sentScreenshot !== null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    // Step 2 opens ready to type.
    if (step === 'write') notesRef.current?.focus({ preventScroll: true })
  }, [step])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (step !== 'write' || isSending || missingKey) return
    void submit({
      values,
      screenshot: sentScreenshot,
      annotations: sentScreenshot ? annotations : [],
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
        className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 w-[calc(100%-1rem)] max-w-3xl max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain"
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
            <FlowProgress
              current={step === 'show' ? 1 : 2}
              total={TOTAL_STEPS}
            />

            {step === 'show' ? (
              <ScreenshotStep
                screenshot={screenshot}
                annotations={annotations}
                onAnnotationsChange={onAnnotationsChange}
                isIncluded={isScreenshotIncluded}
                onIncludedChange={setIsScreenshotIncluded}
                onRetake={onRetake}
                hasCaptureError={hasCaptureError}
              />
            ) : (
              <WriteStep
                values={values}
                onValuesChange={onValuesChange}
                screenshot={sentScreenshot}
                annotations={annotations}
                disabled={isSending}
                errorMessage={errorMessage}
                notesRef={notesRef}
                onEditScreenshot={() => setStep('show')}
              />
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsContactOpen(true)}
                className="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('common:contact.title')}
              </button>
              {step === 'show' ? (
                <button
                  type="button"
                  data-testid="feature-request-next"
                  onClick={() => setStep('write')}
                  className={primaryButton}
                >
                  {t('common:featureRequest.next')}
                  <ArrowRight size={16} />
                </button>
              ) : (
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
                    type="button"
                    data-testid="feature-request-back"
                    disabled={isSending}
                    onClick={() => setStep('show')}
                    className={secondaryButton}
                  >
                    <ArrowLeft size={16} />
                    {t('common:featureRequest.back')}
                  </button>
                  <button
                    type="submit"
                    data-testid="feature-request-submit"
                    disabled={isSending || missingKey !== null}
                    className={primaryButton}
                  >
                    {isSending
                      ? t('common:featureRequest.sending')
                      : t('common:featureRequest.submit')}
                  </button>
                </div>
              )}
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
