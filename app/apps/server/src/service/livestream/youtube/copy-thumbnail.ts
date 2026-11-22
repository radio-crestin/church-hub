import { getAccessToken, YOUTUBE_API_ORIGIN } from './client'

/**
 * Sets a broadcast's thumbnail to the image at `imageUrl` (the template's).
 * YouTube takes custom thumbnails only from verified channels.
 */
export async function copyThumbnail(
  videoId: string,
  imageUrl: string,
): Promise<void> {
  const image = await fetch(imageUrl)
  if (!image.ok) {
    throw new Error(`Thumbnail ${imageUrl} answered ${image.status}`)
  }
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('Not authenticated with YouTube')

  const url = new URL(`${YOUTUBE_API_ORIGIN}/upload/youtube/v3/thumbnails/set`)
  url.searchParams.set('videoId', videoId)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': image.headers.get('content-type') ?? 'image/jpeg',
    },
    body: await image.arrayBuffer(),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    throw new Error(
      `YouTube API error: ${error.error?.message ?? response.statusText}`,
    )
  }
}
