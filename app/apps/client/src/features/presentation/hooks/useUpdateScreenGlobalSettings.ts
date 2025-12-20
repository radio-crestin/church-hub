import { useMutation, useQueryClient } from '@tanstack/react-query'

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
    onSuccess: () => {
      // Screen query invalidation is handled by WebSocket broadcast from server
      // Still invalidate screens list for potential metadata updates
      queryClient.invalidateQueries({ queryKey: screensQueryKey })
    },
  })
}
