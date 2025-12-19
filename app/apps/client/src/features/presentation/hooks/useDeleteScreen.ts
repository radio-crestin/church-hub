import { useMutation, useQueryClient } from '@tanstack/react-query'

import { screensQueryKey } from './useScreens'
import { deleteScreen } from '../service/screens'

export function useDeleteScreen() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteScreen,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: screensQueryKey })
    },
  })
}
