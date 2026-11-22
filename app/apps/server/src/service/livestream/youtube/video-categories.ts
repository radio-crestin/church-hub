import { youtubeApiFetch } from './client'

export interface VideoCategory {
  id: string
  title: string
}

interface VideoCategoryResponse {
  items?: { id: string; snippet?: { title?: string; assignable?: boolean } }[]
}

/** The categories a video can be given, named in `language` (e.g. "ro"). */
export async function getVideoCategories(
  language: string,
): Promise<VideoCategory[]> {
  const response = await youtubeApiFetch<VideoCategoryResponse>(
    'videoCategories',
    { part: 'snippet', regionCode: 'US', hl: language },
  )
  return (response.items ?? [])
    .filter((item) => item.snippet?.assignable)
    .map((item) => ({ id: item.id, title: item.snippet?.title ?? item.id }))
}
