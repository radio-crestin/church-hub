import { Loader2 } from 'lucide-react'
import { useState } from 'react'
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
  | { kind: 'picking' }
  | { kind: 'capturing' }
  | {
      kind: 'editing'
      element: PickedElement | null
      screenshot: HTMLCanvasElement | null
    }

interface RequestFeatureToolProps {
  onClose: () => void
}

/**
 * "Request a feature", run like a screenshot tool: pick an element (or the
 * whole screen), get a screenshot with it outlined, draw on it, add notes
 * and send. Mount it only while open; unmounting resets every step.
 */
export function RequestFeatureTool({ onClose }: RequestFeatureToolProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>({ kind: 'picking' })
  // Kept here so "pick again" does not lose what was already typed.
  const [values, setValues] = useState<RequestFeatureValues>(() => ({
    title: '',
    notes: '',
    email: getSavedEmail(),
  }))

  const handlePick = async (target: Element | null) => {
    const element = target ? describePickedElement(target) : null
    const rect = target?.getBoundingClientRect() ?? null
    setStep({ kind: 'capturing' })
    let screenshot: HTMLCanvasElement | null = null
    try {
      screenshot = await captureScreenshot(rect)
    } catch (error) {
      // The request still goes out, just without a picture.
      // biome-ignore lint/suspicious/noConsole: surface the cause for support
      console.error('[feature-request] screenshot failed', error)
    }
    setStep({ kind: 'editing', element, screenshot })
  }

  if (step.kind === 'picking') {
    return <ElementPicker onPick={handlePick} onCancel={onClose} />
  }

  if (step.kind === 'capturing') {
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
      onRetake={() => setStep({ kind: 'picking' })}
      onClose={onClose}
    />
  )
}
