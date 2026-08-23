import { useMutation, useQueryClient } from '@tanstack/react-query'

import { screensQueryKey } from './useScreens'
import { duplicateScreen } from '../service/screens'

export function useDuplicateScreen() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: duplicateScreen,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: screensQueryKey })
    },
  })
}
