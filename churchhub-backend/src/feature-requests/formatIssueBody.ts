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
  const sections: string[] = []
  if (request.notes) {
    sections.push(`## Request\n\n${neutralizeMentions(request.notes)}`)
  }

  if (request.screenshotNotes.length > 0) {
    // The same numbers are drawn on the screenshot next to each note.
    const list = request.screenshotNotes
      .map((note, index) => `${index + 1}. ${neutralizeMentions(note)}`)
      .join('\n')
    sections.push(`## Notes on the screenshot\n\n${list}`)
  }

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
