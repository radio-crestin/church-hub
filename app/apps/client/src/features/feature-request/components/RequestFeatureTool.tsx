import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RequestFeatureDialog } from './RequestFeatureDialog'
import { RoamingBar } from './RoamingBar'
import { getSavedEmail } from '../services/savedEmail'
import type { RequestFeatureValues, Stroke } from '../types'
import { captureDisplay } from '../utils/captureDisplay'
import { captureScreenshot } from '../utils/captureScreenshot'
import { FEATURE_REQUEST_UI_ATTRIBUTE } from '../utils/isFeatureRequestUi'

type Step = 'capturing' | 'roaming' | 'editing'

interface RequestFeatureToolProps {
  onClose: () => void
}

/** Takes the screenshot of the app page; null when it cannot be taken. */
async function takeScreenshot(): Promise<HTMLCanvasElement | null> {
  try {
    return await captureScreenshot()
  } catch (error) {
    // The request still goes out, just without a picture.
    // biome-ignore lint/suspicious/noConsole: surface the cause for support
    console.error('[feature-request] screenshot failed', error)
    return null
  }
}

/**
 * "Request a feature": opening it photographs the screen, then one short
 * form asks what the user would like. The screenshot can be retaken on
 * another page of the app or on any other screen or window, without losing
 * what was typed. Mount it only while open; unmounting resets it all.
 */
export function RequestFeatureTool({ onClose }: RequestFeatureToolProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('capturing')
  const [screenshot, setScreenshot] = useState<HTMLCanvasElement | null>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [captureError, setCaptureError] = useState(false)
  const [values, setValues] = useState<RequestFeatureValues>(() => ({
    notes: '',
    email: getSavedEmail(),
  }))

  const showNewScreenshot = (next: HTMLCanvasElement | null) => {
    setScreenshot(next)
    setStrokes([])
    setStep('editing')
  }

  useEffect(() => {
    if (step !== 'capturing') return
    let isCancelled = false
    void takeScreenshot().then((next) => {
      if (!isCancelled) showNewScreenshot(next)
    })
    return () => {
      isCancelled = true
    }
  }, [step])

  const retake = () => {
    setCaptureError(false)
    setStep('roaming')
  }

  const handleCaptureDisplay = async () => {
    try {
      const next = await captureDisplay()
      if (next) showNewScreenshot(next)
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: surface the cause for support
      console.error('[feature-request] display capture failed', error)
      setCaptureError(true)
      setStep('editing')
    }
  }

  if (step === 'roaming') {
    return (
      <RoamingBar
        onTake={() => setStep('capturing')}
        onCaptureDisplay={handleCaptureDisplay}
        onCancel={() => setStep('editing')}
      />
    )
  }

  if (step === 'capturing') {
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
      screenshot={screenshot}
      strokes={strokes}
      onStrokesChange={setStrokes}
      values={values}
      onValuesChange={setValues}
      onRetake={retake}
      hasCaptureError={captureError}
      onClose={onClose}
    />
  )
}
