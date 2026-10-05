import { codeBlock } from './codeBlock'
import { neutralizeMentions } from './neutralizeMentions'
import type { FeatureRequestInput } from './types'

/**
 * Markdown body of the public GitHub issue. It never contains the email:
 * that goes only to the maintainer over WhatsApp.
 */
export function formatIssueBody(
  request: FeatureRequestInput,
  screenshotUrl: string | null
): string {
  const sections = [`## Request\n\n${neutralizeMentions(request.notes)}`]

  if (screenshotUrl) {
    sections.push(`## Screenshot\n\n![Screenshot](${screenshotUrl})`)
  }

  if (request.element) {
    const { label, selector, path } = request.element
    sections.push(
      [
        '## Picked element',
        label ? `**Label:** ${neutralizeMentions(label)}` : '',
        `**CSS selector**\n${codeBlock(selector)}`,
        `**DOM path**\n${codeBlock(path)}`,
      ]
        .filter(Boolean)
        .join('\n\n')
    )
  }

  sections.push(
    [
      '## Context',
      `- **Route:** ${neutralizeMentions(request.route || 'unknown')}`,
      `- **Viewport:** ${neutralizeMentions(request.viewport || 'unknown')}`,
      `- **App version:** ${neutralizeMentions(request.appVersion)}`,
      `- **OS:** ${neutralizeMentions(request.osVersion)}`,
      `- **Submitted:** ${new Date().toISOString()}`,
    ].join('\n')
  )

  sections.push(
    '---\n*Created from the in-app "Request a feature" tool. This request is public.*'
  )
  return sections.join('\n\n')
}
