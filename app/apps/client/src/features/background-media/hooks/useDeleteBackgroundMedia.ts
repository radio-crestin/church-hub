import { useMutation, useQueryClient } from '@tanstack/react-query'

import { BACKGROUND_MEDIA_QUERY_KEY } from './useBackgroundMediaList'
import { deleteBackgroundMedia } from '../service'

export function useDeleteBackgroundMedia() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: deleteBackgroundMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKGROUND_MEDIA_QUERY_KEY })
    },
  })
}
