import { useState } from 'react'

import { openExternalUrl } from '../../livestream/utils/openInBrowser'
import { attachFeedbackLogs } from '../services/attachFeedbackLogs'
import { getSupportId } from '../services/getSupportId'
import { getSystemInfo } from '../services/getSystemInfo'
import { saveEmail } from '../services/savedEmail'
import { submitFeatureRequest } from '../services/submitFeatureRequest'
import type { Annotation, RequestFeatureValues } from '../types'
import { getScreenshotNotes } from '../utils/getScreenshotNotes'
import { renderAnnotatedScreenshot } from '../utils/renderAnnotatedScreenshot'

type SubmitState =
  | { status: 'idle' | 'sending' | 'error' | 'rateLimited' }
  | { status: 'success'; issueUrl: string }

interface SubmitInput {
  values: RequestFeatureValues
  screenshot: HTMLCanvasElement | null
  annotations: Annotation[]
}

/**
 * Sends the request (drawing and notes flattened into the screenshot, the
 * notes also as text) and,
 * once GitHub has the issue, opens it for the user.
 */
export function useSubmitFeatureRequest() {
  const [state, setState] = useState<SubmitState>({ status: 'idle' })

  const submit = async ({ values, screenshot, annotations }: SubmitInput) => {
    setState({ status: 'sending' })
    saveEmail(values.email)
    try {
      const systemInfo = await getSystemInfo()
      const supportId = getSupportId()
      if (supportId) void attachFeedbackLogs(supportId, systemInfo)

      const result = await submitFeatureRequest({
        notes: values.notes.trim(),
        // The notes on the picture also go as text, so the issue is searchable.
        screenshotNotes: getScreenshotNotes(annotations).map(
          (note) => note.text,
        ),
        email: values.email.trim(),
        route: window.location.pathname,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        ...systemInfo,
        screenshot: screenshot
          ? renderAnnotatedScreenshot(screenshot, annotations)
          : undefined,
        supportId: supportId ?? undefined,
      })
      if (result.code === 'rate_limited') {
        setState({ status: 'rateLimited' })
        return
      }
      if (!result.success || !result.issueUrl) {
        throw new Error(result.error ?? 'Feature request failed')
      }
      setState({ status: 'success', issueUrl: result.issueUrl })
      void openExternalUrl(result.issueUrl)
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: surface the cause for support
      console.error('[feature-request] submit failed', error)
      setState({ status: 'error' })
    }
  }

  return { state, submit }
}
