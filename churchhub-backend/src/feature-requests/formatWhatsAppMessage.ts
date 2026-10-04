import type { CreatedIssue, FeatureRequestInput } from './types'

/**
 * Private WhatsApp note for the maintainer: title, notes and the email
 * (which never goes to GitHub), plus the issue link for the rest.
 */
export function formatWhatsAppMessage(
  request: FeatureRequestInput,
  issue: CreatedIssue
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
    `*App:* ${request.appVersion} on ${request.osVersion}`
  )
  if (request.supportId) lines.push(`*Support ID:* ${request.supportId}`)
  lines.push(`*Issue:* ${issue.url}`)
  return lines.join('\n')
}
