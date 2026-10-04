import type { Bindings } from '../types'
import { createGitHubIssue } from './createGitHubIssue'
import { formatIssueBody } from './formatIssueBody'
import { formatWhatsAppMessage } from './formatWhatsAppMessage'
import { parseImageDataUrl } from './parseImageDataUrl'
import { sendWhatsAppMessage } from './sendWhatsAppMessage'
import type { CreatedIssue, FeatureRequestInput } from './types'
import { uploadScreenshot } from './uploadScreenshot'

export interface SubmittedFeatureRequest extends CreatedIssue {
  whatsAppSent: boolean
}

/**
 * Uploads the screenshot to GitHub, opens the public issue (no email), then
 * tells the maintainer on WhatsApp (with the email and the issue link).
 */
export async function submitFeatureRequest(
  env: Bindings,
  request: FeatureRequestInput
): Promise<SubmittedFeatureRequest> {
  const image = request.screenshot ? parseImageDataUrl(request.screenshot) : null
  const screenshotUrl = image
    ? await uploadScreenshot(env.GITHUB_TOKEN, image, request.title)
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
