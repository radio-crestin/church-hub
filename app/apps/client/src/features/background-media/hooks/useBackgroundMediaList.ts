import { useQuery } from '@tanstack/react-query'

import { type BackgroundMedia, listBackgroundMedia } from '../service'

export const BACKGROUND_MEDIA_QUERY_KEY = ['background-media']

/** Every uploaded background image and video, newest first. */
export function useBackgroundMediaList() {
  return useQuery<BackgroundMedia[]>({
    queryKey: BACKGROUND_MEDIA_QUERY_KEY,
    queryFn: listBackgroundMedia,
  })
}
