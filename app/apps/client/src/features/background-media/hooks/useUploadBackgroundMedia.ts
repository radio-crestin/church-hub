import { useMutation, useQueryClient } from '@tanstack/react-query'

import { BACKGROUND_MEDIA_QUERY_KEY } from './useBackgroundMediaList'
import { type BackgroundMedia, uploadBackgroundMedia } from '../service'

export function useUploadBackgroundMedia() {
  const queryClient = useQueryClient()

  return useMutation<BackgroundMedia, Error, File>({
    mutationFn: uploadBackgroundMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKGROUND_MEDIA_QUERY_KEY })
    },
  })
}
