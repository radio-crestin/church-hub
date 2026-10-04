import type { Bindings } from '../types'
import { SCREENSHOT_ROUTE_PREFIX } from './constants'
import { createGitHubIssue } from './createGitHubIssue'
import { formatIssueBody } from './formatIssueBody'
import { formatWhatsAppMessage } from './formatWhatsAppMessage'
import { getScreenshotStore } from './getScreenshotStore'
import { sendWhatsAppMessage } from './sendWhatsAppMessage'
import type { CreatedIssue, FeatureRequestInput } from './types'

export interface SubmittedFeatureRequest extends CreatedIssue {
  whatsAppSent: boolean
}

/**
 * Stores the screenshot in R2 (served by this worker, so the GitHub token
 * never needs write access to the code), opens the public issue that
 * embeds it (no email), then tells the maintainer on WhatsApp (with the
 * email and the issue link).
 */
export async function submitFeatureRequest(
  env: Bindings,
  request: FeatureRequestInput,
  publicOrigin: string
): Promise<SubmittedFeatureRequest> {
  const screenshotUrl = request.screenshot
    ? `${publicOrigin}${SCREENSHOT_ROUTE_PREFIX}/${await getScreenshotStore(env).save(request.screenshot)}`
    : null

  const issue = await createGitHubIssue(
    env.GITHUB_TOKEN,
    request.title,
    formatIssueBody(request, screenshotUrl)
  )
  const whatsAppSent = await sendWhatsAppMessage(
    env,
    formatWhatsAppMessage(request, issue)
  )
  return { ...issue, whatsAppSent }
}
