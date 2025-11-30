import { useMutation, useQueryClient } from '@tanstack/react-query'

import { displaysQueryKey } from './useDisplays'
import { deleteDisplay } from '../service/displays'

export function useDeleteDisplay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDisplay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: displaysQueryKey })
    },
  })
}
