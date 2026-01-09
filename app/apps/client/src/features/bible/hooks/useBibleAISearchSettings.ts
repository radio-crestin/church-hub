import { useAISearchSettings } from '~/features/ai-search'

export function useBibleAISearchSettings() {
  return useAISearchSettings('bible_ai_search_config')
}
