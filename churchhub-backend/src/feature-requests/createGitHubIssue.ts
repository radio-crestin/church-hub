import { GITHUB_ISSUE_LABEL, GITHUB_REPO } from './constants'
import type { CreatedIssue } from './types'

interface GitHubIssueResponse {
  html_url: string
  number: number
}

/** Opens a public issue in the church-hub repo with the `GITHUB_TOKEN` PAT. */
export async function createGitHubIssue(
  token: string,
  title: string,
  body: string
): Promise<CreatedIssue> {
  if (!token) throw new Error('GITHUB_TOKEN is not configured')

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'ChurchHub-Backend',
      },
      body: JSON.stringify({ title, body, labels: [GITHUB_ISSUE_LABEL] }),
    }
  )

  if (!response.ok) {
    throw new Error(
      `GitHub API error ${response.status}: ${await response.text()}`
    )
  }
  const issue = (await response.json()) as GitHubIssueResponse
  return { url: issue.html_url, number: issue.number }
}
