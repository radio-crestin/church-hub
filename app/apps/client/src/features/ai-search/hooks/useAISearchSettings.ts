import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSetting, upsertSetting } from '~/service/settings'
import type { AISearchConfig, AISearchConfigKey } from '../types'

export function useAISearchSettings(configKey: AISearchConfigKey) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['settings', configKey],
    queryFn: async () => {
      const setting = await getSetting('app_settings', configKey)
      if (!setting?.value) return null
      try {
        return JSON.parse(setting.value) as AISearchConfig
      } catch {
        return null
      }
    },
  })

  const mutation = useMutation({
    mutationFn: async (config: AISearchConfig) => {
      const success = await upsertSetting('app_settings', {
        key: configKey,
        value: JSON.stringify(config),
      })
      if (!success) {
        throw new Error('Failed to save AI search settings')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', configKey] })
    },
  })

  return {
    config: query.data,
    isLoading: query.isLoading,
    isEnabled: query.data?.enabled && !!query.data?.apiKey,
    updateConfig: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  }
}
