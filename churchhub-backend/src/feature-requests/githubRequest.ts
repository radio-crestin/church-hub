import { GITHUB_REPO } from './constants'

/**
 * Calls the GitHub REST API on the church-hub repo with the `GITHUB_TOKEN`
 * PAT and returns the JSON answer; throws on a missing token or an error.
 */
export async function githubRequest<T>(
  token: string,
  method: 'POST',
  repoPath: string,
  body: unknown
): Promise<T> {
  if (!token) throw new Error('GITHUB_TOKEN is not configured')

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/${repoPath}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'ChurchHub-Backend',
      },
      body: JSON.stringify(body),
    }
  )
  if (!response.ok) {
    throw new Error(
      `GitHub ${method} ${repoPath} failed ${response.status}: ${await response.text()}`
    )
  }
  return (await response.json()) as T
}
