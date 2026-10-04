import { GITHUB_ISSUE_LABEL } from './constants'
import { githubRequest } from './githubRequest'
import type { CreatedIssue } from './types'

interface GitHubIssueResponse {
  html_url: string
  number: number
}

/** Opens a public issue in the church-hub repo. */
export async function createGitHubIssue(
  token: string,
  title: string,
  body: string
): Promise<CreatedIssue> {
  const issue = await githubRequest<GitHubIssueResponse>(
    token,
    'POST',
    'issues',
    { title, body, labels: [GITHUB_ISSUE_LABEL] }
  )
  return { url: issue.html_url, number: issue.number }
}
