import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ElementPicker } from './ElementPicker'
import { RequestFeatureDialog } from './RequestFeatureDialog'
import type { RequestFeatureValues } from './RequestFeatureFields'
import { RoamingBar } from './RoamingBar'
import { getSavedEmail } from '../services/savedEmail'
import type { PickedElement, Stroke } from '../types'
import { captureDisplay } from '../utils/captureDisplay'
import { captureScreenshot } from '../utils/captureScreenshot'
import { describePickedElement } from '../utils/describePickedElement'
import { FEATURE_REQUEST_UI_ATTRIBUTE } from '../utils/isFeatureRequestUi'

/** The picture the request is about, and the element it points at, if any. */
interface Shot {
  element: PickedElement | null
  screenshot: HTMLCanvasElement | null
}

type Step =
  | { kind: 'capturing'; target: Element | null }
  | { kind: 'picking' }
  | { kind: 'roaming' }
  | { kind: 'editing' }

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
 * and write the request. From the first step the screenshot can be retaken:
 * pointing at one part of the app, on another page of the app, or on any
 * other screen or window. Mount it only while open; unmounting resets it all.
 */
export function RequestFeatureTool({ onClose }: RequestFeatureToolProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>({ kind: 'capturing', target: null })
  const [shot, setShot] = useState<Shot>({ element: null, screenshot: null })
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [captureError, setCaptureError] = useState(false)
  // Kept here so retaking the screenshot does not lose what was typed.
  const [values, setValues] = useState<RequestFeatureValues>(() => ({
    title: '',
    notes: '',
    email: getSavedEmail(),
  }))

  const showNewShot = (next: Shot) => {
    setShot(next)
    setStrokes([])
    setStep({ kind: 'editing' })
  }

  useEffect(() => {
    if (step.kind !== 'capturing') return
    const { target } = step
    let isCancelled = false
    void takeScreenshot(target).then((screenshot) => {
      if (isCancelled) return
      const element = target ? describePickedElement(target) : null
      showNewShot({ element, screenshot })
    })
    return () => {
      isCancelled = true
    }
  }, [step])

  const handleCaptureDisplay = async () => {
    setCaptureError(false)
    try {
      const screenshot = await captureDisplay()
      if (screenshot) showNewShot({ element: null, screenshot })
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: surface the cause for support
      console.error('[feature-request] display capture failed', error)
      setCaptureError(true)
    }
  }

  if (step.kind === 'picking') {
    return (
      <ElementPicker
        onPick={(target) => setStep({ kind: 'capturing', target })}
        onCancel={onClose}
      />
    )
  }

  if (step.kind === 'roaming') {
    return (
      <RoamingBar
        onTake={() => setStep({ kind: 'capturing', target: null })}
        onCancel={() => setStep({ kind: 'editing' })}
      />
    )
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
      element={shot.element}
      screenshot={shot.screenshot}
      strokes={strokes}
      onStrokesChange={setStrokes}
      values={values}
      onValuesChange={setValues}
      onPickElement={() => setStep({ kind: 'picking' })}
      onRoam={() => setStep({ kind: 'roaming' })}
      onCaptureDisplay={handleCaptureDisplay}
      hasCaptureError={captureError}
      onClose={onClose}
    />
  )
}
