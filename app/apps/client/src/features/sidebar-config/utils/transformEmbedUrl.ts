/**
 * Transforms URLs to their embeddable versions
 * Some sites like YouTube block direct embedding and require special embed URLs
 */

/**
 * Extracts YouTube video ID from various YouTube URL formats
 */
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    // youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/,
    // youtu.be/VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // youtube.com/embed/VIDEO_ID (already embed format)
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // youtube.com/v/VIDEO_ID
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    // youtube.com/shorts/VIDEO_ID
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Checks if a URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return (
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('youtube-nocookie.com')
  )
}

/**
 * Transforms a YouTube URL to its embed format
 * Returns null if the URL is not a valid YouTube URL
 */
export function transformYouTubeToEmbed(url: string): string | null {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) {
    return null
  }

  // Use youtube-nocookie.com for privacy-enhanced mode
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`
}

/**
 * Transforms a URL to its embeddable version if necessary
 * Currently supports:
 * - YouTube URLs → embed format
 *
 * Returns the original URL if no transformation is needed
 */
export function transformToEmbedUrl(url: string): string {
  // YouTube URL transformation
  if (isYouTubeUrl(url)) {
    const embedUrl = transformYouTubeToEmbed(url)
    if (embedUrl) {
      console.log('[transformEmbedUrl] Transformed YouTube URL:', url, '→', embedUrl)
      return embedUrl
    }
  }

  // No transformation needed
  return url
}
