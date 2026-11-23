import { useQueryClient } from '@tanstack/react-query'

import { screensQueryKey } from './useScreens'
import { useUpsertScreen } from './useUpsertScreen'
import type { Screen } from '../types'

/**
 * Makes a screen the one every preview mirrors. The server clears the choice
 * on every other screen and tells the other clients, so all of them switch;
 * this client switches at once, before the server answers.
 */
export function useSetPreviewScreen() {
  const queryClient = useQueryClient()
  const upsertScreen = useUpsertScreen()

  const setPreviewScreen = (screen: Screen) => {
    queryClient.setQueryData<Screen[]>(screensQueryKey, (screens) =>
      screens?.map((s) => ({ ...s, isPreviewScreen: s.id === screen.id })),
    )
    return upsertScreen
      .mutateAsync({
        id: screen.id,
        name: screen.name,
        type: screen.type,
        isPreviewScreen: true,
      })
      .catch((error: unknown) => {
        // Back to what the server holds
        queryClient.invalidateQueries({ queryKey: screensQueryKey })
        throw error
      })
  }

  return { setPreviewScreen, isPending: upsertScreen.isPending }
}
