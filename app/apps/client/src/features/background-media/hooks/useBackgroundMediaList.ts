import { useQuery } from '@tanstack/react-query'

import { type BackgroundMedia, listBackgroundMedia } from '../service'

export const BACKGROUND_MEDIA_QUERY_KEY = ['background-media']

interface UseBackgroundMediaListOptions {
  /** false skips the request (e.g. the user may not list media) */
  enabled?: boolean
}

/** Every uploaded background image and video, newest first. */
export function useBackgroundMediaList({
  enabled = true,
}: UseBackgroundMediaListOptions = {}) {
  return useQuery<BackgroundMedia[]>({
    queryKey: BACKGROUND_MEDIA_QUERY_KEY,
    queryFn: listBackgroundMedia,
    enabled,
  })
}
