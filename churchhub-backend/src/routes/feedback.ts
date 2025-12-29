import { Hono } from 'hono'
import type { Bindings } from '../types'
import { isAllowedOrigin } from '../middleware/security'

interface FeedbackRequest {
  message: string
  osVersion: string
  appVersion: string
}

interface GitHubIssueResponse {
  html_url: string
  number: number
}

const feedback = new Hono<{ Bindings: Bindings }>()

/**
 * POST /feedback
 * Creates a GitHub issue with user feedback.
 */
feedback.post('/feedback', async (c) => {
  const origin = c.req.header('Origin')

  if (origin && !isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
    return c.json({ success: false, error: 'Invalid origin' }, 403)
  }

  try {
    const body = await c.req.json<FeedbackRequest>()

    if (!body.message?.trim()) {
      return c.json({ success: false, error: 'Message is required' }, 400)
    }

    if (!body.osVersion?.trim()) {
      return c.json({ success: false, error: 'OS version is required' }, 400)
    }

    if (!body.appVersion?.trim()) {
      return c.json({ success: false, error: 'App version is required' }, 400)
    }

    const title = generateIssueTitle(body.message)
    const issueBody = formatIssueBody(body)

    const response = await fetch(
      'https://api.github.com/repos/radio-crestin/church-hub/issues',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'ChurchHub-Backend',
        },
        body: JSON.stringify({
          title,
          body: issueBody,
          labels: ['user-feedback'],
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('GitHub API error:', response.status, errorData)
      return c.json(
        { success: false, error: 'Failed to create GitHub issue' },
        500
      )
    }

    const issueData = (await response.json()) as GitHubIssueResponse

    return c.json({
      success: true,
      issueUrl: issueData.html_url,
      issueNumber: issueData.number,
    })
  } catch (err) {
    console.error('Feedback submission error:', err)
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to submit feedback',
      },
      500
    )
  }
})

function generateIssueTitle(message: string): string {
  const firstLine = message.split('\n')[0].trim()
  const maxLength = 80

  if (firstLine.length <= maxLength) {
    return `[Feedback] ${firstLine}`
  }

  return `[Feedback] ${firstLine.substring(0, maxLength - 3)}...`
}

function formatIssueBody(feedback: FeedbackRequest): string {
  const timestamp = new Date().toISOString()

  return `## User Feedback

${feedback.message}

---

## System Info
- **OS:** ${feedback.osVersion}
- **App Version:** ${feedback.appVersion}
- **Submitted:** ${timestamp}

---
*This issue was automatically created from in-app feedback.*`
}

export default feedback
