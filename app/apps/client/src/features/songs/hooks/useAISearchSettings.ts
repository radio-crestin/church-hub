import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSetting, upsertSetting } from '~/service/settings'
import type { AISearchConfig } from '../types'

const AI_SEARCH_CONFIG_KEY = 'ai_search_config'

export function useAISearchSettings() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['settings', 'ai_search'],
    queryFn: async () => {
      const setting = await getSetting('app_settings', AI_SEARCH_CONFIG_KEY)
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
        key: AI_SEARCH_CONFIG_KEY,
        value: JSON.stringify(config),
      })
      if (!success) {
        throw new Error('Failed to save AI search settings')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'ai_search'] })
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
