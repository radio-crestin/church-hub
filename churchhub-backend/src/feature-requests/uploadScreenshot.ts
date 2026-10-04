import { SCREENSHOT_BRANCH } from './constants'
import { githubRequest } from './githubRequest'
import type { ParsedImage } from './parseImageDataUrl'

interface GitHubContentResponse {
  content: { download_url: string }
}

/**
 * The Issues API cannot attach files, so the screenshot is committed with
 * the Contents API to the `feature-request-screenshots` branch of the same
 * public repo, and the issue embeds its raw URL. Everything about a request
 * then lives in GitHub. Returns the image's public URL.
 */
export async function uploadScreenshot(
  token: string,
  image: ParsedImage,
  title: string
): Promise<string> {
  const month = new Date().toISOString().slice(0, 7)
  const path = `screenshots/${month}/${crypto.randomUUID()}.${image.extension}`
  const result = await githubRequest<GitHubContentResponse>(
    token,
    'PUT',
    `contents/${path}`,
    {
      message: `Screenshot for feature request: ${title}`,
      content: image.base64,
      branch: SCREENSHOT_BRANCH,
    }
  )
  return result.content.download_url
}
