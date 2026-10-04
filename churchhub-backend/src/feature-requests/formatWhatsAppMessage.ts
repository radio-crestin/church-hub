import type { CreatedIssue, FeatureRequestInput } from './types'

/** Private WhatsApp note for the maintainer: everything, including the email. */
export function formatWhatsAppMessage(
  request: FeatureRequestInput,
  issue: CreatedIssue,
  screenshotUrl: string | null
): string {
  const lines = [
    `*New feature request #${issue.number}*`,
    `*Title:* ${request.title}`,
    `*Email:* ${request.email}`,
    '',
    '*Notes:*',
    request.notes,
    '',
  ]
  if (request.element) {
    lines.push(
      `*Element:* ${request.element.label || '-'}`,
      `\`\`\`${request.element.selector}\`\`\``
    )
  }
  lines.push(
    `*Route:* ${request.route || 'unknown'}`,
    `*App:* ${request.appVersion} on ${request.osVersion}`,
    `*Issue:* ${issue.url}`
  )
  if (screenshotUrl) lines.push(`*Screenshot:* ${screenshotUrl}`)
  return lines.join('\n')
}
