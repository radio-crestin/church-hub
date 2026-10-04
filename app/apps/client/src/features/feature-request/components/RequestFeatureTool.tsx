import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ElementPicker } from './ElementPicker'
import { RequestFeatureDialog } from './RequestFeatureDialog'
import type { RequestFeatureValues } from './RequestFeatureFields'
import { getSavedEmail } from '../services/savedEmail'
import type { PickedElement } from '../types'
import { captureScreenshot } from '../utils/captureScreenshot'
import { describePickedElement } from '../utils/describePickedElement'
import { FEATURE_REQUEST_UI_ATTRIBUTE } from '../utils/isFeatureRequestUi'

type Step =
  | { kind: 'capturing'; target: Element | null }
  | { kind: 'picking' }
  | {
      kind: 'editing'
      element: PickedElement | null
      screenshot: HTMLCanvasElement | null
    }

interface RequestFeatureToolProps {
  onClose: () => void
}

/** Takes the screenshot, outlining the picked element when there is one. */
async function takeScreenshot(
  target: Element | null,
): Promise<HTMLCanvasElement | null> {
  try {
    return await captureScreenshot(target?.getBoundingClientRect() ?? null)
  } catch (error) {
    // The request still goes out, just without a picture.
    // biome-ignore lint/suspicious/noConsole: surface the cause for support
    console.error('[feature-request] screenshot failed', error)
    return null
  }
}

/**
 * "Request a feature", screenshot first: opening it photographs the screen
 * right away, then a short two-step flow lets the user draw on it (optional)
 * and write the request. Pointing at one part of the app is still possible
 * from the first step. Mount it only while open; unmounting resets it all.
 */
export function RequestFeatureTool({ onClose }: RequestFeatureToolProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>({
    kind: 'capturing',
    target: null,
  })
  // Kept here so "point at a part" does not lose what was already typed.
  const [values, setValues] = useState<RequestFeatureValues>(() => ({
    title: '',
    notes: '',
    email: getSavedEmail(),
  }))

  useEffect(() => {
    if (step.kind !== 'capturing') return
    const { target } = step
    let isCancelled = false
    void takeScreenshot(target).then((screenshot) => {
      if (isCancelled) return
      const element = target ? describePickedElement(target) : null
      setStep({ kind: 'editing', element, screenshot })
    })
    return () => {
      isCancelled = true
    }
  }, [step])

  if (step.kind === 'picking') {
    return (
      <ElementPicker
        onPick={(target) => setStep({ kind: 'capturing', target })}
        onCancel={onClose}
      />
    )
  }

  if (step.kind !== 'editing') {
    return (
      <div
        {...{ [FEATURE_REQUEST_UI_ATTRIBUTE]: '' }}
        className="fixed inset-0 flex items-center justify-center bg-black/20 cursor-wait"
        style={{ zIndex: 2147483000 }}
      >
        <span className="flex items-center gap-2 rounded-lg bg-gray-900/90 px-4 py-2 text-sm text-white">
          <Loader2 size={16} className="animate-spin" />
          {t('common:featureRequest.capturing')}
        </span>
      </div>
    )
  }

  return (
    <RequestFeatureDialog
      element={step.element}
      screenshot={step.screenshot}
      values={values}
      onValuesChange={setValues}
      onPickElement={() => setStep({ kind: 'picking' })}
      onClose={onClose}
    />
  )
}
