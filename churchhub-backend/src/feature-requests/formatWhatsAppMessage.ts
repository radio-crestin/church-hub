import type { CreatedIssue, FeatureRequestInput } from './types'

/**
 * Private WhatsApp note for the maintainer: title, description, the notes
 * on the screenshot and the email (which never goes to GitHub), plus the
 * issue link for the rest.
 */
export function formatWhatsAppMessage(
  request: FeatureRequestInput,
  issue: CreatedIssue
): string {
  const lines = [
    `*New feature request #${issue.number}*`,
    `*Title:* ${request.title}`,
    `*Email:* ${request.email || '-'}`,
    '',
  ]
  if (request.notes) lines.push('*Description:*', request.notes, '')
  if (request.screenshotNotes.length > 0) {
    lines.push(
      '*Notes on the screenshot:*',
      ...request.screenshotNotes.map((note, index) => `${index + 1}. ${note}`),
      ''
    )
  }
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
