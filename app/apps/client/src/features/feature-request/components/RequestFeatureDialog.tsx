import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ContactModal } from './ContactModal'
import { FlowProgress } from './FlowProgress'
import type { RequestFeatureValues } from './RequestFeatureFields'
import { RequestFeatureSuccess } from './RequestFeatureSuccess'
import { ScreenshotStep } from './ScreenshotStep'
import { WriteStep } from './WriteStep'
import { useSubmitFeatureRequest } from '../hooks/useSubmitFeatureRequest'
import type { PickedElement, Stroke } from '../types'
import { FEATURE_REQUEST_UI_ATTRIBUTE } from '../utils/isFeatureRequestUi'

interface RequestFeatureDialogProps {
  screenshot: HTMLCanvasElement | null
  element: PickedElement | null
  values: RequestFeatureValues
  onValuesChange: (values: RequestFeatureValues) => void
  strokes: Stroke[]
  onStrokesChange: (strokes: Stroke[]) => void
  onPickElement: () => void
  onRoam: () => void
  onCaptureDisplay: () => void
  hasCaptureError: boolean
  onClose: () => void
}

const primaryButton =
  'flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:hover:bg-indigo-600'
const secondaryButton =
  'flex items-center justify-center gap-1.5 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors disabled:opacity-60'

/**
 * A short flow in a dialog. Step 1: the screenshot, with a nudge to draw on
 * it. Step 2: write the request and send it. Without a screenshot (it could
 * not be taken) there is only the writing step.
 */
export function RequestFeatureDialog({
  screenshot,
  element,
  values,
  onValuesChange,
  strokes,
  onStrokesChange,
  onPickElement,
  onRoam,
  onCaptureDisplay,
  hasCaptureError,
  onClose,
}: RequestFeatureDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<'show' | 'write'>(
    screenshot ? 'show' : 'write',
  )
  const [isScreenshotIncluded, setIsScreenshotIncluded] = useState(true)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const { state, submit } = useSubmitFeatureRequest()
  const isSending = state.status === 'sending'
  const sentScreenshot = isScreenshotIncluded ? screenshot : null
  const totalSteps = screenshot ? 2 : 1

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
    if (step !== 'write' || !canSubmit) return
    void submit({ values, element, screenshot: sentScreenshot, strokes })
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
              current={step === 'show' ? 1 : totalSteps}
              total={totalSteps}
            />

            {step === 'show' && screenshot ? (
              <ScreenshotStep
                screenshot={screenshot}
                strokes={strokes}
                onStrokesChange={onStrokesChange}
                element={element}
                isIncluded={isScreenshotIncluded}
                onIncludedChange={setIsScreenshotIncluded}
                onPickElement={onPickElement}
                onRoam={onRoam}
                onCaptureDisplay={onCaptureDisplay}
                hasCaptureError={hasCaptureError}
              />
            ) : (
              <WriteStep
                values={values}
                onValuesChange={onValuesChange}
                screenshot={sentScreenshot}
                strokes={strokes}
                disabled={isSending}
                errorMessage={errorMessage}
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
                <div className="flex flex-col-reverse sm:flex-row gap-2">
                  {screenshot && (
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
                  )}
                  <button
                    type="submit"
                    data-testid="feature-request-submit"
                    disabled={!canSubmit}
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
