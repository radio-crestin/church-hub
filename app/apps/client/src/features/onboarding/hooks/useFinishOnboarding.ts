import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useSidebarConfig } from '~/features/sidebar-config/hooks/useSidebarConfig'
import type { BuiltInMenuItemId } from '~/features/sidebar-config/types'
import { upsertSetting } from '~/service/settings'
import {
  ONBOARDING_FEATURES,
  ONBOARDING_PENDING_KEY,
  ONBOARDING_QUERY_KEY,
} from '../constants'

/**
 * Ends the onboarding: shows the chosen pages in the side menu and hides the
 * other offered ones (`features` null keeps the menu as it is, for Skip).
 */
export function useFinishOnboarding() {
  const queryClient = useQueryClient()
  const { config, updateConfig } = useSidebarConfig()

  return useMutation({
    mutationFn: async (features: Set<BuiltInMenuItemId> | null) => {
      if (features && config) {
        const savedMenu = await updateConfig.mutateAsync({
          ...config,
          items: config.items.map((item) =>
            item.type === 'builtin' &&
            ONBOARDING_FEATURES.includes(item.builtinId)
              ? { ...item, isVisible: features.has(item.builtinId) }
              : item,
          ),
        })
        if (!savedMenu) throw new Error('Could not save the side menu')
      }
      const saved = await upsertSetting('app_settings', {
        key: ONBOARDING_PENDING_KEY,
        value: 'false',
      })
      if (!saved) throw new Error('Could not mark the onboarding as done')
    },
    onSuccess: () => queryClient.setQueryData(ONBOARDING_QUERY_KEY, false),
  })
}
