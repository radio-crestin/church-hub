import type { Bindings } from '../types'
import { SCREENSHOT_ROUTE_PREFIX } from './constants'
import { createGitHubIssue } from './createGitHubIssue'
import { decodeImageDataUrl } from './decodeImageDataUrl'
import { formatIssueBody } from './formatIssueBody'
import { formatWhatsAppMessage } from './formatWhatsAppMessage'
import { getScreenshotStore } from './getScreenshotStore'
import { sendWhatsAppMessage } from './sendWhatsAppMessage'
import type { CreatedIssue, FeatureRequestInput } from './types'

export interface SubmittedFeatureRequest extends CreatedIssue {
  whatsAppSent: boolean
}

/**
 * Stores the screenshot, opens the public GitHub issue (no email), then
 * tells the maintainer on WhatsApp (with the email and the issue link).
 */
export async function submitFeatureRequest(
  env: Bindings,
  request: FeatureRequestInput,
  publicOrigin: string
): Promise<SubmittedFeatureRequest> {
  const image = request.screenshot
    ? decodeImageDataUrl(request.screenshot)
    : null
  const screenshotUrl = image
    ? `${publicOrigin}${SCREENSHOT_ROUTE_PREFIX}/${await getScreenshotStore(env).save(image)}`
    : null

  const issue = await createGitHubIssue(
    env.GITHUB_TOKEN,
    request.title,
    formatIssueBody(request, screenshotUrl)
  )
  const whatsAppSent = await sendWhatsAppMessage(
    env,
    formatWhatsAppMessage(request, issue, screenshotUrl)
  )
  return { ...issue, whatsAppSent }
}
