import { useMutation, useQueryClient } from '@tanstack/react-query'

import { screenQueryKey } from './useScreen'
import { screensQueryKey } from './useScreens'
import { updateScreenGlobalSettings } from '../service/screens'
import type { ScreenGlobalSettings } from '../types'

interface UpdateGlobalSettingsInput {
  screenId: number
  settings: ScreenGlobalSettings
}

export function useUpdateScreenGlobalSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ screenId, settings }: UpdateGlobalSettingsInput) =>
      updateScreenGlobalSettings(screenId, settings),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: screenQueryKey(variables.screenId),
      })
      queryClient.invalidateQueries({ queryKey: screensQueryKey })
    },
  })
}
