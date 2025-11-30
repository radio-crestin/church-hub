import { useMutation, useQueryClient } from '@tanstack/react-query'

import { displaysQueryKey } from './useDisplays'
import { updateDisplayTheme } from '../service/displays'
import type { DisplayTheme } from '../types'

interface UpdateThemeParams {
  id: number
  theme: DisplayTheme
}

export function useUpdateDisplayTheme() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, theme }: UpdateThemeParams) =>
      updateDisplayTheme(id, theme),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: displaysQueryKey })
      queryClient.invalidateQueries({ queryKey: ['displays', variables.id] })
    },
  })
}
